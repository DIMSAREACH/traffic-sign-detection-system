import os
import ssl
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


def _env_strip_quotes(value: str | None) -> str:
    """Strip one pair of surrounding ' or \" from .env (common bad paste from Neon/psql)."""
    if not value or not isinstance(value, str):
        return ""
    s = value.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in ("'", '"'):
        return s[1:-1].strip()
    return s


def _cors_origin_from_url(url: str) -> str | None:
    """Return scheme://host[:port] for CORS, or None if not a usable absolute URL."""
    from urllib.parse import urlparse

    raw = (url or "").strip().rstrip("/")
    if not raw.startswith(("http://", "https://")):
        return None
    p = urlparse(raw)
    if not p.scheme or not p.netloc:
        return None
    return f"{p.scheme}://{p.netloc}"


def _merge_cors_origins(origins: list[str], url_blob: str) -> None:
    """Append unique origins parsed from comma/semicolon-separated URLs (or full origins)."""
    if not (url_blob or "").strip():
        return
    for part in url_blob.replace(";", ",").split(","):
        o = _cors_origin_from_url(part.strip())
        if o and o not in origins:
            origins.append(o)


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "True") == "True"
ALLOWED_HOSTS = [h.strip() for h in os.getenv("DJANGO_ALLOWED_HOSTS", "").split(",") if h.strip()]
_render_host = os.getenv("RENDER_EXTERNAL_HOSTNAME", "").strip()
if _render_host and _render_host not in ALLOWED_HOSTS:
    ALLOWED_HOSTS.append(_render_host)

# Local PC + Vite (localhost:5173) while DJANGO_DEBUG=False (e.g. prod-like settings): set DJANGO_APPEND_LOCAL_VITE_CORS=1
_APPEND_LOCAL_VITE_CORS = os.getenv("DJANGO_APPEND_LOCAL_VITE_CORS", "").strip().lower() in ("1", "true", "yes")
if _APPEND_LOCAL_VITE_CORS:
    for h in ("localhost", "127.0.0.1", "[::1]"):
        if h not in ALLOWED_HOSTS:
            ALLOWED_HOSTS.append(h)

# Expose /media/ on runserver when DEBUG, or local Vite + DEBUG=False (avatars & uploads otherwise 404).
SERVE_MEDIA_LOCALLY = DEBUG or _APPEND_LOCAL_VITE_CORS

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "django_filters",
    "corsheaders",
    "drf_spectacular",
    "accounts",
    "vehicles",
    "violations",
    "ai_detection",
    "reports",
    "cameras",
    "notifications",
    "support",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "traffic_system.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "traffic_system.wsgi.application"

# Local dev without Postgres: set DJANGO_USE_SQLITE=1 in .env (uses backend/db.sqlite3).
_use_sqlite = os.getenv("DJANGO_USE_SQLITE", "").strip().lower() in ("1", "true", "yes")
if _use_sqlite:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
        }
    }
else:
    _pg_options = {
        # Neon (and most hosted Postgres) requires SSL.
        "sslmode": _env_strip_quotes(os.getenv("DB_SSLMODE", "prefer")) or "prefer",
    }
    _channel_binding = _env_strip_quotes(os.getenv("DB_CHANNEL_BINDING", ""))
    if _channel_binding:
        _pg_options["channel_binding"] = _channel_binding
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": _env_strip_quotes(os.getenv("DB_NAME", "traffic_system")),
            "USER": _env_strip_quotes(os.getenv("DB_USER", "postgres")),
            "PASSWORD": _env_strip_quotes(os.getenv("DB_PASSWORD", "postgres")),
            "HOST": _env_strip_quotes(os.getenv("DB_HOST", "localhost")),
            "PORT": _env_strip_quotes(os.getenv("DB_PORT", "5432")) or "5432",
            "OPTIONS": _pg_options,
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "Asia/Phnom_Penh"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "accounts.backends.EmailBackend",
]

# ── Email (Gmail SMTP + transactional templates) ───────────────────────────
# See traffic_system/settings_email.py for setup steps and env vars.
from traffic_system.settings_email import (  # noqa: E402
    DEFAULT_FROM_EMAIL,
    EMAIL_BACKEND,
    EMAIL_HOST,
    EMAIL_HOST_PASSWORD,
    EMAIL_HOST_USER,
    EMAIL_PORT,
    EMAIL_PROVIDER,
    EMAIL_SUBJECT_PREFIX,
    EMAIL_TIMEOUT,
    EMAIL_USE_SSL,
    EMAIL_USE_TLS,
    RESEND_API_KEY,
    RESEND_FROM,
    SUPPORT_CONTACT_EMAIL,
    PUBLIC_APP_URL,
    PASSWORD_RESET_LINK_TTL_MINUTES,
)

CORS_ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

# Production: browsers send Origin: https://your-spa-host — include it here or rely on PUBLIC_APP_URL.
_merge_cors_origins(CORS_ALLOWED_ORIGINS, PUBLIC_APP_URL)
_merge_cors_origins(CORS_ALLOWED_ORIGINS, os.getenv("CORS_EXTRA_ORIGINS", ""))

# Required for axios `withCredentials: true` (refresh cookie / auth flows).
CORS_ALLOW_CREDENTIALS = True

