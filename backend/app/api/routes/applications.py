import uuid
from datetime import datetime, timedelta, timezone

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.ai_engine.ats import score_resume
from app.core.database import AsyncSessionLocal, get_db
from app.core.dependencies import get_current_user, require_role
from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from app.models.video_interview import VideoInterview
from app.schemas.application import ApplicationResponse
from app.schemas.types import text
from app.services.resume import read_resume
from app.services.storage import StorageError, upload_application_resume

router = APIRouter(prefix="/applications", tags=["applications"])

async def run_ats_scoring(application_id: uuid.UUID):
    """Run ATS scoring in background with its own DB session."""
    async with AsyncSessionLocal() as db:
        query = select(Application).where(Application.id == application_id).options(selectinload(Application.job))
        result = await db.execute(query)
        app = result.scalar_one_or_none()
        
        if not app or not app.resume_text:
            return
            
        ats_result = await score_resume(
            resume_text=app.resume_text,
            job_title=app.job.title,
            job_description=app.job.description,
            requirements=app.job.requirements
        )
        
        app.ats_summary = ats_result['summary']
        app.status = 'screening'
        if ats_result.get('failed'):
            app.ats_score = None  # unscored, not zero: a failure must not look like a bad candidate
            await db.commit()
            return

        app.ats_score = ats_result['score']
        if app.ats_score >= app.job.ats_threshold:
            app.status = 'interviewing'
            
        await db.commit()

@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def submit_application(
    background_tasks: BackgroundTasks,
    job_id: uuid.UUID = Form(...),
    resume: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("candidate"))
):
    # Check if already applied
    query = select(Application).where(Application.job_id == job_id, Application.candidate_id == current_user.id)
    result = await db.execute(query)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="You have already applied to this job")

    # Check if job exists and is open
    job_query = select(Job).where(Job.id == job_id)
    job_result = await db.execute(job_query)
    job = job_result.scalar_one_or_none()
    
    if not job or job.status != 'open':
        raise HTTPException(status_code=400, detail="Job is not available")
    if job.kind != 'apply':
        raise HTTPException(status_code=400, detail="This is a walk-in drive: no application needed, just turn up on the day")

    if resume is not None and resume.filename:
        # A fresh file was sent: validate it and store it with this application
        content, resume_text = await read_resume(resume)
        try:
            resume_url = await upload_application_resume(content, current_user.id, job_id, resume.filename)
        except StorageError:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="We couldn't store your resume right now. Please try again in a moment.",
            ) from None
    elif current_user.resume_url and current_user.resume_text:
        # No file sent: reuse the resume saved on the candidate's profile
        resume_url = current_user.resume_url
        resume_text = current_user.resume_text
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Upload a resume, or save one on your profile first",
        )

    new_app = Application(
        job_id=job_id,
        candidate_id=current_user.id,
        resume_url=resume_url,
        resume_text=resume_text,
        status='applied'
    )
    
    db.add(new_app)
    try:
        await db.commit()
    except IntegrityError:
        # Two requests passed the "already applied?" check at the same moment (a double-click);
        # the unique constraint let exactly one through, so tell the other one the truth.
        await db.rollback()
        raise HTTPException(status_code=409, detail="You have already applied to this job") from None
    await db.refresh(new_app)
    
    # Trigger ATS scoring in background
    background_tasks.add_task(run_ats_scoring, new_app.id)
        
    return new_app

def _video_out(video: VideoInterview | None) -> dict | None:
    if video is None:
        return None
    return {"scheduled_at": video.scheduled_at, "notes": video.notes}


class VideoInterviewIn(BaseModel):
    scheduled_at: datetime
    notes: text(500) | None = None


async def _owned_application(app_id: uuid.UUID, db: AsyncSession, user: User) -> Application:
    """The application, if this user is the candidate or the employer who owns the job."""
    app = (
        await db.execute(select(Application).where(Application.id == app_id).options(selectinload(Application.job)))
    ).scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    if user.role == "candidate" and app.candidate_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if user.role == "employer" and app.job.employer_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return app


@router.get("/{app_id}/video-interview")
async def get_video_interview(
    app_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)
):
    app = await _owned_application(app_id, db, current_user)
    video = (await db.execute(select(VideoInterview).where(VideoInterview.application_id == app.id))).scalar_one_or_none()
    return _video_out(video)


# Interviews are assumed to take about half an hour when checking whether two of them overlap
OVERLAP_MINUTES = 30


@router.get("/{app_id}/video-interview/conflicts")
async def video_interview_conflicts(
    app_id: uuid.UUID,
    scheduled_at: datetime,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer")),
):
    """Other interviews of this employer that would overlap a proposed time. Only a warning: scheduling is still allowed."""
    app = await _owned_application(app_id, db, current_user)
    when = scheduled_at if scheduled_at.tzinfo else scheduled_at.replace(tzinfo=timezone.utc)
    gap = timedelta(minutes=OVERLAP_MINUTES)
    rows = (
        await db.execute(
            select(VideoInterview, Job.title, User.full_name)
            .join(Application, Application.id == VideoInterview.application_id)
            .join(Job, Job.id == Application.job_id)
            .join(User, User.id == Application.candidate_id)
            .where(
                Job.employer_id == current_user.id,
                VideoInterview.application_id != app.id,
                VideoInterview.scheduled_at > when - gap,
                VideoInterview.scheduled_at < when + gap,
            )
            .order_by(VideoInterview.scheduled_at)
        )
    ).all()
    return {
        "conflicts": [{"candidate_name": name, "job_title": title, "scheduled_at": video.scheduled_at} for video, title, name in rows]
    }


