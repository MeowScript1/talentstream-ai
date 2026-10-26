import uuid
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel


class ApplicationBase(BaseModel):
    job_id: uuid.UUID

class ApplicationCreate(ApplicationBase):
    pass

class AtsResult(BaseModel):
    score: int
    skills_matched: List[str]
    skills_missing: List[str]
    summary: str
    candidate_feedback: str

class ApplicationResponse(ApplicationBase):
    id: uuid.UUID
    candidate_id: uuid.UUID
    resume_url: str
    ats_score: Optional[int] = None
    ats_summary: Optional[str] = None
    status: str
    created_at: datetime
    
    # AI Output fields if available (can be parsed from a JSON column if we stored it, 
    # but the schema expects it if needed. We'll leave it as flat for now.)
    
    class Config:
        from_attributes = True
