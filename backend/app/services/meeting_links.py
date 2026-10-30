"""Only well-known meeting providers are accepted, so a scheduled "interview" can't be used to send candidates to a scam page."""

from urllib.parse import urlparse

ALLOWED_HOSTS = ("meet.google.com", "zoom.us", "teams.microsoft.com", "teams.live.com", "whereby.com")
MAX_URL_LENGTH = 500


def validate_meeting_url(url: str) -> str:
    """Return the cleaned link, or raise ValueError with a message a person can act on."""
    url = url.strip()
    if len(url) > MAX_URL_LENGTH:
        raise ValueError("That link is too long")
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    if parsed.scheme != "https" or not host or parsed.username or parsed.password:
        raise ValueError("Paste the full meeting link, starting with https://")
    if not any(host == h or host.endswith("." + h) for h in ALLOWED_HOSTS):
        raise ValueError("Use a Google Meet, Zoom, Microsoft Teams or Whereby link")
    return url
