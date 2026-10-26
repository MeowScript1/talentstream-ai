from supabase import Client, create_client

from app.core.config import settings

# Global Supabase client instance using the Service Role Key for backend-privileged operations
supabase_client: Client | None = None

def get_supabase_client() -> Client:
    """Returns the globally initialized Supabase client."""
    global supabase_client
    if supabase_client is None:
        if not settings.SUPABASE_URL or not settings.SUPABASE_SERVICE_ROLE_KEY:
            raise RuntimeError("Supabase URL or Service Role Key is not configured.")
        # We use the Service Role Key so the backend bypasses RLS and can upload to storage
        supabase_client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
    return supabase_client
