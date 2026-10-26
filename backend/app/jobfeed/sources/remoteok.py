"""Remote OK (https://remoteok.com): remote jobs.

Terms (from their API notice): link back to the job's Remote OK URL with a normal (followed) link
and name Remote OK as the source. Their logo is a registered trademark, so we only use the name.
"""

from datetime import datetime

import httpx

from app.jobfeed.text import html_to_text
from app.jobfeed.types import RawJob

NAME = "remoteok"
URL = "https://remoteok.com/api"


def _salary(item: dict) -> str | None:
    low, high = int(item.get("salary_min") or 0), int(item.get("salary_max") or 0)
    if low and high:
        return f"${low:,} – ${high:,}"
    return None


def parse(payload: list) -> list[RawJob]:
    jobs = []
    for item in payload:
        # The first element is a legal notice, not a job
        if not isinstance(item, dict) or "legal" in item or not item.get("id"):
            continue
        title = (item.get("position") or "").strip()
        url = item.get("url") or item.get("apply_url")
        if not title or not url:
            continue
        posted = None
        if item.get("date"):
            try:
                posted = datetime.fromisoformat(item["date"])
            except ValueError:
                posted = None
        jobs.append(
            RawJob(
                source=NAME,
                external_id=str(item["id"]),
                title=title,
                url=url,  # must link back to Remote OK
                company=(item.get("company") or "").strip() or None,
                location=(item.get("location") or "").strip() or "Remote",
                description=html_to_text(item.get("description")),
                posted_at=posted,
                salary_text=_salary(item),
                tags=[str(t) for t in (item.get("tags") or [])][:8],
                remote=True,
                verified_by_source=bool(item.get("verified")),
            )
        )
    return jobs


async def fetch(client: httpx.AsyncClient) -> list[RawJob]:
    response = await client.get(URL)
    response.raise_for_status()
    return parse(response.json())
