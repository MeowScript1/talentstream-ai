"""Reusable text types so bad input becomes a clean 422 instead of a database error (500)."""

from typing import Annotated

from pydantic import AfterValidator, StringConstraints


def _strip_nul(value: str) -> str:
    # Text pasted from Word/PDF often carries NUL bytes, which Postgres can't store. Drop them.
    return value.replace("\x00", "")


def text(max_length: int, min_length: int = 0):
    """A trimmed string with a length limit that matches its database column, minus NUL bytes."""
    return Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=min_length, max_length=max_length),
        AfterValidator(_strip_nul),
    ]


# bcrypt only looks at 72 bytes, so passwords are pre-hashed (see core.security). This cap just
# stops absurd payloads.
MAX_PASSWORD_LENGTH = 1024
