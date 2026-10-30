"""Public job feed: jobs collected from other platforms' official APIs, with a trust rating.

The feed is public on purpose. The sources' terms don't allow hiding their listings behind a signup,
and every job links back to where it came from.
"""

import secrets
import uuid
from datetime import datetime, time, timedelta, timezone
from urllib.parse import quote_plus

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import case, func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.jobfeed import ingest
from app.jobfeed.places import location_variants
from app.jobfeed.sources import SOURCE_INFO, enabled_sources
from app.jobfeed.trust import assess
from app.jobfeed.types import RawJob
from app.models.application import Application
from app.models.external_job import ExternalJob, FeedSync, JobReport
from app.models.job import Job
from app.models.user import User
from app.schemas.types import text
from app.services.trust_stats import (
    POINTS_PER_CONFIRMED_REPORT,
    RESPONSE_WINDOW_DAYS,
    rank_for,
    response_summary,
)

router = APIRouter(prefix="/feed", tags=["job feed"])

WALKIN_WINDOW_DAYS = 7


class TrustReasonOut(BaseModel):
    code: str
    text: str
    impact: int


class FeedJobOut(BaseModel):
    id: uuid.UUID
    source: str
    source_label: str
    title: str
    company: str | None
    location: str | None
    remote: bool | None
    snippet: str
    url: str
    salary_text: str | None
    tags: list[str]
    posted_at: datetime | None
    kind: str
    walkin_date: str | None
    walkin_end_date: str | None = None
    walkin_time: str | None
    walkin_start_time: str | None = None  # 24h HH:MM, for calendar files (posted drives only)
    walkin_end_time: str | None = None
    notes: str | None = None
    native: bool = False  # posted directly on TalentStream (not collected from another platform)
    venue: str | None
    trust_score: int
    trust_label: str
    trust_reasons: list[TrustReasonOut]


class SourceOut(BaseModel):
    name: str
    label: str
    url: str


class FeedPage(BaseModel):
    items: list[FeedJobOut]
    total: int
    page: int
    limit: int
    hidden_risky: int  # listings left out because they look like scams
    updated_at: datetime | None
    syncing: bool
    sources: list[SourceOut]


def _label(source: str) -> str:
    return SOURCE_INFO.get(source, {}).get("label", source)


def _out(job: ExternalJob) -> FeedJobOut:
    snippet = " ".join((job.description or "").split())[:300]
    reasons = sorted(job.trust_reasons or [], key=lambda r: abs(r.get("impact", 0)), reverse=True)[:5]
    return FeedJobOut(
        id=job.id,
        source=job.source,
        source_label=_label(job.source),
        title=job.title,
        company=job.company,
        location=job.location,
        remote=job.remote,
        snippet=snippet,
        url=job.url,
        salary_text=job.salary_text,
        tags=job.tags or [],
        posted_at=job.posted_at,
        kind=job.kind,
        walkin_date=job.walkin_date.isoformat() if job.walkin_date else None,
        walkin_time=job.walkin_time,
        venue=job.venue,
        trust_score=job.trust_score,
        trust_label=job.trust_label,
        trust_reasons=[TrustReasonOut(**r) for r in reasons],
    )


def _visible():
    """Jobs that are live, not reported away, and not a duplicate of a better copy from another source."""
    best = (
        select(ExternalJob.id)
        .where(ExternalJob.is_active.is_(True))
        .distinct(ExternalJob.dedupe_key)
        .order_by(ExternalJob.dedupe_key, ExternalJob.trust_score.desc(), ExternalJob.posted_at.desc().nulls_last())
    )
    return [
        ExternalJob.is_active.is_(True),
        ExternalJob.report_count < settings.FEED_MAX_REPORTS,
        ExternalJob.id.in_(best),
    ]


def _fmt_time(t: time) -> str:
    return t.strftime("%I:%M %p").lstrip("0")