@router.put("/{app_id}/video-interview")
async def schedule_video_interview(
    app_id: uuid.UUID,
    body: VideoInterviewIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer")),
):
    """Set (or change) the time of a live video interview. The room is inside TalentStream, so there is no link to paste."""
    app = await _owned_application(app_id, db, current_user)
    if app.status == "rejected":
        raise HTTPException(status_code=400, detail="This application was rejected, so a video interview can't be scheduled")
    when = body.scheduled_at if body.scheduled_at.tzinfo else body.scheduled_at.replace(tzinfo=timezone.utc)
    if when <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Pick a time in the future")

    video = (await db.execute(select(VideoInterview).where(VideoInterview.application_id == app.id))).scalar_one_or_none()
    if video is None:
        video = VideoInterview(application_id=app.id, scheduled_at=when, notes=body.notes or None)
        db.add(video)
    else:
        video.scheduled_at, video.notes = when, body.notes or None
    if app.decided_at is None:
        app.decided_at = datetime.now(timezone.utc)  # setting up a meeting is an answer to the candidate
    await db.commit()
    return _video_out(video)


@router.delete("/{app_id}/video-interview", status_code=204)
async def cancel_video_interview(
    app_id: uuid.UUID, db: AsyncSession = Depends(get_db), current_user: User = Depends(require_role("employer"))
):
    app = await _owned_application(app_id, db, current_user)
    video = (await db.execute(select(VideoInterview).where(VideoInterview.application_id == app.id))).scalar_one_or_none()
    if video is not None:
        await db.delete(video)
        await db.commit()


@router.get("/mine")
async def get_my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("candidate"))
):
    query = select(Application).where(Application.candidate_id == current_user.id).order_by(Application.created_at.desc()).options(selectinload(Application.job).selectinload(Job.employer))
    result = await db.execute(query)
    apps = result.scalars().all()
    
    videos = {
        v.application_id: v
        for v in (
            await db.execute(select(VideoInterview).where(VideoInterview.application_id.in_([a.id for a in apps])))
        ).scalars().all()
    } if apps else {}

    # Need custom formatting to include job title easily
    response = []
    for app in apps:
        response.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": app.job.title,
            "employer_name": app.job.employer.company_name or app.job.employer.full_name,
            "status": app.status,
            "ats_score": app.ats_score,
            "created_at": app.created_at,
            "video_interview": _video_out(videos.get(app.id)),
        })
    return response

@router.get("/{app_id}")
async def get_application(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = select(Application).where(Application.id == app_id).options(
        selectinload(Application.job),
        selectinload(Application.candidate)
    )
    result = await db.execute(query)
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    # Check authorization: must be owner candidate or the job's employer
    if current_user.role == 'candidate' and app.candidate_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if current_user.role == 'employer' and app.job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    return {
        "id": app.id,
        "job_id": app.job_id,
        "job_title": app.job.title,
        "employer_name": app.job.employer_id,  # placeholder
        "candidate_id": app.candidate_id,
        "candidate_name": app.candidate.full_name,
        "resume_url": app.resume_url,
        "ats_score": app.ats_score,
        "ats_summary": app.ats_summary,
        "status": app.status,
        "created_at": app.created_at
    }

@router.post("/{app_id}/rescore")
async def rescore_application(
    app_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer"))
):
    """Trigger ATS re-scoring for a specific application (employer only)."""
    query = select(Application).where(Application.id == app_id).options(selectinload(Application.job))
    result = await db.execute(query)
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if app.job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if not app.resume_text:
        raise HTTPException(status_code=400, detail="No resume text available for scoring")
    
    # Reset score to indicate re-scoring in progress
    app.ats_score = None
    app.ats_summary = None
    await db.commit()
    
    # Trigger re-scoring in background
    background_tasks.add_task(run_ats_scoring, app.id)
    
    return {"message": "Re-scoring started", "application_id": str(app.id)}

@router.patch("/{app_id}/status")
async def update_application_status(
    app_id: uuid.UUID,
    status_update: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer"))
):
    new_status = status_update.get('status')
    if new_status not in ['shortlisted', 'rejected']:
        raise HTTPException(status_code=400, detail="Invalid status")
        
    query = select(Application).where(Application.id == app_id).options(selectinload(Application.job))
    result = await db.execute(query)
    app = result.scalar_one_or_none()
    
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
        
    if app.job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    app.status = new_status
    if app.decided_at is None:
        app.decided_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(app)
    return {"status": app.status}
