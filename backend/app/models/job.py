import uuid
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, ForeignKey, Integer, String, Text, Time, func
from sqlalchemy.dialects.postgresql import ENUM, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base

job_type_enum = ENUM('full_time', 'part_time', 'contract', 'remote', name='job_type_enum', create_type=False)
job_status_enum = ENUM('open', 'closed', name='job_status_enum', create_type=False)

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    employer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[list[str]] = mapped_column(JSONB, nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    job_type: Mapped[str] = mapped_column(job_type_enum, nullable=False)
    salary_range: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(job_status_enum, default='open', index=True)
    ats_threshold: Mapped[int] = mapped_column(Integer, default=65)
    # 'apply' = candidates apply online; 'walkin' = candidates just show up on the day
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="apply", server_default="apply")
    walkin_date: Mapped[date | None] = mapped_column(Date, nullable=True)          # first day
    walkin_end_date: Mapped[date | None] = mapped_column(Date, nullable=True)      # last day, if the drive spans several
    walkin_start_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    walkin_end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    venue: Mapped[str | None] = mapped_column(Text, nullable=True)
    walkin_notes: Mapped[str | None] = mapped_column(Text, nullable=True)           # what to bring, who to ask for
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    # Relationships
    employer = relationship("User", backref="jobs")
