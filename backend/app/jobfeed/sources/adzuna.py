"""Adzuna (https://developer.adzuna.com): job search across many boards; this is the India source.

Needs a free app id and key (ADZUNA_APP_ID / ADZUNA_APP_KEY). Adzuna's terms ask for attribution
("Jobs by Adzuna") and a link to the listing, which the UI provides.

NOTE: written from Adzuna's published API schema and tested only against saved sample data, because
a key is needed to call the live API. Verify it with real keys before relying on it.
"""

from datetime import datetime

import httpx

from app.core.config import settings
from app.jobfeed.places import MAJOR_CITIES
from app.jobfeed.text import html_to_text
from app.jobfeed.types import RawJob

NAME = "adzuna"
BASE = "https://api.adzuna.com/v1/api/jobs"
# (phrase, city, pages). A general search, one aimed at walk-in drives, and one per big city so that
# searching by city has real results. About 14 calls per refresh; the free plan is rate limited.
PER_PAGE = 50


def searches() -> list[tuple[str, str, int]]:
    plan = [("", "", 2), ("walk-in interview", "", 1)]
    if settings.ADZUNA_COUNTRY == "in":
        plan += [("", city, 1) for city in MAJOR_CITIES]
    return plan


def _salary(item: dict) -> str | None:
    if str(item.get("salary_is_predicted")) == "1":
        return None  # a guess by Adzuna, not what the employer said
    low, high = item.get("salary_min"), item.get("salary_max")
    if low and high:
        return f"₹{int(low):,} – ₹{int(high):,}" if settings.ADZUNA_COUNTRY == "in" else f"{int(low):,} – {int(high):,}"
    return None


def parse(payload: dict) -> list[RawJob]:
    jobs = []
    for item in payload.get("results", []):
        if not item.get("id") or not item.get("title") or not item.get("redirect_url"):
            continue
        posted = None
        if item.get("created"):
            try:
                posted = datetime.fromisoformat(item["created"].replace("Z", "+00:00"))
            except ValueError:
                posted = None
        jobs.append(
            RawJob(
                source=NAME,
                external_id=str(item["id"]),
                title=html_to_text(item["title"]),
                url=item["redirect_url"],
                company=((item.get("company") or {}).get("display_name") or "").strip() or None,
                location=((item.get("location") or {}).get("display_name") or "").strip() or None,
                description=html_to_text(item.get("description")),
                posted_at=posted,
                salary_text=_salary(item),
                tags=[t for t in [(item.get("category") or {}).get("label"), item.get("contract_time")] if t],
            )
        )
    return jobs


async def fetch(client: httpx.AsyncClient) -> list[RawJob]:
    if not (settings.ADZUNA_APP_ID and settings.ADZUNA_APP_KEY):
        return []
    found: dict[str, RawJob] = {}
    for phrase, city, pages in searches():
        for page in range(1, pages + 1):
            params = {
                "app_id": settings.ADZUNA_APP_ID,
                "app_key": settings.ADZUNA_APP_KEY,
                "results_per_page": PER_PAGE,
                "max_days_old": 30,
                "sort_by": "date",
                "content-type": "application/json",
            }
            if phrase:
                params["what_phrase"] = phrase
            if city:
                params["where"] = city
            response = await client.get(f"{BASE}/{settings.ADZUNA_COUNTRY}/search/{page}", params=params)
            response.raise_for_status()
            for job in parse(response.json()):
                found[job.external_id] = job
    return list(found.values())
