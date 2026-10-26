from collections.abc import Awaitable, Callable

import httpx

from app.core.config import settings
from app.jobfeed.sources import adzuna, jooble, remoteok, remotive
from app.jobfeed.types import RawJob

# name -> fetch function
SOURCES: dict[str, Callable[[httpx.AsyncClient], Awaitable[list[RawJob]]]] = {
    remotive.NAME: remotive.fetch,
    remoteok.NAME: remoteok.fetch,
    adzuna.NAME: adzuna.fetch,
    jooble.NAME: jooble.fetch,
}

# Shown next to every job; the link goes to the source, as their terms require
SOURCE_INFO = {
    "remotive": {"label": "Remotive", "url": "https://remotive.com"},
    "remoteok": {"label": "Remote OK", "url": "https://remoteok.com"},
    "adzuna": {"label": "Adzuna", "url": "https://www.adzuna.in"},
    "jooble": {"label": "Jooble", "url": "https://in.jooble.org"},
}


def enabled_sources() -> list[str]:
    wanted = [s.strip().lower() for s in settings.JOB_SOURCES.split(",") if s.strip()]
    names = [s for s in wanted if s in SOURCES]
    if "adzuna" in names and not (settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY):
        names.remove("adzuna")  # needs a free API key
    if "jooble" in names and not settings.JOOBLE_API_KEY:
        names.remove("jooble")  # needs a free API key
    return names
