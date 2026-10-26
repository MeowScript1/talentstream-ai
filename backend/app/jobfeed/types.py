from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class RawJob:
    """One job as returned by a source, already reduced to plain text."""

    source: str
    external_id: str
    title: str
    url: str
    company: str | None = None
    location: str | None = None
    description: str = ""
    posted_at: datetime | None = None
    salary_text: str | None = None
    tags: list[str] = field(default_factory=list)
    remote: bool | None = None
    # The source itself vouches for this listing (e.g. RemoteOK's "verified" flag)
    verified_by_source: bool = False
