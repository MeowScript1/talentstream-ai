"""
Application entry point.

Middleware stack (outermost → innermost):
  TrustedHostMiddleware   — reject requests with unknown Host headers (prod)
  GZipMiddleware          — compress responses ≥ 1 KB
  RequestIDMiddleware     — assign UUID to every request
  SecurityHeadersMiddleware — OWASP headers
  RateLimitMiddleware     — Redis sliding-window 100 req/min
  CORSMiddleware          — origins driven by settings
"""

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.core.config import settings
from app.core.logging import setup_logging
from app.core.middleware import RateLimitMiddleware, RequestIDMiddleware, SecurityHeadersMiddleware
from app.core.redis import close_redis, init_redis

# ── Configure JSON logging before anything else ─────────────────────────────
setup_logging(level=settings.LOG_LEVEL)
logger = logging.getLogger(__name__)

# ── Ensure uploads directory exists ─────────────────────────────────────────
UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads" / "resumes"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)


# ── Lifespan ─────────────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up — environment=%s", settings.ENVIRONMENT)
    if await init_redis():
        logger.info("Redis connected")
    yield
    logger.info("Shutting down")
    await close_redis()


# ── Application ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="7-Day Interview AI",
    description="AI-powered automated hiring platform",
    version="1.0.0",
    lifespan=lifespan,
    # Disable docs in production
    docs_url=None if settings.ENVIRONMENT == "production" else "/docs",
    redoc_url=None if settings.ENVIRONMENT == "production" else "/redoc",
)

# ── Middleware (registered in reverse order — last added = outermost) ────────

# 1. Trusted hosts (production only — avoids Host header injection)
if settings.ENVIRONMENT == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=[
            "*.onrender.com",
            "localhost",
        ],
    )

# 2. GZip — compress responses larger than 1 KB
app.add_middleware(GZipMiddleware, minimum_size=1024)

# 3. Request ID — must be before rate limiter so rate limit logs carry request_id
app.add_middleware(RequestIDMiddleware)

# 4. Security headers
app.add_middleware(SecurityHeadersMiddleware)

# 5. Rate limiting (100 req/min per IP)
app.add_middleware(RateLimitMiddleware, max_requests=100, window_seconds=60)

# 6. CORS — dynamic origins from settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

logger.info("CORS origins configured: %s", settings.CORS_ORIGINS)

# ── Static files ─────────────────────────────────────────────────────────────
app.mount(
    "/api/v1/uploads/resumes",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="resumes",
)

# ── Validation error handler ──────────────────────────────────────────────────
FIELD_LABELS = {
    "email": "Email",
    "password": "Password",
    "full_name": "Full Name",
    "role": "Role",
    "company_name": "Company Name",
}


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = []
    for error in exc.errors():
        field = error.get("loc", [])[-1] if error.get("loc") else "input"
        label = FIELD_LABELS.get(str(field), str(field).replace("_", " ").title())
        msg = error.get("msg", "Invalid value")
        errors.append(
            {"loc": error.get("loc", []), "msg": f"{label}: {msg}", "type": error.get("type", "")}
        )
    return JSONResponse(status_code=422, content={"detail": errors})


# ── Routers ───────────────────────────────────────────────────────────────────
from app.api.routes import auth, jobs, applications, interviews, users  # noqa: E402
from app.api.routes.health import router as health_router               # noqa: E402
from app.api.websockets import interview                                  # noqa: E402

# Health endpoints at root (no /api/v1 prefix — Render probe hits /health)
app.include_router(health_router)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(jobs.router, prefix="/api/v1")
app.include_router(applications.router, prefix="/api/v1")
app.include_router(interviews.router, prefix="/api/v1")
app.include_router(interview.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
