"""
Cryptographically secure session token management.
Tokens are 256-bit random secrets. Only their SHA-256 hash is persisted in the database.
"""

import hashlib
import secrets
from datetime import datetime, timezone, timedelta
from app.core.config import settings


def generate_session_token() -> str:
    """Generate a high-entropy URL-safe session token (32 random bytes = 256 bits)."""
    return secrets.token_urlsafe(32)


def hash_session_token(raw_token: str) -> str:
    """Compute the SHA-256 hash of a session token for secure database storage."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def calculate_session_expiry(hours: int | None = None) -> datetime:
    """Calculate the UTC expiration timestamp for a new session."""
    ttl = hours if hours is not None else settings.session_ttl_hours
    return datetime.now(timezone.utc) + timedelta(hours=ttl)
