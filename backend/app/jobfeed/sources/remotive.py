"""Remotive (https://remotive.com): remote jobs.

Terms (from their API notice): link back to the job's Remotive URL, name Remotive as the source,
don't hide listings behind a signup, and fetch at most about 4 times a day. Jobs arrive delayed 24h.
"""

from datetime import datetime, timezone

import httpx

from app.jobfeed.text import html_to_text
from app.jobfeed.types import RawJob

NAME = "remotive"
URL = "https://remotive.com/api/remote-jobs"


def _parse_time(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse(payload: dict) -> list[RawJob]:
    jobs = []
    for item in payload.get("jobs", []):
        if not item.get("id") or not item.get("title") or not item.get("url"):
            continue
        location = item.get("candidate_required_location") or "Remote"
        jobs.append(
            RawJob(
                source=NAME,
                external_id=str(item["id"]),
                title=item["title"].strip(),
                url=item["url"],  # must link back to Remotive
                company=(item.get("company_name") or "").strip() or None,
                location=location,
                description=html_to_text(item.get("description")),
                posted_at=_parse_time(item.get("publication_date")),
                salary_text=(item.get("salary") or "").strip() or None,
                tags=[str(t) for t in (item.get("tags") or [])][:8],
                remote=True,
            )
        )
    return jobs


async def fetch(client: httpx.AsyncClient) -> list[RawJob]:
    response = await client.get(URL, params={"limit": 200})
    response.raise_for_status()
    return parse(response.json())
