import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.application import Application
from app.models.interview import Interview
from app.models.user import User

router = APIRouter(prefix="/interviews", tags=["interviews"])


@router.get("/{application_id}")
async def get_interview(
    application_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get interview details for a specific application."""
    query = select(Interview).where(Interview.application_id == application_id).options(
        selectinload(Interview.application).selectinload(Application.job)
    )
    result = await db.execute(query)
    interview = result.scalar_one_or_none()

    if not interview:
        raise HTTPException(status_code=404, detail="Interview not found")

    app = interview.application
    # Authorization: candidate must own the application, employer must own the job
    if current_user.role == 'candidate' and app.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == 'employer' and app.job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    return {
        "id": interview.id,
        "application_id": interview.application_id,
        "status": interview.status,
        "transcript": interview.transcript,
        "ai_score": interview.ai_score,
        "ai_feedback": interview.ai_feedback,
        "started_at": interview.started_at,
        "completed_at": interview.completed_at,
    }
