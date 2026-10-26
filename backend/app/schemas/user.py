import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.types import MAX_PASSWORD_LENGTH, text


class UserBase(BaseModel):
    email: EmailStr
    full_name: text(255, min_length=1)
    role: str = Field(pattern="^(employer|candidate)$")
    company_name: Optional[text(255)] = None

class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=MAX_PASSWORD_LENGTH)

class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(max_length=MAX_PASSWORD_LENGTH)

class UserResponse(BaseModel):
    # Plain types on purpose (see JobResponse): an older row must still be readable.
    id: uuid.UUID
    email: EmailStr
    full_name: str
    role: str
    company_name: Optional[str] = None
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