# In development, allow Vite dev origins. With DJANGO_DEBUG=False, set DJANGO_APPEND_LOCAL_VITE_CORS=1 for local runserver.
if DEBUG or _APPEND_LOCAL_VITE_CORS:
    _vite_local = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
    ]
    for o in _vite_local:
        if o not in CORS_ALLOWED_ORIGINS:
            CORS_ALLOWED_ORIGINS.append(o)

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    # Anonymous throttle applies to token refresh + any request before JWT validates.
    # ~2 anon hits per full reload when access is expired; 30/min breaks rapid refreshes.
    "DEFAULT_THROTTLE_RATES": {
        "anon": os.getenv(
            "THROTTLE_ANON_PER_MIN",
            "400/minute" if DEBUG else "120/minute",
        ),
        "user": "120/minute",
    },
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
}

# ── Cache (OTP throttling, password-reset tokens, DRF anon/user throttles) ───
_cache_backend = os.getenv(
    "DJANGO_CACHE_BACKEND",
    "django.core.cache.backends.locmem.LocMemCache",
)
_cache_location = (os.getenv("DJANGO_CACHE_LOCATION") or "").strip()
_redis_url = (os.getenv("REDIS_URL") or "").strip()
if "RedisCache" in _cache_backend and not _cache_location and _redis_url:
    _cache_location = _redis_url
if not _cache_location:
    _cache_location = "traffic-system-cache"

_cache_options: dict = {}
if "RedisCache" in _cache_backend:
    _cache_options["CLIENT_CLASS"] = "django_redis.client.DefaultClient"
    if str(_cache_location).startswith("rediss://"):
        _ssl_mode = (os.getenv("REDIS_SSL_CERT_REQS") or "required").strip().lower()
        _cert_reqs = ssl.CERT_NONE if _ssl_mode in ("none", "false", "0") else ssl.CERT_REQUIRED
        _cache_options["CONNECTION_POOL_KWARGS"] = {
            "ssl_cert_reqs": _cert_reqs,
            "ssl_check_hostname": _cert_reqs != ssl.CERT_NONE,
        }
    if os.getenv("REDIS_IGNORE_EXCEPTIONS", "").strip().lower() in ("1", "true", "yes"):
        _cache_options["IGNORE_EXCEPTIONS"] = True

CACHES = {
    "default": {
        "BACKEND": _cache_backend,
        "LOCATION": _cache_location,
        "TIMEOUT": None,
        **({"OPTIONS": _cache_options} if _cache_options else {}),
    }
}

SPECTACULAR_SETTINGS = {
    "TITLE": "Traffic Violation Expert System API",
    "DESCRIPTION": "REST API for the AI-powered traffic violation management platform.",
    "VERSION": "1.0.0",
    "SERVE_INCLUDE_SCHEMA": False,
    "COMPONENT_SPLIT_REQUEST": True,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(
        minutes=int(os.getenv("JWT_ACCESS_LIFETIME_MIN", "30"))
    ),
    "REFRESH_TOKEN_LIFETIME": timedelta(
        days=int(os.getenv("JWT_REFRESH_LIFETIME_DAYS", "7"))
    ),
}

# ── Social OAuth credentials (set these in your .env) ──────────────────────
GOOGLE_CLIENT_ID      = os.getenv("GOOGLE_CLIENT_ID", "")
GITHUB_CLIENT_ID      = os.getenv("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET  = os.getenv("GITHUB_CLIENT_SECRET", "")
FACEBOOK_APP_ID       = os.getenv("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET   = os.getenv("FACEBOOK_APP_SECRET", "")
MICROSOFT_CLIENT_ID   = os.getenv("MICROSOFT_CLIENT_ID", "")
MICROSOFT_CLIENT_SECRET = os.getenv("MICROSOFT_CLIENT_SECRET", "")
MICROSOFT_TENANT_ID   = os.getenv("MICROSOFT_TENANT_ID", "common")

# ── Production security hardening ──────────────────────────────────────────────
if not DEBUG:
    SECURE_BROWSER_XSS_FILTER = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    X_FRAME_OPTIONS = "DENY"
    STATIC_ROOT = BASE_DIR / "staticfiles"
    STORAGES = {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": {
            "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
        },
    }
    if _APPEND_LOCAL_VITE_CORS:
        # Local `runserver` over HTTP while DEBUG=False — never redirect to HTTPS (avoids ERR_SSL_PROTOCOL_ERROR).
        SECURE_SSL_REDIRECT = False
        SESSION_COOKIE_SECURE = False
        CSRF_COOKIE_SECURE = False
        SECURE_HSTS_SECONDS = 0
        SECURE_HSTS_INCLUDE_SUBDOMAINS = False
        SECURE_HSTS_PRELOAD = False
    else:
        # Render (and similar) terminate TLS and forward HTTP to the app with this header.
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
        SECURE_SSL_REDIRECT = True
        SECURE_HSTS_SECONDS = 31_536_000        # 1 year
        SECURE_HSTS_INCLUDE_SUBDOMAINS = True
        SECURE_HSTS_PRELOAD = True
        SESSION_COOKIE_SECURE = True
        CSRF_COOKIE_SECURE = True
