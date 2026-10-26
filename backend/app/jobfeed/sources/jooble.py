"""Jooble (https://jooble.org/api/about): an aggregator with a free partner API that covers India.

Needs a free key (JOOBLE_API_KEY). Jooble's terms ask for a link to the listing, which every card has.

NOTE: written from Jooble's published request/response format and tested only against saved sample
data, because a key is needed to call the live API. Verify it with a real key before relying on it.
"""

import hashlib
from datetime import datetime

import httpx

from app.core.config import settings
from app.jobfeed.places import MAJOR_CITIES
from app.jobfeed.text import html_to_text
from app.jobfeed.types import RawJob

NAME = "jooble"
BASE = "https://jooble.org/api"
PAGES = 2


def parse(payload: dict) -> list[RawJob]:
    jobs = []
    for item in payload.get("jobs", []):
        title, link = html_to_text(item.get("title")), item.get("link")
        if not title or not link:
            continue
        posted = None
        if item.get("updated"):
            try:
                posted = datetime.fromisoformat(item["updated"].replace("Z", "+00:00"))
            except ValueError:
                posted = None
        # Jooble's id is sometimes missing, so fall back to a hash of the link
        external_id = str(item.get("id") or hashlib.sha1(link.encode()).hexdigest()[:20])
        jobs.append(
            RawJob(
                source=NAME,
                external_id=external_id,
                title=title,
                url=link,
                company=(item.get("company") or "").strip() or None,
                location=(item.get("location") or "").strip() or None,
                description=html_to_text(item.get("snippet")),
                posted_at=posted,
                salary_text=(item.get("salary") or "").strip() or None,
                tags=[t for t in [(item.get("type") or "").strip()] if t],
            )
        )
    return jobs


async def fetch(client: httpx.AsyncClient) -> list[RawJob]:
    if not settings.JOOBLE_API_KEY:
        return []
    found: dict[str, RawJob] = {}
    # One search for the whole country, one for walk-ins, and one per big city
    searches = [("", settings.JOOBLE_COUNTRY_LOCATION, PAGES), ("walk-in interview", settings.JOOBLE_COUNTRY_LOCATION, 1)]
    searches += [("", city, 1) for city in MAJOR_CITIES]
    for keywords, location, pages in searches:
        for page in range(1, pages + 1):
            response = await client.post(
                f"{BASE}/{settings.JOOBLE_API_KEY}", json={"keywords": keywords, "location": location, "page": str(page)}
            )
            response.raise_for_status()
            for job in parse(response.json()):
                found[job.external_id] = job
    return list(found.values())
