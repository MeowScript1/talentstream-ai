"""
Structured JSON logging for the application.
All log records are emitted as single-line JSON objects compatible with
log-aggregation tools (Render Log Streams, Datadog, etc.).
"""

import json
import logging
import sys
from datetime import datetime, timezone


class _JsonFormatter(logging.Formatter):
    """Render every LogRecord as a single-line JSON string."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
        }

        # Attach request_id if injected by middleware
        request_id = getattr(record, "request_id", None)
        if request_id:
            payload["request_id"] = request_id

        # Attach exception info if present
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        elif record.exc_text:
            payload["exception"] = record.exc_text

        return json.dumps(payload, ensure_ascii=False)


def setup_logging(level: str = "INFO") -> None:
    """
    Call once at application startup to wire up JSON logging.

    This replaces the default uvicorn / root handler with a JSON handler
    that writes to stdout. In development you may prefer the human-readable
    default; in production (ENVIRONMENT=production) always use JSON.
    """
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(_JsonFormatter())
    handler.setLevel(numeric_level)

    # Configure the root logger
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(numeric_level)

    # Keep uvicorn loggers consistent
    for uvicorn_logger in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(uvicorn_logger)
        lg.handlers.clear()
        lg.addHandler(handler)
        lg.propagate = False
        lg.setLevel(numeric_level)

    # Quiet noisy third-party loggers
    for noisy in ("httpx", "httpcore", "asyncpg"):
        logging.getLogger(noisy).setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """Convenience factory — use throughout the app instead of logging.getLogger."""
    return logging.getLogger(name)
