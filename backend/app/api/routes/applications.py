import uuid

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
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.ai_engine.ats import score_resume
from app.core.database import AsyncSessionLocal, get_db
from app.core.dependencies import get_current_user, require_role
from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from app.schemas.application import ApplicationResponse
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
        
        app.ats_score = ats_result['score']
        app.ats_summary = ats_result['summary']
        app.status = 'screening'
        
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
    await db.commit()
    await db.refresh(new_app)
    
    # Trigger ATS scoring in background
    background_tasks.add_task(run_ats_scoring, new_app.id)
        
    return new_app

@router.get("/mine")
async def get_my_applications(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("candidate"))
):
    query = select(Application).where(Application.candidate_id == current_user.id).order_by(Application.created_at.desc()).options(selectinload(Application.job))
    result = await db.execute(query)
    apps = result.scalars().all()
    
    # Need custom formatting to include job title easily
    response = []
    for app in apps:
        response.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": app.job.title,
            "employer_name": "Employer", # We'd need to join User here
            "status": app.status,
            "ats_score": app.ats_score,
            "created_at": app.created_at
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
    await db.commit()
    await db.refresh(app)
    return {"status": app.status}
