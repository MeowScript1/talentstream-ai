"""
Health, readiness, and liveness endpoints.

  GET /health  — basic liveness (always 200 while the process runs)
  GET /live    — alias for /health (Kubernetes/Render liveness probe)
  GET /ready   — deep readiness: PostgreSQL + Supabase URL must pass; Redis is reported but optional
"""

import logging

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

logger = logging.getLogger(__name__)

router = APIRouter(tags=["monitoring"])


@router.get("/health", summary="Liveness probe")
async def health() -> dict:
    """Returns immediately — confirms the process is alive."""
    return {"status": "ok"}


@router.get("/live", summary="Liveness probe (alias)")
async def liveness() -> dict:
    """Alias of /health for tools that prefer /live."""
    return {"status": "ok"}


@router.get("/ready", summary="Readiness probe")
async def readiness() -> JSONResponse:
    """
    Checks that all downstream dependencies are reachable.
    Returns 200 when all checks pass, 503 when any check fails.
    """
    checks: dict[str, str] = {}
    healthy = True

    # ------------------------------------------------------------------
    # PostgreSQL
    # ------------------------------------------------------------------
    try:
        from app.core.database import engine  # noqa: PLC0415

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        checks["postgres"] = "ok"
    except Exception as exc:
        logger.error("Readiness: postgres check failed", exc_info=exc)
        checks["postgres"] = f"error: {type(exc).__name__}"
        healthy = False

    # ------------------------------------------------------------------
    # Redis
    # ------------------------------------------------------------------
    # Redis only backs the job-list cache and rate limiter, and the app fails
    # open without it, so an outage is reported but does not fail readiness.
    try:
        from app.core.redis import redis_client  # noqa: PLC0415

        if redis_client is None:
            raise RuntimeError("Redis client not initialised")
        await redis_client.ping()
        checks["redis"] = "ok"
    except Exception as exc:
        logger.warning("Readiness: redis unavailable (optional): %s", type(exc).__name__)
        checks["redis"] = f"unavailable (optional): {type(exc).__name__}"

    # ------------------------------------------------------------------
    # Supabase URL reachable
    # ------------------------------------------------------------------
    try:
        from app.core.config import settings  # noqa: PLC0415

        if settings.SUPABASE_URL:
            async with httpx.AsyncClient(timeout=5) as client:
                resp = await client.get(f"{settings.SUPABASE_URL}/rest/v1/")
                # 200 or 401 both mean the server is reachable
                if resp.status_code < 500:
                    checks["supabase"] = "ok"
                else:
                    raise RuntimeError(f"HTTP {resp.status_code}")
        else:
            checks["supabase"] = "not_configured"
    except Exception as exc:
        logger.error("Readiness: supabase check failed", exc_info=exc)
        checks["supabase"] = f"error: {type(exc).__name__}"
        healthy = False

    status_code = 200 if healthy else 503
    return JSONResponse(
        status_code=status_code,
        content={"status": "ok" if healthy else "degraded", "checks": checks},
    )
