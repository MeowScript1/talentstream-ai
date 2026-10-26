import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class JobBase(BaseModel):
    title: str = Field(min_length=3, max_length=255)
    description: str = Field(min_length=10)
    requirements: List[str] = Field(min_items=1)
    location: Optional[str] = None
    job_type: str = Field(pattern="^(full_time|part_time|contract|remote)$")
    salary_range: Optional[str] = None
    ats_threshold: int = Field(default=65, ge=0, le=100)

class JobCreate(JobBase):
    pass

class JobUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    requirements: Optional[List[str]] = None
    location: Optional[str] = None
    job_type: Optional[str] = None
    salary_range: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(open|closed)$")
    ats_threshold: Optional[int] = None

class JobResponse(JobBase):
    id: uuid.UUID
    employer_id: uuid.UUID
    status: str
    created_at: datetime
    
    # We might include employer info lightly
    employer_name: Optional[str] = None

    class Config:
        from_attributes = True
