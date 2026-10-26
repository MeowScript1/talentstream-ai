"""Resume file storage: Supabase Storage in production, local disk in development."""

import asyncio
import logging
import re
import uuid
from pathlib import Path

from app.core.config import settings
from app.core.supabase import get_supabase_client

logger = logging.getLogger(__name__)

# Same folder app.main serves at /api/v1/uploads/resumes
LOCAL_UPLOADS_DIR = Path(__file__).resolve().parents[2] / "uploads" / "resumes"
# ~10 years. The URL is stored with the application/profile, so it must outlive any normal expiry.
SIGNED_URL_SECONDS = 315360000


class StorageError(RuntimeError):
    """The file could not be stored or a URL for it could not be created."""


def safe_filename(name: str | None) -> str:
    """Basename only, with anything outside letters, digits, dot, dash and underscore replaced."""
    base = Path(name or "resume.pdf").name
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", base).strip("._") or "resume.pdf"
    return cleaned[-120:]


def _use_local_storage() -> bool:
    # Production startup already refuses to boot without Supabase settings,
    # so falling back to disk only ever happens in development.
    return settings.ENVIRONMENT != "production" and not (
        settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY
    )


async def _store(content: bytes, storage_path: str) -> str:
    """Save PDF bytes at storage_path and return a URL for it. Raises StorageError on failure."""
    if _use_local_storage():
        target = LOCAL_UPLOADS_DIR / storage_path
        target.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(target.write_bytes, content)
        return f"/api/v1/uploads/resumes/{storage_path}"

    bucket = settings.SUPABASE_STORAGE_BUCKET
    try:
        files = get_supabase_client().storage.from_(bucket)
        # supabase-py's client is synchronous, so keep it off the event loop
        await asyncio.to_thread(
            files.upload,
            path=storage_path,
            file=content,
            file_options={"content-type": "application/pdf", "upsert": "true"},
        )
        if settings.SUPABASE_STORAGE_BUCKET_PUBLIC:
            return files.get_public_url(storage_path)

        signed = await asyncio.to_thread(files.create_signed_url, storage_path, SIGNED_URL_SECONDS)
        # storage3 returns a dict in some versions and an object in others
        url = signed.get("signedURL") if isinstance(signed, dict) else getattr(signed, "signed_url", None)
        if not url:
            raise StorageError("Supabase returned no signed URL")
        return url
    except StorageError:
        raise
    except Exception as exc:
        logger.error("Resume storage failed for %s: %s", storage_path, exc)
        raise StorageError(str(exc)) from exc


async def upload_application_resume(
    content: bytes, candidate_id: uuid.UUID, job_id: uuid.UUID, filename: str | None
) -> str:
    return await _store(content, f"{candidate_id}/{job_id}/{safe_filename(filename)}")


async def upload_profile_resume(content: bytes, candidate_id: uuid.UUID, filename: str | None) -> str:
    # A unique name per upload: applications keep pointing at the exact file they used,
    # even after the candidate replaces their saved resume.
    return await _store(content, f"{candidate_id}/profile/{uuid.uuid4().hex[:12]}-{safe_filename(filename)}")
