"""
Application settings loaded from environment variables.

Priority (highest → lowest):
  1. Actual environment variables (Render dashboard / Vercel / CI)
  2. .env.production  (when ENVIRONMENT=production, loaded from disk — gitignored)
  3. .env.development (when ENVIRONMENT=development, loaded from disk — gitignored)
  4. Defaults defined below

Startup will FAIL with a clear error message if any required production
variable is missing.
"""

import os
import sys
import warnings
from urllib.parse import urlparse, urlunparse, parse_qsl, urlencode
from pathlib import Path
from typing import Literal

from pydantic import computed_field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_DIR = Path(__file__).resolve().parents[2]
ENVIRONMENT = os.getenv("ENVIRONMENT", "development").lower()

if ENVIRONMENT == "production":
    _ENV_FILE = BACKEND_DIR / ".env.production"
else:
    _ENV_FILE = BACKEND_DIR / ".env.development"


class Settings(BaseSettings):
    # ── Core ────────────────────────────────────────────────────────────────
    ENVIRONMENT: Literal["development", "production"] = "development"

    # ── Database (Supabase PostgreSQL / local) ──────────────────────────────
    DATABASE_URL: str = "postgresql+asyncpg://talentstream:password@localhost:5432/talentstream"

    # ── Redis (Upstash rediss:// in prod, redis:// in dev) ─────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # Upstash HTTP REST client (alternative to raw Redis protocol)
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""

    # ── Auth / JWT ──────────────────────────────────────────────────────────
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # ── Google / Gemini ─────────────────────────────────────────────────────
    GOOGLE_API_KEY: str = ""

    # ── Supabase ────────────────────────────────────────────────────────────
    SUPABASE_URL: str = ""
    SUPABASE_ANON_KEY: str = ""               # anon/public key (optional)
    SUPABASE_SERVICE_ROLE_KEY: str = ""       # server-side privileged key
    SUPABASE_STORAGE_BUCKET: str = "resumes"
    SUPABASE_STORAGE_BUCKET_PUBLIC: bool = False

    # ── App behaviour ───────────────────────────────────────────────────────
    ATS_SCORE_THRESHOLD: int = 65
    FRONTEND_URL: str = "http://localhost:5173"  # override in prod

    # ── Observability (optional) ─────────────────────────────────────────────
    SENTRY_DSN: str = ""
    LOG_LEVEL: str = "INFO"

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ── Computed helpers ────────────────────────────────────────────────────

    @computed_field  # type: ignore[prop-decorator]
    @property
    def CORS_ORIGINS(self) -> list[str]:
        """Allowed CORS origins based on environment."""
        dev_origins = ["http://localhost:5173", "http://localhost:3000"]
        prod_origins = [self.FRONTEND_URL]
        if self.ENVIRONMENT == "production":
            return list({*dev_origins, *prod_origins})  # deduplicated
        return dev_origins

    # ── URL normalization ────────────────────────────────────────────────────

    @model_validator(mode="after")
    def _normalize_database_url(self) -> "Settings":
        """Ensure DATABASE_URL uses the asyncpg driver and correct SSL param.

        Supabase (and most providers) give plain ``postgresql://`` URLs
        with ``?sslmode=require``. This app uses async SQLAlchemy everywhere,
        so the URL must be ``postgresql+asyncpg://``.
        
        Additionally, asyncpg does not understand the psycopg2-style
        ``sslmode`` query parameter. SQLAlchemy's asyncpg dialect expects
        ``ssl`` instead (e.g., ``?ssl=require``).
        """
        url = self.DATABASE_URL
        if not url:
            return self

        # 1. Normalize scheme
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)

        # 2. Normalize query parameters (sslmode -> ssl, strip pgbouncer)
        parsed = urlparse(url)
        if parsed.query:
            qs = parse_qsl(parsed.query)
            normalized_qs = []
            for k, v in qs:
                if k == "sslmode":
                    normalized_qs.append(("ssl", v))
                elif k == "pgbouncer":
                    pass  # asyncpg doesn't accept pgbouncer kwarg
                else:
                    normalized_qs.append((k, v))
            new_query = urlencode(normalized_qs)
            url = urlunparse(parsed._replace(query=new_query))

        self.DATABASE_URL = url
        return self

    # ── Backward compatibility ──────────────────────────────────────────────

    @model_validator(mode="after")
    def _migrate_legacy_supabase_key(self) -> "Settings":
        """Map deprecated SUPABASE_KEY → SUPABASE_ANON_KEY."""
        legacy = os.getenv("SUPABASE_KEY", "")
        if legacy and not self.SUPABASE_ANON_KEY:
            warnings.warn(
                "SUPABASE_KEY is deprecated — rename to SUPABASE_ANON_KEY",
                DeprecationWarning,
                stacklevel=2,
            )
            self.SUPABASE_ANON_KEY = legacy
        return self

    # ── Startup validation ──────────────────────────────────────────────────

    @model_validator(mode="after")
    def validate_required_production_vars(self) -> "Settings":
        if self.ENVIRONMENT != "production":
            return self

        required: dict[str, str] = {
            "SECRET_KEY": self.SECRET_KEY or "",
            "DATABASE_URL": self.DATABASE_URL,
            "REDIS_URL": self.REDIS_URL,
            "GOOGLE_API_KEY": self.GOOGLE_API_KEY,
            "SUPABASE_URL": self.SUPABASE_URL,
            "SUPABASE_SERVICE_ROLE_KEY": self.SUPABASE_SERVICE_ROLE_KEY,
        }

        missing = [k for k, v in required.items() if not v]
        if missing:
            print(  # noqa: T201 — printed before logging is configured
                "\n[FATAL] Missing required environment variables for production:\n"
                + "\n".join(f"  - {k}" for k in missing)
                + "\n\nSet these in the Render dashboard (or your .env.production file).\n",
                file=sys.stderr,
            )
            raise ValueError(f"Missing required env vars: {', '.join(missing)}")

        return self


settings = Settings()
