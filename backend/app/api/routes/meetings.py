"""Details a person needs before joining their video interview (when it opens, who is on the other side, how to connect)."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.application import Application
from app.models.user import User
from app.models.video_interview import VideoInterview
from app.services.meetings import attendance_state, can_join, ice_servers, join_window

router = APIRouter(prefix="/meetings", tags=["video meetings"])


async def load_meeting(db: AsyncSession, application_id: uuid.UUID, user: User) -> tuple[Application, VideoInterview]:
    """The application and its scheduled interview, if this user is the candidate or the employer who owns the job."""
    app = (
        await db.execute(
            select(Application)
            .where(Application.id == application_id)
            .options(selectinload(Application.job), selectinload(Application.candidate))
        )
    ).scalar_one_or_none()
    if app is None or (app.candidate_id != user.id and app.job.employer_id != user.id):
        # Same answer for "no such meeting" and "not yours", so ids can't be probed
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Meeting not found")
    video = (await db.execute(select(VideoInterview).where(VideoInterview.application_id == app.id))).scalar_one_or_none()
    if video is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No video interview is scheduled")
    return app, video


@router.get("/{application_id}")
async def meeting_details(application_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    app, video = await load_meeting(db, application_id, user)
    opens, closes = join_window(video.scheduled_at)
    attendance = attendance_state(video.scheduled_at, video.candidate_joined_at, video.employer_joined_at)
    is_candidate = app.candidate_id == user.id
    employer = await db.get(User, app.job.employer_id)
    other_name = (employer.company_name or employer.full_name) if is_candidate else app.candidate.full_name
    return {
        "job_title": app.job.title,
        "other_name": other_name,
        "role": "candidate" if is_candidate else "employer",
        "scheduled_at": video.scheduled_at,
        "notes": video.notes,
        "opens_at": opens,
        "closes_at": closes,
        "can_join_now": can_join(video.scheduled_at, datetime.now(timezone.utc), attendance["state"]),
        **attendance,
        "ice_servers": ice_servers(),
    }
