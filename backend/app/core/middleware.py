"""
Custom Starlette middleware:
  - RequestIDMiddleware   — assigns a UUID to every request, exposes X-Request-ID
  - SecurityHeadersMiddleware — adds OWASP-recommended security headers
  - RateLimitMiddleware   — Redis sliding-window rate limiter per IP
"""

import logging
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response
from starlette.types import ASGIApp

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Request ID
# ---------------------------------------------------------------------------

class RequestIDMiddleware(BaseHTTPMiddleware):
    """Generates a UUID for every request and exposes it as X-Request-ID."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response


# ---------------------------------------------------------------------------
# Security Headers
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds OWASP-recommended security headers to every response."""

    _HEADERS = {
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
        # HSTS — 1 year, include subdomains
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    }

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        for header, value in self._HEADERS.items():
            response.headers[header] = value
        return response


# ---------------------------------------------------------------------------
# Rate Limiting (Redis sliding-window)
# ---------------------------------------------------------------------------

class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Sliding-window rate limiter backed by Redis.
    Limits by client IP. Health-check paths are exempt.

    Parameters
    ----------
    max_requests : int
        Maximum requests allowed in the window (default 100).
    window_seconds : int
        Window length in seconds (default 60 → 100 req/min).
    exempt_paths : set[str]
        Paths that bypass rate limiting (default: health endpoints).
    """

    def __init__(
        self,
        app: ASGIApp,
        max_requests: int = 100,
        window_seconds: int = 60,
        exempt_paths: set[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.exempt_paths: set[str] = exempt_paths or {"/health", "/ready", "/live"}

    def _get_client_ip(self, request: Request) -> str:
        # Respect X-Forwarded-For from Render's load balancer
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        if request.url.path in self.exempt_paths:
            return await call_next(request)

        # Lazy import to avoid circular dependency; redis is initialised by lifespan
        from app.core import redis as redis_module  # noqa: PLC0415

        redis_client = redis_module.redis_client
        if redis_client is None or redis_module.redis_in_cooldown():
            # Redis not ready or recently failing — allow the request through
            return await call_next(request)

        ip = self._get_client_ip(request)
        now = int(time.time())
        window_start = now - self.window_seconds
        key = f"rate_limit:{ip}"

        # Only the Redis calls sit inside the try. call_next must stay outside it,
        # otherwise an error raised by the endpoint would be mistaken for a Redis
        # failure and the request would be executed a second time.
        try:
            pipe = redis_client.pipeline()
            # Remove counts outside the window
            await pipe.zremrangebyscore(key, 0, window_start)
            # Count requests in window
            await pipe.zcard(key)
            # Add current request
            await pipe.zadd(key, {str(uuid.uuid4()): now})
            # Reset TTL
            await pipe.expire(key, self.window_seconds * 2)
            results = await pipe.execute()
            request_count: int = results[1]
        except Exception:  # Redis failure — fail open (don't block traffic)
            redis_module.report_redis_failure()
            logger.warning("Rate limiter redis error — allowing request through", exc_info=True)
            return await call_next(request)

        if request_count >= self.max_requests:
            logger.warning(
                "Rate limit exceeded",
                extra={"ip": ip, "count": request_count, "limit": self.max_requests},
            )
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "Too many requests. Please slow down.",
                    "retry_after": self.window_seconds,
                },
                headers={
                    "Retry-After": str(self.window_seconds),
                    "X-RateLimit-Limit": str(self.max_requests),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(now + self.window_seconds),
                },
            )

        response = await call_next(request)
        remaining = max(0, self.max_requests - request_count - 1)
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(now + self.window_seconds)
        return response
