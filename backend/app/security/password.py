"""
Password hashing utilities using Argon2id.
Argon2id is memory-hard and computationally resistant to GPU/ASIC brute-force attacks.
"""

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError

# Standard recommended Argon2id parameters
_hasher = PasswordHasher(
    time_cost=3,
    memory_cost=65536,  # 64 MB
    parallelism=4,
    hash_len=32,
    salt_len=16,
)


def hash_password(password: str) -> str:
    """Hash a plaintext password using Argon2id."""
    return _hasher.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against an Argon2id hash."""
    try:
        return _hasher.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False


def needs_rehash(hashed_password: str) -> bool:
    """Check if hash needs rehashing due to parameter updates."""
    try:
        return _hasher.check_needs_rehash(hashed_password)
    except Exception:
        return False