def _native_out(job: Job, today) -> FeedJobOut:
    """A walk-in drive posted on TalentStream, shown the same way (and judged the same way) as collected ones."""
    employer = job.employer.company_name or job.employer.full_name
    venue = job.venue or ""
    directions = f"https://www.google.com/maps/search/?api=1&query={quote_plus(venue)}"
    notes = job.walkin_notes or ""
    trust = assess(
        RawJob(
            source="talentstream",
            external_id=str(job.id),
            title=job.title,
            url=directions,
            company=employer,
            location=job.location or venue,
            description=f"{job.description}\n{notes}",
            posted_at=job.created_at,
            salary_text=job.salary_range,
            remote=False,
        )
    )
    times = _fmt_time(job.walkin_start_time) if job.walkin_start_time else None
    if times and job.walkin_end_time:
        times = f"{times} – {_fmt_time(job.walkin_end_time)}"
    first = max(job.walkin_date, today)  # a drive that already started is "on now"
    return FeedJobOut(
        id=job.id,
        source="talentstream",
        source_label="TalentStream",
        title=job.title,
        company=employer,
        location=job.location or venue,
        remote=False,
        snippet=" ".join(job.description.split())[:300],
        url=directions,
        salary_text=job.salary_range,
        tags=[str(r) for r in (job.requirements or [])][:5],
        posted_at=job.created_at,
        kind="walkin",
        walkin_date=first.isoformat(),
        walkin_end_date=job.walkin_end_date.isoformat() if job.walkin_end_date and job.walkin_end_date > first else None,
        walkin_time=times,
        walkin_start_time=job.walkin_start_time.strftime("%H:%M") if job.walkin_start_time else None,
        walkin_end_time=job.walkin_end_time.strftime("%H:%M") if job.walkin_end_time else None,
        venue=venue,
        notes=notes or None,
        native=True,
        trust_score=trust.score,
        trust_label=trust.label,
        trust_reasons=[TrustReasonOut(**r) for r in trust.reasons_as_dicts()[:5]],
    )


async def _native_walkins(db: AsyncSession, today, q: str | None = None, location: str | None = None) -> list[FeedJobOut]:
    window_end = today + timedelta(days=WALKIN_WINDOW_DAYS)
    stmt = (
        select(Job)
        .where(
            Job.kind == "walkin",
            Job.status == "open",
            Job.walkin_date <= window_end,
            func.coalesce(Job.walkin_end_date, Job.walkin_date) >= today,
        )
        .options(selectinload(Job.employer))
    )
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Job.title.ilike(like) | Job.description.ilike(like) | Job.venue.ilike(like))
    if location:
        stmt = stmt.where(or_(*(Job.location.ilike(f"%{v}%") | Job.venue.ilike(f"%{v}%") for v in location_variants(location))))
    rows = (await db.execute(stmt)).scalars().all()
    return [_native_out(j, today) for j in rows]


async def _walkin_page(db, conditions, q, location, include_risky, page, limit) -> FeedPage:
    """Walk-in tab: drives posted here plus any collected from other platforms, soonest first."""
    today = ingest.today_local()
    window_end = today + timedelta(days=WALKIN_WINDOW_DAYS)
    external = (
        await db.execute(
            select(ExternalJob)
            .where(*conditions, ExternalJob.walkin_date >= today, ExternalJob.walkin_date <= window_end)
            .limit(300)
        )
    ).scalars().all()
    items = [*(await _native_walkins(db, today, q, location)), *(_out(r) for r in external)]
    hidden = sum(1 for i in items if i.trust_label == "likely_scam")
    if not include_risky:
        items = [i for i in items if i.trust_label != "likely_scam"]
    else:
        hidden = 0
    items.sort(key=lambda i: (i.walkin_date or "9999", -i.trust_score))
    updated = await db.scalar(select(func.max(FeedSync.last_ok_at)))
    return FeedPage(
        items=items[(page - 1) * limit : page * limit],
        total=len(items),
        page=page,
        limit=limit,
        hidden_risky=hidden,
        updated_at=updated,
        syncing=ingest._lock.locked(),
        sources=[SourceOut(name=n, label=SOURCE_INFO[n]["label"], url=SOURCE_INFO[n]["url"]) for n in enabled_sources()],
    )


