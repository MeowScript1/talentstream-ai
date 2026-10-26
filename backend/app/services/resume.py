"""Server-side checks for uploaded resumes (the browser's checks can be bypassed)."""

import asyncio
import logging

import fitz  # PyMuPDF
from fastapi import HTTPException, UploadFile, status

logger = logging.getLogger(__name__)

MAX_RESUME_BYTES = 5 * 1024 * 1024  # 5 MB


def _extract_text(content: bytes) -> str:
    try:
        with fitz.open(stream=content, filetype="pdf") as doc:
            return "".join(page.get_text() for page in doc)
    except Exception:  # corrupt or encrypted PDFs raise assorted errors
        logger.warning("Could not parse uploaded PDF", exc_info=True)
        return ""


async def read_resume(file: UploadFile) -> tuple[bytes, str]:
    """Validate an uploaded resume and return (pdf_bytes, extracted_text).

    Raises HTTPException with a message that is safe to show to the candidate.
    """
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only PDF resumes are supported")

    # Read one byte past the limit so an oversized file is detected without loading all of it
    content = await file.read(MAX_RESUME_BYTES + 1)
    if len(content) > MAX_RESUME_BYTES:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "Resume must be 5 MB or smaller")
    if not content.startswith(b"%PDF-"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "That file is not a valid PDF")

    text = (await asyncio.to_thread(_extract_text, content)).strip()
    if not text:
        # Without text the AI can't score it, so the application would be stuck unscored
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "We couldn't read any text in this PDF. If it's a scan or image, export a text-based PDF instead.",
        )
    return content, text
