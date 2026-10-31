"""When a video meeting can be joined, and how people connect to each other."""

from datetime import datetime, timedelta, timezone

from app.core.config import settings

JOIN_EARLY = timedelta(minutes=10)
JOIN_LATE = timedelta(hours=3)
# Anyone who has still not joined this long after the start has missed the interview
NO_SHOW_AFTER = timedelta(minutes=15)


def join_window(scheduled_at: datetime) -> tuple[datetime, datetime]:
    """The room opens 10 minutes before the start time and stays open for 3 hours after it."""
    return scheduled_at - JOIN_EARLY, scheduled_at + JOIN_LATE


def attendance_state(
    scheduled_at: datetime,
    candidate_joined_at: datetime | None,
    employer_joined_at: datetime | None,
    now: datetime | None = None,
) -> dict:
    """upcoming (still time to join), completed (both came), or missed (someone never joined) and who was absent."""
    now = now or datetime.now(timezone.utc)
    if now < scheduled_at + NO_SHOW_AFTER:
        return {"state": "upcoming", "absent": []}
    absent = [who for who, joined in (("candidate", candidate_joined_at), ("employer", employer_joined_at)) if joined is None]
    return {"state": "missed", "absent": absent} if absent else {"state": "completed", "absent": []}


def can_join(scheduled_at: datetime, now: datetime | None = None, state: str = "upcoming") -> bool:
    """The room is open in its time window, unless the interview was already missed."""
    opens, closes = join_window(scheduled_at)
    return state != "missed" and opens <= (now or datetime.now(timezone.utc)) <= closes


def ice_servers() -> list[dict]:
    """STUN finds each browser's public address; TURN (if configured) relays the call when a direct path is blocked."""
    servers: list[dict] = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    urls = [u.strip() for u in settings.TURN_URLS.split(",") if u.strip()]
    if urls and settings.TURN_USERNAME and settings.TURN_CREDENTIAL:
        servers.append({"urls": urls, "username": settings.TURN_USERNAME, "credential": settings.TURN_CREDENTIAL})
    return servers
