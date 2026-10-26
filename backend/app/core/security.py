import base64
import hashlib
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import jwt

from app.core.config import settings

# Marks hashes made from a pre-hashed password (see _prehash). Older hashes have no prefix.
_PREHASH_PREFIX = "bcrypt_sha256$"


def _prehash(password: str) -> bytes:
    """Reduce any password to a fixed 44 bytes before bcrypt.

    bcrypt only reads the first 72 bytes, and current versions refuse longer input outright, so a
    long password from a password manager used to crash sign-up and login with a 500.
    """
    return base64.b64encode(hashlib.sha256(password.encode("utf-8")).digest())


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(_PREHASH_PREFIX):
        return bcrypt.checkpw(_prehash(plain_password), hashed_password[len(_PREHASH_PREFIX):].encode("utf-8"))
    # Legacy hash made straight from the password. It can only have come from one of <=72 bytes.
    raw = plain_password.encode("utf-8")
    if len(raw) > 72:
        return False
    return bcrypt.checkpw(raw, hashed_password.encode("utf-8"))


def get_password_hash(password: str) -> str:
    return _PREHASH_PREFIX + bcrypt.hashpw(_prehash(password), bcrypt.gensalt()).decode("utf-8")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt
