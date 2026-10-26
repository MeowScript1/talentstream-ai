from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserResponse

router = APIRouter(prefix="/users", tags=["users"])


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    company_name: Optional[str] = None
    avatar_url: Optional[str] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


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
