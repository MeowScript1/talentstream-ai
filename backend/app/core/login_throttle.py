"""A brake on password guessing that works without Redis.

State lives in this process's memory, so it resets when the server restarts and isn't shared
between several server instances. That's fine for a single Render instance; if you scale out,
move the counters to Redis.

Two limits apply to failed logins within the window:
  * per (IP, email): the normal case, so one person's typos don't affect anyone else
  * per email alone: the real protection, because a client can fake its forwarded-for IP header
    to dodge the per-IP limit but can't change which account it is attacking
"""

import time
from collections import deque

from starlette.requests import Request

WINDOW_SECONDS = 15 * 60
MAX_FAILURES_PER_IP_AND_EMAIL = 10
MAX_FAILURES_PER_EMAIL = 30
MAX_TRACKED_KEYS = 10_000  # keeps memory bounded if someone sprays random emails


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class LoginThrottle:
    def __init__(self) -> None:
        self._failures: dict[str, deque[float]] = {}

    def _recent(self, key: str, now: float) -> deque[float]:
        attempts = self._failures.get(key)
        if attempts is None:
            return deque()
        while attempts and now - attempts[0] > WINDOW_SECONDS:
            attempts.popleft()
        if not attempts:
            del self._failures[key]
            return deque()
        return attempts

    @staticmethod
    def _keys(ip: str, email: str) -> tuple[str, str]:
        email = email.strip().lower()
        return f"pair:{ip}:{email}", f"email:{email}"

    def retry_after(self, ip: str, email: str) -> int:
        """Seconds the caller must wait, or 0 if another attempt is allowed."""
        now = time.monotonic()
        pair_key, email_key = self._keys(ip, email)
        wait = 0
        for key, limit in ((pair_key, MAX_FAILURES_PER_IP_AND_EMAIL), (email_key, MAX_FAILURES_PER_EMAIL)):
            attempts = self._recent(key, now)
            if len(attempts) >= limit:
                wait = max(wait, int(WINDOW_SECONDS - (now - attempts[0])) + 1)
        return wait

    def record_failure(self, ip: str, email: str) -> None:
        now = time.monotonic()
        if len(self._failures) >= MAX_TRACKED_KEYS:
            self._evict(now)
        for key in self._keys(ip, email):
            self._failures.setdefault(key, deque()).append(now)

    def reset(self, ip: str, email: str) -> None:
        """A successful login clears that person's own counter, not the per-email total."""
        self._failures.pop(self._keys(ip, email)[0], None)

    def _evict(self, now: float) -> None:
        for key in list(self._failures):
            self._recent(key, now)
        # Still full of live entries: drop the oldest-inserted ones
        for key in list(self._failures)[: MAX_TRACKED_KEYS // 10]:
            self._failures.pop(key, None)


login_throttle = LoginThrottle()
