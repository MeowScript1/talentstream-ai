import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserBase(BaseModel):
    email: EmailStr
    full_name: str
    role: str = Field(pattern="^(employer|candidate)$")
    company_name: Optional[str] = None

class UserCreate(UserBase):
    password: str = Field(min_length=8)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(UserBase):
    id: uuid.UUID
    avatar_url: Optional[str] = None
    resume_filename: Optional[str] = None
    resume_updated_at: Optional[datetime] = None
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
