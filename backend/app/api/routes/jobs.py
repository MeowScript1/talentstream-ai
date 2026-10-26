import json
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import require_role
from app.core.redis import get_redis, report_redis_failure
from app.jobfeed.trust import looks_like_fee_request
from app.models.application import Application
from app.models.job import Job
from app.models.user import User
from app.schemas.job import JobCreate, JobResponse, JobUpdate, check_walkin_fields

router = APIRouter(prefix="/jobs", tags=["jobs"])

NO_FEES_MESSAGE = (
    "Job posts can't ask candidates for money (registration fees, deposits, kits...). "
    "Please remove that wording. Genuine employers never charge to hire."
)


def _reject_fee_requests(*texts: str | None) -> None:
    # Scammers can register as employers too, so refuse the classic "pay a fee to get the job" post
    if any(t and looks_like_fee_request(t) for t in texts):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=NO_FEES_MESSAGE)

async def _invalidate_jobs_cache(redis_client):
    """Delete all cached job listing keys using SCAN to avoid missing any."""
    if redis_client is None:
        return
    try:
        cursor = 0
        while True:
            cursor, keys = await redis_client.scan(cursor=cursor, match="jobs:open:*", count=100)
            if keys:
                await redis_client.delete(*keys)
            if cursor == 0:
                break
    except Exception:
        # If Redis is unavailable, continue — the DB is the source of truth
        report_redis_failure()

@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    job_data: JobCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer")),
    redis_client = Depends(get_redis)
):
    _reject_fee_requests(job_data.title, job_data.description, job_data.walkin_notes, *job_data.requirements)
    new_job = Job(**job_data.model_dump(), employer_id=current_user.id)
    db.add(new_job)
    await db.commit()
    await db.refresh(new_job)
    
    # Invalidate all cached job listings
    await _invalidate_jobs_cache(redis_client)
    
    job_resp = JobResponse.model_validate(new_job)
    job_resp.employer_name = current_user.company_name or current_user.full_name
    return job_resp

@router.get("", response_model=List[JobResponse])
async def list_jobs(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    redis_client = Depends(get_redis)
):
    # Only use cache for unfiltered queries
    cache_key = f"jobs:open:page:{page}:limit:{limit}"
    use_cache = redis_client is not None and not search and not job_type
    if use_cache:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception:
            report_redis_failure()
        
    offset = (page - 1) * limit
    query = select(Job).where(Job.status == 'open', Job.kind == 'apply').options(selectinload(Job.employer))
    
    # Apply server-side search filter
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Job.title.ilike(search_term),
                Job.location.ilike(search_term),
                Job.description.ilike(search_term),
                User.company_name.ilike(search_term),
                User.full_name.ilike(search_term),
            )
        ).join(User, Job.employer_id == User.id)
    
    # Apply job type filter
    if job_type:
        query = query.where(Job.job_type == job_type)
    
    query = query.order_by(Job.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(query)
    jobs = result.unique().scalars().all()
    
    response_data = []
    for job in jobs:
        j = JobResponse.model_validate(job)
        j.employer_name = job.employer.company_name or job.employer.full_name
        response_data.append(j.model_dump(mode='json'))
    
    # Only cache unfiltered results, with a short TTL
    if use_cache:
        try:
            await redis_client.setex(cache_key, 10, json.dumps(response_data))
        except Exception:
            report_redis_failure()
    return response_data

@router.get("/mine", response_model=List[JobResponse])
async def my_jobs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer"))
):
    query = select(Job).where(Job.employer_id == current_user.id).order_by(Job.created_at.desc())
    result = await db.execute(query)
    jobs = result.scalars().all()
    
    response_data = []
    for job in jobs:
        j = JobResponse.model_validate(job)
        j.employer_name = current_user.company_name or current_user.full_name
        response_data.append(j)
    return response_data

@router.get("/{job_id}", response_model=JobResponse)
async def get_job(job_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    query = select(Job).where(Job.id == job_id).options(selectinload(Job.employer))
    result = await db.execute(query)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
        
    j = JobResponse.model_validate(job)
    j.employer_name = job.employer.company_name or job.employer.full_name
    return j

@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: uuid.UUID,
    job_data: JobUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer")),
    redis_client = Depends(get_redis)
):
    query = select(Job).where(Job.id == job_id)
    result = await db.execute(query)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to edit this job")
        
    update_data = job_data.model_dump(exclude_unset=True)
    _reject_fee_requests(
        update_data.get("title"), update_data.get("description"), update_data.get("walkin_notes"), *(update_data.get("requirements") or [])
    )
    for key, value in update_data.items():
        setattr(job, key, value)

    if job.kind == "walkin" and any(k.startswith("walkin_") or k == "venue" for k in update_data):
        try:
            check_walkin_fields(job.walkin_date, job.walkin_end_date, job.walkin_start_time, job.walkin_end_time, job.venue)
        except ValueError as exc:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from None

    await db.commit()
    await db.refresh(job)
    
    await _invalidate_jobs_cache(redis_client)
    
    j = JobResponse.model_validate(job)
    j.employer_name = current_user.company_name or current_user.full_name
    return j

@router.delete("/{job_id}/close", status_code=status.HTTP_204_NO_CONTENT)
async def close_job(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer")),
    redis_client = Depends(get_redis)
):
    query = select(Job).where(Job.id == job_id)
    result = await db.execute(query)
    job = result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to close this job")
        
    job.status = 'closed'
    await db.commit()
    
    await _invalidate_jobs_cache(redis_client)
    return None

@router.get("/{job_id}/applications")
async def get_job_applications(
    job_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("employer"))
):
    """Get all applications for a specific job (employer only)"""
    # Verify job ownership
    job_query = select(Job).where(Job.id == job_id)
    job_result = await db.execute(job_query)
    job = job_result.scalar_one_or_none()
    
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if job.employer_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = select(Application).where(Application.job_id == job_id).order_by(
        Application.ats_score.desc().nulls_last()
    ).options(selectinload(Application.candidate))
    result = await db.execute(query)
    apps = result.scalars().all()
    
    return [
        {
            "id": app.id,
            "job_id": app.job_id,
            "job_title": job.title,
            "employer_name": current_user.company_name or current_user.full_name,
            "candidate_id": app.candidate_id,
            "candidate_name": app.candidate.full_name,
            "resume_url": app.resume_url,
            "ats_score": app.ats_score,
            "ats_summary": app.ats_summary,
            "status": app.status,
            "created_at": app.created_at
        }
        for app in apps
    ]
