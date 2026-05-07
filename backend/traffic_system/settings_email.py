"""
Gmail SMTP configuration for CamTraffic AI transactional email.

This module lives alongside ``settings.py`` because Django loads ``traffic_system.settings``
as a single module (a ``settings/`` package would shadow that import).

──────────────────────────────────────────────────────────────────────────────
IMPORTANT — Gmail App Password setup (do not use your normal Gmail password)
──────────────────────────────────────────────────────────────────────────────

  Step 1: Google Account → Security → Enable **2-Step Verification**
  Step 2: Google Account → Security → **App passwords**
  Step 3: Select **Mail** and **Other (custom name)** → name it **CamTraffic AI**
  Step 4: Google generates a **16-character App Password** (e.g. abcd efgh ijkl mnop)
  Step 5: Copy that value into ``.env`` as **EMAIL_HOST_PASSWORD** (spaces optional)

  NEVER put your main Gmail login password in the app.

──────────────────────────────────────────────────────────────────────────────
"""

import os

# ── Resend (recommended: no Gmail app password) ───────────────────────────────
# If RESEND_API_KEY + RESEND_FROM are set, EmailService will use Resend to deliver
# OTP/security emails via HTTPS.
#
# RESEND_FROM must be a full sender (Resend API requirement), e.g.:
#   no-reply@yourdomain.com
#   CamTraffic AI <no-reply@yourdomain.com>
# A bare domain like ``camtraffic.com`` is auto-normalized to
#   CamTraffic AI <noreply@camtraffic.com>
# Resend returns HTTP 403 until that domain is added and verified at https://resend.com/domains
# (DNS at your provider, e.g. Cloudflare). For limited local testing, Resend allows
# ``onboarding@resend.dev`` as FROM — see their documentation for recipient limits.
#
# Example:
#   RESEND_API_KEY=re_********************************
#   RESEND_FROM=CamTraffic AI <no-reply@yourdomain.com>
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
RESEND_FROM = os.getenv("RESEND_FROM", "").strip()

# ── Core SMTP (Gmail) ──────────────────────────────────────────────────────
# Default to console when .env is empty so local dev still runs without SMTP.
EMAIL_BACKEND = os.getenv(
    "EMAIL_BACKEND",
    "django.core.mail.backends.console.EmailBackend",
)
EMAIL_HOST = os.getenv("EMAIL_HOST", "smtp.gmail.com")
EMAIL_PORT = int(os.getenv("EMAIL_PORT", "587"))
EMAIL_USE_TLS = os.getenv("EMAIL_USE_TLS", "True") == "True"
EMAIL_USE_SSL = os.getenv("EMAIL_USE_SSL", "False") == "True"
EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "").strip()
EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "").replace(" ", "")

# Sender shown in the inbox (use the same mailbox as EMAIL_HOST_USER for Gmail)
_default_from = os.getenv("DEFAULT_FROM_EMAIL", "").strip()
if _default_from:
    DEFAULT_FROM_EMAIL = _default_from
elif EMAIL_HOST_USER:
    DEFAULT_FROM_EMAIL = f"CamTraffic AI <{EMAIL_HOST_USER}>"
else:
    DEFAULT_FROM_EMAIL = "CamTraffic AI <no-reply@traffic-system.local>"

_raw_subject_prefix = os.getenv("EMAIL_SUBJECT_PREFIX", "[CamTraffic]").strip()
EMAIL_SUBJECT_PREFIX = (
    f"{_raw_subject_prefix} " if _raw_subject_prefix else "[CamTraffic] "
)
EMAIL_TIMEOUT = int(os.getenv("EMAIL_TIMEOUT", "10"))

# Provider selection:
# - "auto" (default): Resend if configured; else SMTP if configured; else console
# - "resend": force Resend (will fall back to console if not configured)
# - "smtp": force SMTP/console backend
EMAIL_PROVIDER = os.getenv("EMAIL_PROVIDER", "auto").strip().lower()
if EMAIL_PROVIDER not in {"auto", "resend", "smtp"}:
    EMAIL_PROVIDER = "auto"

# If console backend is selected but full SMTP credentials exist, prefer SMTP.
_smtp_ready = bool(EMAIL_HOST and EMAIL_HOST_USER and EMAIL_HOST_PASSWORD)
if _smtp_ready and "console" in EMAIL_BACKEND.lower():
    EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"

# Public support contact (used in password-changed and security emails)
SUPPORT_CONTACT_EMAIL = os.getenv("SUPPORT_CONTACT_EMAIL", EMAIL_HOST_USER or "support@traffic-system.local")

# Public app URL used in email links (forgot password, etc).
# Examples:
#   PUBLIC_APP_URL=http://localhost:5173
#   PUBLIC_APP_URL=https://app.camtraffic.store
PUBLIC_APP_URL = os.getenv("PUBLIC_APP_URL", "http://localhost:5173").strip().rstrip("/")

# Password reset email link TTL (magic link → set new password)
PASSWORD_RESET_LINK_TTL_MINUTES = int(os.getenv("PASSWORD_RESET_LINK_TTL_MINUTES", "60"))
