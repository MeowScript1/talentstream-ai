"""Interview practice for candidates: typical questions for a role, and feedback on a practice answer."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.ai_engine import practice
from app.core.dependencies import require_role
from app.models.user import User
from app.schemas.types import text

router = APIRouter(prefix="/practice", tags=["interview practice"])


class QuestionsIn(BaseModel):
    role: text(100, min_length=2)


class FeedbackIn(BaseModel):
    role: text(100, min_length=2)
    question: text(400, min_length=3)
    answer: text(2000, min_length=10)


def _busy() -> HTTPException:
    return HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="You have used today's practice allowance. Try again tomorrow.")


@router.post("/questions")
async def questions(body: QuestionsIn, user: User = Depends(require_role("candidate"))):
    try:
        return await practice.likely_questions(str(user.id), body.role)
    except practice.DailyLimitReached:
        raise _busy() from None


@router.post("/feedback")
async def feedback(body: FeedbackIn, user: User = Depends(require_role("candidate"))):
    try:
        return await practice.answer_feedback(str(user.id), body.role, body.question, body.answer)
    except practice.DailyLimitReached:
        raise _busy() from None
    except practice.PracticeUnavailable:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="AI feedback isn't available right now. Try again later.") from None
