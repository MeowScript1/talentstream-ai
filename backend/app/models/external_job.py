import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ExternalJob(Base):
    """A job collected from another platform's official API/feed (not posted on TalentStream)."""

    __tablename__ = "external_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    source: Mapped[str] = mapped_column(String(30), nullable=False)
    external_id: Mapped[str] = mapped_column(String(255), nullable=False)

    title: Mapped[str] = mapped_column(String(300), nullable=False)
    company: Mapped[str | None] = mapped_column(String(300), nullable=True)
    location: Mapped[str | None] = mapped_column(String(300), nullable=True)
    remote: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    url: Mapped[str] = mapped_column(Text, nullable=False)
    salary_text: Mapped[str | None] = mapped_column(String(120), nullable=True)
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    posted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # 'apply' = apply online on the source site, 'walkin' = in-person walk-in interview
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="apply")
    walkin_date: Mapped[date | None] = mapped_column(Date, nullable=True)  # first upcoming day
    walkin_dates: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    walkin_time: Mapped[str | None] = mapped_column(String(80), nullable=True)
    venue: Mapped[str | None] = mapped_column(Text, nullable=True)

    # How trustworthy the listing looks, and why (see app.jobfeed.trust)
    trust_score: Mapped[int] = mapped_column(Integer, nullable=False, default=50)
    trust_label: Mapped[str] = mapped_column(String(20), nullable=False, default="be_careful")
    trust_reasons: Mapped[list[dict]] = mapped_column(JSONB, nullable=False, default=list)

    report_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    dedupe_key: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_external_job_source_id"),
        Index("ix_external_jobs_feed", "is_active", "kind", "walkin_date"),
        Index("ix_external_jobs_dedupe", "dedupe_key"),
        Index("ix_external_jobs_posted_at", "posted_at"),
    )


class FeedSync(Base):
    """One row per source: when it was last pulled and how it went (also enforces polite polling)."""

    __tablename__ = "feed_sync"

    source: Mapped[str] = mapped_column(String(30), primary_key=True)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_ok_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)


class JobReport(Base):
    """A signed-in user flagging an external job as fake or misleading (one report per user per job)."""

    __tablename__ = "job_reports"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, server_default=func.gen_random_uuid())
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("external_jobs.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    reason: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (UniqueConstraint("job_id", "user_id", name="uq_job_report_once"),)
