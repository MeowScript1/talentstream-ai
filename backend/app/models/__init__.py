# Import every model here so Base.metadata knows about all tables (Alembic relies on this).
from app.models.alert import WalkinAlert
from app.models.application import Application
from app.models.base import Base
from app.models.external_job import ExternalJob, FeedSync, JobReport
from app.models.interview import Interview
from app.models.job import Job
from app.models.user import User
from app.models.video_interview import VideoInterview

__all__ = ["Application", "Base", "ExternalJob", "FeedSync", "Interview", "Job", "JobReport", "User", "VideoInterview", "WalkinAlert"]
