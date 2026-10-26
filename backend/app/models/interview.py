import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

interview_status_enum = ENUM('pending', 'in_progress', 'completed', name='interview_status_enum', create_type=False)

class Interview(Base):
    __tablename__ = "interviews"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    application_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("applications.id", ondelete="CASCADE"), unique=True)
    status: Mapped[str] = mapped_column(interview_status_enum, default='pending')
    transcript: Mapped[list[dict]] = mapped_column(JSON, default=list)
    ai_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ai_feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    interview_verdict: Mapped[str | None] = mapped_column(String(20), nullable=True)  # 'pass', 'fail', 'pending'
    candidate_consented_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    application = relationship("Application", backref="interview")
