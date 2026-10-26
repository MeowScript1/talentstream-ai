import uuid
from datetime import date, datetime, time, timedelta
from typing import List, Optional

from pydantic import BaseModel, Field, model_validator

from app.core.timeutil import local_today
from app.schemas.types import text

# How far ahead a walk-in drive may be announced, and how long one drive may run
MAX_WALKIN_DAYS_AHEAD = 90
MAX_WALKIN_SPAN_DAYS = 14


class JobBase(BaseModel):
    title: text(255, min_length=3)
    description: text(20_000, min_length=10)
    requirements: List[text(100, min_length=1)] = Field(min_length=1, max_length=50)
    location: Optional[text(255)] = None
    job_type: str = Field(pattern="^(full_time|part_time|contract|remote)$")
    salary_range: Optional[text(100)] = None
    ats_threshold: int = Field(default=65, ge=0, le=100)
    # 'apply' = candidates apply online, 'walkin' = candidates just show up on the day
    kind: str = Field(default="apply", pattern="^(apply|walkin)$")
    walkin_date: Optional[date] = None
    walkin_end_date: Optional[date] = None
    walkin_start_time: Optional[time] = None
    walkin_end_time: Optional[time] = None
    venue: Optional[text(500)] = None
    walkin_notes: Optional[text(1000)] = None


def check_walkin_fields(
    walkin_date: date | None, walkin_end_date: date | None, start: time | None, end: time | None, venue: str | None
) -> None:
    """Everything a candidate needs to actually turn up: when, from what time, and where."""
    missing = [n for n, v in (("a date", walkin_date), ("a start time", start), ("a venue", venue)) if not v]
    if missing:
        raise ValueError(f"A walk-in drive needs {', '.join(missing)}")
    if len(venue.strip()) < 8:
        raise ValueError("Please give the full venue address so candidates can find it")
    today = local_today()
    if walkin_date < today:
        raise ValueError("The walk-in date can't be in the past")
    if walkin_date > today + timedelta(days=MAX_WALKIN_DAYS_AHEAD):
        raise ValueError(f"Walk-in drives can be announced up to {MAX_WALKIN_DAYS_AHEAD} days ahead")
    if walkin_end_date is not None:
        if walkin_end_date < walkin_date:
            raise ValueError("The last day can't be before the first day")
        if (walkin_end_date - walkin_date).days > MAX_WALKIN_SPAN_DAYS:
            raise ValueError(f"A drive can run for at most {MAX_WALKIN_SPAN_DAYS + 1} days")
    if end is not None and end <= start:
        raise ValueError("The end time must be after the start time")


class JobCreate(JobBase):
    @model_validator(mode="after")
    def _walkin_needs_details(self):
        if self.kind == "walkin":
            check_walkin_fields(self.walkin_date, self.walkin_end_date, self.walkin_start_time, self.walkin_end_time, self.venue)
        else:
            # An online job carries no walk-in details
            self.walkin_date = self.walkin_end_date = self.walkin_start_time = self.walkin_end_time = None
            self.venue = self.walkin_notes = None
        return self

class JobUpdate(BaseModel):
    title: Optional[text(255, min_length=3)] = None
    description: Optional[text(20_000, min_length=10)] = None
    requirements: Optional[List[text(100, min_length=1)]] = Field(None, min_length=1, max_length=50)
    location: Optional[text(255)] = None
    job_type: Optional[str] = Field(None, pattern="^(full_time|part_time|contract|remote)$")
    salary_range: Optional[text(100)] = None
    status: Optional[str] = Field(None, pattern="^(open|closed)$")
    ats_threshold: Optional[int] = Field(None, ge=0, le=100)
    walkin_date: Optional[date] = None
    walkin_end_date: Optional[date] = None
    walkin_start_time: Optional[time] = None
    walkin_end_time: Optional[time] = None
    venue: Optional[text(500)] = None
    walkin_notes: Optional[text(1000)] = None

class JobResponse(BaseModel):
    # Deliberately NOT built on JobBase: those limits are for what we accept. Reading must never be
    # stricter than writing, or a single older row that predates a limit would break the whole list.
    id: uuid.UUID
    employer_id: uuid.UUID
    title: str
    description: str
    requirements: List[str]
    location: Optional[str] = None
    job_type: str
    salary_range: Optional[str] = None
    ats_threshold: int
    status: str
    created_at: datetime
    kind: str = "apply"
    walkin_date: Optional[date] = None
    walkin_end_date: Optional[date] = None
    walkin_start_time: Optional[time] = None
    walkin_end_time: Optional[time] = None
    venue: Optional[str] = None
    walkin_notes: Optional[str] = None
    
    # We might include employer info lightly
    employer_name: Optional[str] = None

    class Config:
        from_attributes = True
