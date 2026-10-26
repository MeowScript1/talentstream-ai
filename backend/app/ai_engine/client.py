from functools import lru_cache

from google import genai

from app.core.config import settings


@lru_cache(maxsize=1)
def get_client() -> genai.Client:
    """Build the Gemini client on first use so the app can start without an API key."""
    return genai.Client(api_key=settings.GOOGLE_API_KEY)
