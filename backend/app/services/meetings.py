"""When a video meeting can be joined, and how people connect to each other."""

from datetime import datetime, timedelta, timezone

from app.core.config import settings

JOIN_EARLY = timedelta(minutes=10)
JOIN_LATE = timedelta(hours=3)


def join_window(scheduled_at: datetime) -> tuple[datetime, datetime]:
    """The room opens 10 minutes before the start time and stays open for 3 hours after it."""
    return scheduled_at - JOIN_EARLY, scheduled_at + JOIN_LATE


def can_join(scheduled_at: datetime, now: datetime | None = None) -> bool:
    opens, closes = join_window(scheduled_at)
    return opens <= (now or datetime.now(timezone.utc)) <= closes


def ice_servers() -> list[dict]:
    """STUN finds each browser's public address; TURN (if configured) relays the call when a direct path is blocked."""
    servers: list[dict] = [{"urls": ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"]}]
    urls = [u.strip() for u in settings.TURN_URLS.split(",") if u.strip()]
    if urls and settings.TURN_USERNAME and settings.TURN_CREDENTIAL:
        servers.append({"urls": urls, "username": settings.TURN_USERNAME, "credential": settings.TURN_CREDENTIAL})
    return servers
