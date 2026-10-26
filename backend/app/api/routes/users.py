from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user, require_role
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserResponse
from app.services.resume import read_resume
from app.services.storage import StorageError, safe_filename, upload_profile_resume

router = APIRouter(prefix="/users", tags=["users"])


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ResumeInfo(BaseModel):
    filename: str
    updated_at: datetime
    url: str


@router.patch("/me", response_model=UserResponse)
async def update_profile(
    profile_data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user's profile fields."""
    if profile_data.full_name is not None:
        current_user.full_name = profile_data.full_name
    if profile_data.company_name is not None:
        current_user.company_name = profile_data.company_name
    if profile_data.avatar_url is not None:
        current_user.avatar_url = profile_data.avatar_url

    await db.commit()
    await db.refresh(current_user)
    return current_user


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    payload: PasswordChange,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Change the current user's password."""
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    if len(payload.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 8 characters",
        )

    current_user.password_hash = get_password_hash(payload.new_password)
    await db.commit()
    return None


def _resume_info(user: User) -> ResumeInfo:
    return ResumeInfo(filename=user.resume_filename, updated_at=user.resume_updated_at, url=user.resume_url)


@router.get("/me/resume", response_model=ResumeInfo)
async def get_my_resume(current_user: User = Depends(require_role("candidate"))):
    """The candidate's saved resume, if they have one."""
    if not current_user.resume_url:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No resume saved yet")
    return _resume_info(current_user)


@router.post("/me/resume", response_model=ResumeInfo)
async def upload_my_resume(
    resume: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("candidate")),
):
    """Save (or replace) the candidate's resume so it can be reused when applying."""
    content, text = await read_resume(resume)
    try:
        url = await upload_profile_resume(content, current_user.id, resume.filename)
    except StorageError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="We couldn't store your resume right now. Please try again in a moment.",
        ) from None

    current_user.resume_url = url
    current_user.resume_filename = safe_filename(resume.filename)
    current_user.resume_text = text
    current_user.resume_updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(current_user)
    return _resume_info(current_user)


@router.delete("/me/resume", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_resume(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("candidate")),
):
    """Forget the saved resume. Applications already submitted keep the file they used."""
    current_user.resume_url = None
    current_user.resume_filename = None
    current_user.resume_text = None
    current_user.resume_updated_at = None
    await db.commit()
    return None
