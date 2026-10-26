import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field

from app.schemas.types import text


class JobBase(BaseModel):
    title: text(255, min_length=3)
    description: text(20_000, min_length=10)
    requirements: List[text(100, min_length=1)] = Field(min_length=1, max_length=50)
    location: Optional[text(255)] = None
    job_type: str = Field(pattern="^(full_time|part_time|contract|remote)$")
    salary_range: Optional[text(100)] = None
    ats_threshold: int = Field(default=65, ge=0, le=100)

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    title: Optional[text(255, min_length=3)] = None
    description: Optional[text(20_000, min_length=10)] = None
    requirements: Optional[List[text(100, min_length=1)]] = Field(None, min_length=1, max_length=50)
    location: Optional[text(255)] = None
    job_type: Optional[str] = Field(None, pattern="^(full_time|part_time|contract|remote)$")
    salary_range: Optional[text(100)] = None
    status: Optional[str] = Field(None, pattern="^(open|closed)$")
    ats_threshold: Optional[int] = Field(None, ge=0, le=100)

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
    
    # We might include employer info lightly
    employer_name: Optional[str] = None

    class Config:
        from_attributes = True
