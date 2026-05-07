"""
OTP utility functions for CamTraffic AI.

Storage backend: Django cache (locmem in dev, Redis-backed in prod via REDIS_URL).
"""
import secrets

from django.core.cache import cache


# ── Code generation ───────────────────────────────────────────────────────────

def generate_otp_code() -> str:
    """Return a cryptographically random 6-digit zero-padded string."""
    return f"{secrets.randbelow(1_000_000):06d}"


# ── Email masking ─────────────────────────────────────────────────────────────

def mask_email(email: str) -> str:
    """
    Mask an email address for safe display.
    'user@example.com'  →  'us***@example.com'
    """
    try:
        local, domain = email.split("@", 1)
        masked_local = local[:2] + "***"
        return f"{masked_local}@{domain}"
    except Exception:
        return "***"


# ── Client IP ─────────────────────────────────────────────────────────────────

def get_client_ip(request) -> str:
    """Return the real client IP, honouring X-Forwarded-For behind a proxy."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "0.0.0.0")


# ── Reset-token cache helpers ─────────────────────────────────────────────────

def store_reset_token(token: str, user_id, ttl_minutes: int = 15) -> None:
    """Store a password-reset token in cache with the given TTL.

    Only one active reset token per user: issuing a new one revokes the previous.
    """
    uid_key = str(user_id)
    latest_key = f"pwd_reset_latest:{uid_key}"
    old = cache.get(latest_key)
    if old:
        cache.delete(f"pwd_reset:{old}")
    timeout_sec = int(ttl_minutes) * 60
    cache.set(latest_key, token, timeout=timeout_sec)
    cache.set(f"pwd_reset:{token}", uid_key, timeout=timeout_sec)


def get_reset_token_user(token: str):
    """Return the user_id string associated with the token, or None if absent/expired."""
    return cache.get(f"pwd_reset:{token}")


def delete_reset_token(token: str) -> None:
    """Permanently remove a reset token from cache (one-time use)."""
    uid_key = cache.get(f"pwd_reset:{token}")
    cache.delete(f"pwd_reset:{token}")
    if uid_key is not None:
        latest = cache.get(f"pwd_reset_latest:{uid_key}")
        if latest == token:
            cache.delete(f"pwd_reset_latest:{uid_key}")
