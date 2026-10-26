from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.core.config import settings


def local_today() -> date:
    """Today's date where the jobs are (India by default). Decides what counts as 'in the next 7 days'."""
    return datetime.now(ZoneInfo(settings.FEED_TIMEZONE)).date()
