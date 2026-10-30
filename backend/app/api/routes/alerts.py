"""Walk-in alerts: a candidate picks cities, and the app tells them about drives posted since they last looked.

There is no email or push channel yet, so the news shows up inside TalentStream when they open it.
"""

import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.routes.feed import WALKIN_WINDOW_DAYS, _native_walkins, _visible
from app.core.database import get_db
from app.core.dependencies import require_role
from app.jobfeed import ingest
from app.jobfeed.places import canonical_city, location_variants
from app.models.alert import WalkinAlert
from app.models.external_job import ExternalJob
from app.models.user import User
from app.schemas.types import text

router = APIRouter(prefix="/alerts", tags=["walk-in alerts"])

MAX_ALERTS = 5


class AlertIn(BaseModel):
    city: text(100)


def _out(alert: WalkinAlert) -> dict:
    return {"id": str(alert.id), "city": alert.city}


async def _mine(db: AsyncSession, user: User) -> list[WalkinAlert]:
    rows = await db.execute(select(WalkinAlert).where(WalkinAlert.user_id == user.id).order_by(WalkinAlert.created_at))
    return list(rows.scalars().all())


@router.get("")
async def list_alerts(db: AsyncSession = Depends(get_db), user: User = Depends(require_role("candidate"))):
    return [_out(a) for a in await _mine(db, user)]


@router.post("")
async def add_alert(body: AlertIn, db: AsyncSession = Depends(get_db), user: User = Depends(require_role("candidate"))):
    city = canonical_city(body.city)
    if not city:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Enter a city")
    existing = await _mine(db, user)
    for alert in existing:
        if alert.city.lower() == city.lower():
            return [_out(a) for a in existing]
    if len(existing) >= MAX_ALERTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"You can follow up to {MAX_ALERTS} cities")
    db.add(WalkinAlert(user_id=user.id, city=city))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
    return [_out(a) for a in await _mine(db, user)]


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_alert(alert_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(require_role("candidate"))):
    alert = await db.get(WalkinAlert, alert_id)
    if alert is None or alert.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    await db.delete(alert)
    await db.commit()


async def _new_count(db: AsyncSession, alert: WalkinAlert) -> int:
    """Drives in the next 7 days, in this city, that appeared after the user last looked."""
    today = ingest.today_local()
    window_end = today + timedelta(days=WALKIN_WINDOW_DAYS)
    external = (
        await db.scalar(
            select(func.count())
            .select_from(ExternalJob)
            .where(
                *_visible(),
                ExternalJob.kind == "walkin",
                ExternalJob.walkin_date >= today,
                ExternalJob.walkin_date <= window_end,
                ExternalJob.trust_label != "likely_scam",
                ExternalJob.first_seen_at > alert.last_seen_at,
                or_(*(ExternalJob.location.ilike(f"%{v}%") for v in location_variants(alert.city))),
            )
        )
        or 0
    )
    native = [
        j
        for j in await _native_walkins(db, today, None, alert.city)
        if j.trust_label != "likely_scam" and j.posted_at and j.posted_at > alert.last_seen_at
    ]
    return external + len(native)


@router.get("/new")
async def new_drives(db: AsyncSession = Depends(get_db), user: User = Depends(require_role("candidate"))):
    cities = [{"city": a.city, "new": await _new_count(db, a)} for a in await _mine(db, user)]
    return {"total_new": sum(c["new"] for c in cities), "cities": [c for c in cities if c["new"] > 0]}


@router.post("/seen", status_code=status.HTTP_204_NO_CONTENT)
async def mark_seen(db: AsyncSession = Depends(get_db), user: User = Depends(require_role("candidate"))):
    now = datetime.now(timezone.utc)
    for alert in await _mine(db, user):
        alert.last_seen_at = now
    await db.commit()