@router.get("/jobs", response_model=FeedPage)
async def list_feed_jobs(
    kind: str = Query("apply", pattern="^(apply|walkin)$"),
    q: str | None = Query(None, max_length=100),
    location: str | None = Query(None, max_length=100),
    remote: bool | None = None,
    include_risky: bool = False,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    await ingest.maybe_refresh_in_background()

    conditions = [*_visible(), ExternalJob.kind == kind]
    if q:
        like = f"%{q.strip()}%"
        conditions.append(ExternalJob.title.ilike(like) | ExternalJob.company.ilike(like) | ExternalJob.description.ilike(like))
    if location:
        conditions.append(or_(*(ExternalJob.location.ilike(f"%{v}%") for v in location_variants(location))))
    if remote is not None:
        conditions.append(ExternalJob.remote.is_(remote))

    if kind == "walkin":
        return await _walkin_page(db, [c for c in conditions if c is not None], q, location, include_risky, page, limit)

    risky = ExternalJob.trust_label == "likely_scam"
    shown = conditions if include_risky else [*conditions, ~risky]

    total = await db.scalar(select(func.count()).select_from(ExternalJob).where(*shown)) or 0
    hidden = 0 if include_risky else (await db.scalar(select(func.count()).select_from(ExternalJob).where(*conditions, risky)) or 0)

    order = (
        [ExternalJob.walkin_date.asc(), ExternalJob.trust_score.desc()]
        if kind == "walkin"
        else [ExternalJob.posted_at.desc().nulls_last(), ExternalJob.trust_score.desc()]
    )
    rows = (await db.execute(select(ExternalJob).where(*shown).order_by(*order).offset((page - 1) * limit).limit(limit))).scalars().all()

    updated = await db.scalar(select(func.max(FeedSync.last_ok_at)))
    return FeedPage(
        items=[_out(r) for r in rows],
        total=total,
        page=page,
        limit=limit,
        hidden_risky=hidden,
        updated_at=updated,
        syncing=ingest._lock.locked(),
        sources=[SourceOut(name=n, label=SOURCE_INFO[n]["label"], url=SOURCE_INFO[n]["url"]) for n in enabled_sources()],
    )


@router.get("/stats")
async def feed_stats(db: AsyncSession = Depends(get_db)):
    today = ingest.today_local()
    live = [*_visible(), ExternalJob.trust_label != "likely_scam"]
    apply_count = await db.scalar(select(func.count()).select_from(ExternalJob).where(*live, ExternalJob.kind == "apply")) or 0
    walkin_count = (
        await db.scalar(
            select(func.count()).select_from(ExternalJob).where(
                *live,
                ExternalJob.kind == "walkin",
                ExternalJob.walkin_date >= today,
                ExternalJob.walkin_date <= today + timedelta(days=WALKIN_WINDOW_DAYS),
            )
        )
        or 0
    )
    walkin_count += sum(1 for j in await _native_walkins(db, today) if j.trust_label != "likely_scam")
    syncs = (await db.execute(select(FeedSync))).scalars().all()
    return {
        "apply_jobs": apply_count,
        "walkin_jobs_next_7_days": walkin_count,
        "syncing": ingest._lock.locked(),
        "sources": [
            {"name": s.source, "last_ok_at": s.last_ok_at, "last_count": s.last_count, "last_error": s.last_error} for s in syncs
        ],
    }


class ReportIn(BaseModel):
    reason: text(300) | None = None


@router.post("/jobs/{job_id}/report")
async def report_job(
    job_id: uuid.UUID,
    body: ReportIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Flag a job as fake or misleading. Enough reports hide it for everyone."""
    job = await db.get(ExternalJob, job_id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    db.add(JobReport(job_id=job_id, user_id=current_user.id, reason=body.reason))
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="You already reported this job") from None
    await db.execute(update(ExternalJob).where(ExternalJob.id == job_id).values(report_count=ExternalJob.report_count + 1))
    await db.commit()
    await db.refresh(job)
    return {"reported": True, "hidden": job.report_count >= settings.FEED_MAX_REPORTS}


@router.get("/my-reports")
async def my_reports(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """How many listings this user reported, and how many of those the community also agreed were fake.

    A report only earns points when enough candidates reported the same listing and it was hidden, so
    reporting at random earns nothing.
    """
    sent = await db.scalar(select(func.count()).select_from(JobReport).where(JobReport.user_id == current_user.id)) or 0
    confirmed = (
        await db.scalar(
            select(func.count())
            .select_from(JobReport)
            .join(ExternalJob, ExternalJob.id == JobReport.job_id)
            .where(JobReport.user_id == current_user.id, ExternalJob.report_count >= settings.FEED_MAX_REPORTS)
        )
        or 0
    )
    points = confirmed * POINTS_PER_CONFIRMED_REPORT
    return {
        "reports_sent": sent,
        "confirmed": confirmed,
        "points": points,
        "points_per_confirmed": POINTS_PER_CONFIRMED_REPORT,
        "reports_needed_to_hide": settings.FEED_MAX_REPORTS,
        **rank_for(points),
    }


@router.get("/companies")
async def company_check(
    q: str = Query(..., min_length=2, max_length=100),
    db: AsyncSession = Depends(get_db),
):
    """Look a company up before applying: what we have collected about it, and how employers here treat applicants."""
    like = f"%{q.strip()}%"
    out: dict[str, dict] = {}

    # Listings collected from other platforms
    ext = (
        await db.execute(
            select(
                func.min(ExternalJob.company),
                func.count(),
                func.avg(ExternalJob.trust_score),
                func.sum(case((ExternalJob.trust_label == "looks_good", 1), else_=0)),
                func.sum(case((ExternalJob.trust_label == "be_careful", 1), else_=0)),
                func.sum(case((ExternalJob.trust_label == "likely_scam", 1), else_=0)),
                func.sum(ExternalJob.report_count),
                func.array_agg(func.distinct(ExternalJob.source)),
            )
            .where(ExternalJob.is_active.is_(True), ExternalJob.company.is_not(None), ExternalJob.company.ilike(like))
            .group_by(func.lower(ExternalJob.company))
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    for name, total, avg, good, careful, scam, reports, sources in ext:
        out[name.strip().lower()] = {
            "name": name,
            "listings": {
                "total": total,
                "average_trust": round(float(avg or 0)),
                "looks_genuine": int(good or 0),
                "be_careful": int(careful or 0),
                "likely_fake": int(scam or 0),
                "reports": int(reports or 0),
                "sources": sorted(_label(src) for src in sources),
            },
            "on_talentstream": None,
        }

    # Employers who post on TalentStream
    employers = (
        await db.execute(
            select(User.id, User.company_name).where(User.role == "employer", User.company_name.is_not(None), User.company_name.ilike(like)).limit(10)
        )
    ).all()
    cutoff = datetime.now(timezone.utc) - timedelta(days=RESPONSE_WINDOW_DAYS)
    for employer_id, company_name in employers:
        posted = await db.scalar(select(func.count()).select_from(Job).where(Job.employer_id == employer_id)) or 0
        if posted == 0:
            continue
        old = (
            await db.execute(
                select(Application.status, Application.created_at, Application.decided_at)
                .join(Job, Job.id == Application.job_id)
                .where(Job.employer_id == employer_id, Application.created_at <= cutoff)
            )
        ).all()
        decided_rows = [r for r in old if r.status in ("shortlisted", "rejected", "hired")]
        days = [(r.decided_at - r.created_at).total_seconds() / 86400 for r in decided_rows if r.decided_at]
        entry = out.setdefault(
            company_name.strip().lower(), {"name": company_name, "listings": None, "on_talentstream": None}
        )
        entry["on_talentstream"] = {"jobs_posted": posted, **response_summary(len(old), len(decided_rows), days)}

    results = sorted(out.values(), key=lambda c: (c["listings"] or {}).get("total", 0), reverse=True)
    return {"query": q.strip(), "results": results[:10]}


@router.post("/refresh")
async def force_refresh(x_ingest_token: str | None = Header(default=None)):
    """Fetch every source now (ignores the polite-polling timer). Needs INGEST_TOKEN to be set."""
    if not settings.INGEST_TOKEN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Manual refresh is disabled")
    if not x_ingest_token or not secrets.compare_digest(x_ingest_token, settings.INGEST_TOKEN):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid token")
    return await ingest.refresh(force=True)
