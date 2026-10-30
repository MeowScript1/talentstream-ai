import uuid
from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import ENUM, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

application_status_enum = ENUM('applied', 'screening', 'interviewing', 'shortlisted', 'rejected', 'interview_completed', 'hr_round', 'hired', name='application_status_enum', create_type=False)

class Application(Base):
    __tablename__ = "applications"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), index=True)
    candidate_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resume_url: Mapped[str] = mapped_column(Text, nullable=False)
    resume_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    ats_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ats_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(application_status_enum, default='applied')
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # When the employer shortlisted or rejected (null while undecided, and for decisions made before this was recorded)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint('job_id', 'candidate_id', name='uq_application'),
    )

    # Relationships
    job = relationship("Job", backref="applications")
    candidate = relationship("User", backref="applications")
