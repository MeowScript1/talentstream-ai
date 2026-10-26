"""
Redis is an optional accelerator here (job-list cache + rate limiter), never a
hard dependency. When it is unreachable the app keeps serving from Postgres,
and after a failure we stop trying for a short cooldown so a dead Redis does
not add a connect timeout to every request.
"""

import logging
import time

import redis.asyncio as redis

from app.core.config import settings

logger = logging.getLogger(__name__)

# Seconds to skip Redis after a failure before trying again.
COOLDOWN_SECONDS = 30
# Keep timeouts short: an unreachable host must not stall requests.
SOCKET_TIMEOUT_SECONDS = 2

# Global redis connection pool
redis_client: redis.Redis | None = None
_skip_until: float = 0.0


def _build_client() -> redis.Redis:
    url = settings.REDIS_URL
    kwargs = dict(
        decode_responses=True,
        socket_connect_timeout=SOCKET_TIMEOUT_SECONDS,
        socket_timeout=SOCKET_TIMEOUT_SECONDS,
    )
    # redis.from_url handles both redis:// and rediss:// (TLS for Upstash)
    # ssl_cert_reqs=None disables cert validation for managed cloud Redis
    if url.startswith("rediss://"):
        kwargs["ssl_cert_reqs"] = None
    return redis.from_url(url, **kwargs)


def report_redis_failure() -> None:
    """Call when a Redis command fails; pauses Redis use for COOLDOWN_SECONDS."""
    global _skip_until
    _skip_until = time.monotonic() + COOLDOWN_SECONDS


def redis_in_cooldown() -> bool:
    return time.monotonic() < _skip_until


async def init_redis() -> bool:
    """Create the client and check it. Returns True if Redis answered.

    A failure is logged and tolerated: the client is kept so it can recover
    once Redis is back, but requests skip it during the cooldown.
    """
    global redis_client
    if redis_client is None:
        redis_client = _build_client()
    try:
        await redis_client.ping()
        return True
    except Exception as exc:
        report_redis_failure()
        logger.warning(
            "Redis unavailable (%s) - caching and rate limiting are disabled until it recovers",
            type(exc).__name__,
        )
        return False


async def get_redis() -> redis.Redis | None:
    """FastAPI dependency. Returns None while Redis is down; callers must handle that."""
    if redis_in_cooldown():
        return None
    if redis_client is None:
        await init_redis()
        if redis_in_cooldown():
            return None
    return redis_client


async def close_redis() -> None:
    if redis_client:
        await redis_client.aclose()
