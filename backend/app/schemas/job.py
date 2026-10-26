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

class JobResponse(JobBase):
    id: uuid.UUID
    employer_id: uuid.UUID
    status: str
    created_at: datetime
    
    # We might include employer info lightly
    employer_name: Optional[str] = None

    class Config:
        from_attributes = True
