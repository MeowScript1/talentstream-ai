"""Pull jobs from every enabled source, judge them, and store them.

Run by hand with:   python -m app.jobfeed.ingest
It also runs by itself: the feed endpoint calls maybe_refresh_in_background() whenever a source is
overdue, so a free server that sleeps still refreshes the first time someone visits.
"""

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

import httpx
from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert

from app.core.config import settings
from app.core.database import AsyncSessionLocal
from app.core.timeutil import local_today
from app.jobfeed.sources import SOURCES, enabled_sources
from app.jobfeed.text import dedupe_key, truncate
from app.jobfeed.trust import assess
from app.jobfeed.types import RawJob
from app.jobfeed.walkin import detect_walkin
from app.models.external_job import ExternalJob, FeedSync

logger = logging.getLogger(__name__)

MAX_DESCRIPTION = 8000
EXPIRE_AFTER_DAYS = 14  # a job no source has returned for this long is treated as gone
CHUNK = 200

_lock = asyncio.Lock()
_background: set[asyncio.Task] = set()


def today_local() -> date:
    return local_today()


def to_row(job: RawJob, today: date, now: datetime) -> dict:
    """Judge one job and turn it into a database row."""
    # Remote jobs can't be walk-ins, and skipping them avoids false matches in long remote descriptions
    walkin = None if job.remote else detect_walkin(f"{job.title}\n{job.description}", today)
    trust = assess(job, now)
    return {
        "source": job.source,
        "external_id": job.external_id,
        "title": truncate(job.title, 300),
        "company": truncate(job.company, 300) if job.company else None,
        "location": truncate(job.location, 300) if job.location else None,
        "remote": job.remote,
        "description": truncate(job.description, MAX_DESCRIPTION),
        "url": job.url,
        "salary_text": truncate(job.salary_text, 120) if job.salary_text else None,
        "tags": job.tags,
        "posted_at": job.posted_at,
        "kind": "walkin" if walkin else "apply",
        "walkin_date": walkin.first_upcoming(today) if walkin else None,
        "walkin_dates": [d.isoformat() for d in walkin.dates] if walkin else [],
        "walkin_time": truncate(walkin.time, 80) if walkin and walkin.time else None,
        "venue": walkin.venue if walkin else None,
        "trust_score": trust.score,
        "trust_label": trust.label,
        "trust_reasons": trust.reasons_as_dicts(),
        "dedupe_key": dedupe_key(job.company, job.title, job.location),
        "is_active": True,
        "last_seen_at": now,
    }


async def store(db, rows: list[dict]) -> int:
    """Insert new jobs and refresh known ones. report_count and first_seen_at are left alone."""
    unique = {(r["source"], r["external_id"]): r for r in rows}  # one row per job per statement
    rows = list(unique.values())
    keep = {"report_count", "first_seen_at", "id", "source", "external_id"}
    for start in range(0, len(rows), CHUNK):
        stmt = insert(ExternalJob).values(rows[start : start + CHUNK])
        update_cols = {c.name: getattr(stmt.excluded, c.name) for c in ExternalJob.__table__.columns if c.name not in keep and c.name in rows[0]}
        await db.execute(stmt.on_conflict_do_update(constraint="uq_external_job_source_id", set_=update_cols))
    return len(rows)


async def expire_old(db, now: datetime) -> None:
    await db.execute(
        update(ExternalJob)
        .where(ExternalJob.is_active.is_(True), ExternalJob.last_seen_at < now - timedelta(days=EXPIRE_AFTER_DAYS))
        .values(is_active=False)
    )


def _is_due(sync: FeedSync | None, now: datetime) -> bool:
    if sync is None or sync.last_run_at is None:
        return True
    return now - sync.last_run_at >= timedelta(hours=settings.FEED_REFRESH_HOURS)


async def refresh(force: bool = False) -> dict[str, dict]:
    """Refresh every source that is due (or all of them with force=True). Safe to call concurrently."""
    if _lock.locked():
        return {"status": {"skipped": "a refresh is already running"}}
    summary: dict[str, dict] = {}
    async with _lock:
        headers = {"User-Agent": f"TalentStream/1.0 (job aggregator; {settings.FRONTEND_URL})"}
        async with httpx.AsyncClient(timeout=40, headers=headers, follow_redirects=True) as client:
            for name in enabled_sources():
                async with AsyncSessionLocal() as db:
                    now = datetime.now(timezone.utc)
                    sync = await db.get(FeedSync, name)
                    if not force and not _is_due(sync, now):
                        summary[name] = {"skipped": "not due yet"}
                        continue
                    # Record the attempt first, so a failing source isn't hammered on every request
                    await db.execute(
                        insert(FeedSync)
                        .values(source=name, last_run_at=now)
                        .on_conflict_do_update(index_elements=["source"], set_={"last_run_at": now})
                    )
                    await db.commit()

                    try:
                        raw = await SOURCES[name](client)
                        today = today_local()
                        rows = [to_row(j, today, now) for j in raw]
                        count = await store(db, rows) if rows else 0
                        await expire_old(db, now)
                        await db.execute(
                            update(FeedSync).where(FeedSync.source == name).values(last_ok_at=now, last_count=count, last_error=None)
                        )
                        await db.commit()
                        summary[name] = {"stored": count}
                        logger.info("Job feed: %s stored %s jobs", name, count)
                    except Exception as exc:  # one broken source must not stop the others
                        await db.rollback()
                        logger.warning("Job feed: %s failed: %s", name, exc)
                        await db.execute(update(FeedSync).where(FeedSync.source == name).values(last_error=str(exc)[:500]))
                        await db.commit()
                        summary[name] = {"error": str(exc)[:200]}
    return summary


async def any_source_due() -> bool:
    now = datetime.now(timezone.utc)
    names = enabled_sources()
    if not names:
        return False
    async with AsyncSessionLocal() as db:
        rows = {s.source: s for s in (await db.execute(select(FeedSync).where(FeedSync.source.in_(names)))).scalars()}
    return any(_is_due(rows.get(n), now) for n in names)


async def maybe_refresh_in_background() -> None:
    """Called when someone opens the feed: start a refresh if one is overdue and none is running."""
    if _lock.locked():
        return
    try:
        if not await any_source_due():
            return
    except Exception:
        logger.exception("Could not check whether the job feed is due")
        return
    task = asyncio.create_task(refresh())
    _background.add(task)
    task.add_done_callback(_background.discard)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print(asyncio.run(refresh(force=True)))
