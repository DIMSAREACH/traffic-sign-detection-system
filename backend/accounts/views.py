import random
import re
import secrets
import time
from datetime import timedelta

import requests as http_requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.utils import timezone
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from rest_framework import generics, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


def validate_strong_password(password):
    """Return an error message if password is weak, else None."""
    if len(password) < 8:
        return "Password must be at least 8 characters."
    checks = [
        (r"[A-Z]", "one uppercase letter"),
        (r"[0-9]", "one number"),
        (r"[^A-Za-z0-9]", "one special character"),
    ]
    missing = [msg for pat, msg in checks if not re.search(pat, password)]
    if missing:
        return f"Password must contain {', '.join(missing)}."
    return None


# In-memory OTP store: email -> (code, expiry_timestamp)
_reset_codes: dict = {}
_RESET_TTL = 300  # 5 minutes

# In-memory email change store: user_id -> (new_email, code, expiry_timestamp)
_email_change_codes: dict = {}
_EMAIL_CHANGE_TTL = 600  # 10 minutes

_OTP_COOLDOWN_SEC = 60          # minimum seconds between sends (per key)
_OTP_WINDOW_SEC = 15 * 60       # rolling window (per key)
_OTP_MAX_PER_WINDOW = 5         # max sends per window (per key)

# Additional IP-based protection to stop "many emails" spam from one client.
_OTP_IP_COOLDOWN_SEC = 15       # minimum seconds between sends (per IP)
_OTP_IP_WINDOW_SEC = 15 * 60    # rolling window (per IP)
_OTP_IP_MAX_PER_WINDOW = 15     # max sends per window (per IP)


def _client_ip(request):
    xff = (request.META.get("HTTP_X_FORWARDED_FOR") or "").split(",")[0].strip()
    return xff or (request.META.get("REMOTE_ADDR") or "unknown")


def _cache_throttle(prefix: str, key: str, cooldown: int, window: int, max_per_window: int):
    """
    Cache-backed throttle. Returns (ok: bool, retry_after_sec: int).
    """
    now = int(time.time())
    base = f"otp_rl:{prefix}:{key}"
    last_k = f"{base}:last"
    win_k = f"{base}:win"
    cnt_k = f"{base}:cnt"

    last = cache.get(last_k)
    if last is not None:
        delta = now - int(last)
        if delta < cooldown:
            return False, int(cooldown - delta)

    win_start = cache.get(win_k)
    if win_start is None or (now - int(win_start)) > window:
        cache.set(win_k, now, timeout=window + 5)
        cache.set(cnt_k, 0, timeout=window + 5)
        win_start = now

    count = cache.get(cnt_k) or 0
    if int(count) >= int(max_per_window):
        retry = int(window - (now - int(win_start)))
        return False, max(retry, cooldown)

    cache.set(last_k, now, timeout=window + 5)
    try:
        cache.incr(cnt_k)
    except Exception:
        cache.set(cnt_k, int(count) + 1, timeout=window + 5)
    return True, 0


def _otp_throttle_request(request, key: str):
    # per target (email/user)
    ok, retry = _cache_throttle("target", key, _OTP_COOLDOWN_SEC, _OTP_WINDOW_SEC, _OTP_MAX_PER_WINDOW)
    if not ok:
        return False, retry
    # per IP (global for OTP endpoints)
    ip = _client_ip(request)
    ok, retry = _cache_throttle("ip", ip, _OTP_IP_COOLDOWN_SEC, _OTP_IP_WINDOW_SEC, _OTP_IP_MAX_PER_WINDOW)
    if not ok:
        return False, retry
    return True, 0


def _password_reset_link_rate_ok(user_pk: int, max_per_hour: int = 3) -> tuple[bool, int]:
    """Limit magic-link emails per user per rolling hour. Returns (ok, retry_after_sec)."""
    key = f"pwd_reset_link_hr:{user_pk}"
    now = time.time()
    window = 3600.0
    times = cache.get(key) or []
    times = [t for t in times if now - t < window]
    if len(times) >= max_per_hour:
        return False, max(1, int(window - (now - times[0])))
    times.append(now)
    cache.set(key, times, int(window) + 120)
    return True, 0


from .models import Driver, Officer, OTPVerification, Role, UserRole
from .permissions import AdminDeleteOnly, AdminWriteOnly, IsAdminRole
from .serializers import (
    BackupEmailConfirmSerializer,
    BackupEmailRequestSerializer,
    DriverSerializer,
    LoginSerializer,
    OfficerSerializer,
    OTPRequestSerializer,
    OTPVerifySerializer,
    PasswordResetSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)
from utils.email_service import EmailService
from utils.otp import (
    delete_reset_token,
    generate_otp_code,
    get_client_ip,
    get_reset_token_user,
    mask_email,
    store_reset_token,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]
    # Anonymous throttle uses the cache; a broken Redis config becomes HTTP 500 on login.
    throttle_classes = []

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data, status=status.HTTP_200_OK)


class ProfileView(APIView):
    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)

    def patch(self, request):
        serializer = ProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)


class AvatarUploadView(APIView):
    """POST multipart/form-data  { avatar: <file> }"""

    def post(self, request):
        user = request.user
        file = request.FILES.get("avatar")
        if not file:
            return Response({"detail": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        # delete old file to avoid orphans
        if user.avatar:
            user.avatar.delete(save=False)
        user.avatar = file
        user.save(update_fields=["avatar"])
        return Response(UserSerializer(user, context={"request": request}).data)


class ChangePasswordView(APIView):
    """POST { current_password, new_password }"""

    def post(self, request):
        user = request.user
        current = request.data.get("current_password", "")
        new_pw  = request.data.get("new_password", "")
        if not user.check_password(current):
            return Response(
                {"detail": "Current password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pw_err = validate_strong_password(new_pw)
        if pw_err:
            return Response({"detail": pw_err}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(new_pw)
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed successfully."})


class DeleteAccountView(APIView):
    """POST { password }  — permanently deletes the current user's account."""

    def post(self, request):
        user = request.user
        password = request.data.get("password", "")
        if not user.check_password(password):
            return Response(
                {"detail": "Password is incorrect."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.delete()
        return Response({"detail": "Account deleted successfully."})

# ── Password-reset endpoints ──────────────────────────────────────────────────

User = get_user_model()


class PasswordResetRequestView(APIView):
    """POST { email } — generates a 6-digit OTP and emails it."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        ok, retry = _otp_throttle_request(request, f"pw:{email}")
        if not ok:
            return Response(
                {"detail": f"Too many OTP requests. Please wait {retry}s and try again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(retry)},
            )

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal whether the email exists
            return Response({"detail": "If that email is registered you will receive an OTP."})

        otp = f"{random.randint(0, 999999):06d}"
        _reset_codes[email] = (otp, time.time() + _RESET_TTL)

        sent, send_err = EmailService.send_otp_email(
            user=User(email=email, username=""),
            otp_code=otp,
            masked_email=mask_email(email),
            expires_minutes=5.0,
            to_email=email,
            validity_label="5 minutes",
        )
        if not sent:
            detail = (
                f"Failed to send OTP email: {send_err}"
                if settings.DEBUG and send_err
                else "Failed to send OTP email. Please try again later."
            )
            return Response({"detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to your email."})


class PasswordResetConfirmView(APIView):
    """POST { email, otp, new_password } — validates OTP and sets new password."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email        = (request.data.get("email") or "").strip().lower()
        otp          = (request.data.get("otp") or "").strip()
        new_password = request.data.get("new_password", "")

        if not all([email, otp, new_password]):
            return Response({"detail": "email, otp and new_password are required."},
                            status=status.HTTP_400_BAD_REQUEST)

        entry = _reset_codes.get(email)
        if not entry:
            return Response({"detail": "No OTP was requested for this email."},
                            status=status.HTTP_400_BAD_REQUEST)

        stored_otp, expiry = entry
        if time.time() > expiry:
            _reset_codes.pop(email, None)
            return Response({"detail": "OTP has expired. Please request a new one."},
                            status=status.HTTP_400_BAD_REQUEST)

        if otp != stored_otp:
            return Response({"detail": "Incorrect OTP."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        pw_err = validate_strong_password(new_password)
        if pw_err:
            return Response({"detail": pw_err}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        _reset_codes.pop(email, None)

        return Response({"detail": "Password reset successful. You can now sign in."})


# ── Change-email endpoints (verified OTP; demo OTP returned) ──────────────────

class ChangeEmailRequestView(APIView):
    """POST { new_email } — generates a 6-digit OTP for changing the current user's email."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        new_email = (request.data.get("new_email") or "").strip().lower()
        if not new_email:
            return Response({"detail": "new_email is required."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response({"detail": "That email is already in use."}, status=status.HTTP_400_BAD_REQUEST)

        ok, retry = _otp_throttle_request(request, f"email:{request.user.pk}")
        if not ok:
            return Response(
                {"detail": f"Too many OTP requests. Please wait {retry}s and try again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(retry)},
            )

        otp = f"{random.randint(0, 999999):06d}"
        _email_change_codes[request.user.pk] = (new_email, otp, time.time() + _EMAIL_CHANGE_TTL)
        sent, send_err = EmailService.send_otp_email(
            user=request.user,
            otp_code=otp,
            masked_email=mask_email(new_email),
            expires_minutes=10.0,
            to_email=new_email,
            validity_label="10 minutes",
        )
        if not sent:
            detail = (
                f"Failed to send OTP email: {send_err}"
                if settings.DEBUG and send_err
                else "Failed to send OTP email. Please try again later."
            )
            return Response({"detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({"detail": "OTP sent to your new email."})


class ChangeEmailConfirmView(APIView):
    """POST { otp } — validates OTP and updates the current user's email."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        otp = (request.data.get("otp") or "").strip()
        if not otp:
            return Response({"detail": "otp is required."}, status=status.HTTP_400_BAD_REQUEST)

        entry = _email_change_codes.get(request.user.pk)
        if not entry:
            return Response({"detail": "No email change was requested."}, status=status.HTTP_400_BAD_REQUEST)

        new_email, stored_otp, expiry = entry
        if time.time() > expiry:
            _email_change_codes.pop(request.user.pk, None)
            return Response({"detail": "OTP has expired. Please request a new one."}, status=status.HTTP_400_BAD_REQUEST)
        if otp != stored_otp:
            return Response({"detail": "Incorrect OTP."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(email__iexact=new_email).exclude(pk=request.user.pk).exists():
            return Response({"detail": "That email is already in use."}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        user.email = new_email
        # Require re-verification of the new email (if you later enforce it)
        try:
            user.email_verified = False
        except Exception:
            pass
        user.save(update_fields=["email", "email_verified"] if hasattr(user, "email_verified") else ["email"])
        _email_change_codes.pop(request.user.pk, None)
        return Response(UserSerializer(user, context={"request": request}).data)


# ── Social OAuth helpers ────────────────────────────────────────────────

def _jwt_for_user(user):
    """Return {access, refresh, user} dict for a User instance."""
    refresh = RefreshToken.for_user(user)
    return {
        "access":  str(refresh.access_token),
        "refresh": str(refresh),
        "user":    UserSerializer(user).data,
    }


def _get_or_create_social_user(email, name=""):
    """Find or create a User from a social-login email."""
    _User = get_user_model()
    try:
        return _User.objects.get(email=email)
    except _User.DoesNotExist:
        pass

    # Build a unique username from the local part of the email
    base = email.split("@")[0][:140]
    username = base
    counter  = 1
    while _User.objects.filter(username=username).exists():
        username = f"{base}{counter}"
        counter += 1

    parts      = (name or "").split()
    first_name = parts[0] if parts else ""
    last_name  = " ".join(parts[1:]) if len(parts) > 1 else ""

    user = _User.objects.create_user(
        email=email,
        password=None,           # no password — social-only account
        username=username,
        first_name=first_name,
        last_name=last_name,
    )
    return user


# ── Google ───────────────────────────────────────────────────────────────

class GoogleSocialAuthView(APIView):
    """POST { credential } or { access_token } — verify Google token and return JWT."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        credential   = request.data.get("credential")
        access_token = request.data.get("access_token")

        if credential:
            if not getattr(settings, "GOOGLE_CLIENT_ID", ""):
                return Response(
                    {"detail": "Google login is not configured on the server."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Verify Google ID token (JWT credential from GoogleLogin component)
            try:
                idinfo = id_token.verify_oauth2_token(
                    credential,
                    google_requests.Request(),
                    settings.GOOGLE_CLIENT_ID,
                )
            except ValueError as exc:
                return Response({"detail": f"Invalid Google token: {exc}"}, status=status.HTTP_400_BAD_REQUEST)
            email = idinfo.get("email")
            name  = idinfo.get("name", "")

        elif access_token:
            # Verify via Google userinfo endpoint (from useGoogleLogin hook)
            resp = http_requests.get(
                "https://www.googleapis.com/oauth2/v3/userinfo",
                params={"access_token": access_token},
                timeout=10,
            )
            if resp.status_code != 200:
                return Response({"detail": "Invalid Google access token."}, status=status.HTTP_400_BAD_REQUEST)
            info  = resp.json()
            email = info.get("email")
            name  = info.get("name", "")

        else:
            return Response({"detail": "credential or access_token is required."}, status=status.HTTP_400_BAD_REQUEST)

        if not email:
            return Response({"detail": "Google account has no email."}, status=status.HTTP_400_BAD_REQUEST)

        user = _get_or_create_social_user(email, name)
        return Response(_jwt_for_user(user))



# ── GitHub ───────────────────────────────────────────────────────────────

class GitHubSocialAuthView(APIView):
    """POST { code, redirect_uri } — exchange GitHub OAuth code and return JWT."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not getattr(settings, "GITHUB_CLIENT_ID", "") or not getattr(settings, "GITHUB_CLIENT_SECRET", ""):
            return Response({"detail": "GitHub login is not configured on the server."}, status=status.HTTP_400_BAD_REQUEST)
        code         = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri", "")
        if not code:
            return Response({"detail": "code is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Exchange code for access token
        token_resp = http_requests.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id":     settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code":          code,
                "redirect_uri":  redirect_uri,
            },
            headers={"Accept": "application/json"},
            timeout=10,
        )
        try:
            token_json = token_resp.json()
        except Exception:
            token_json = {}

        access_token = (token_json or {}).get("access_token")
        if not access_token:
            provider_err = (token_json or {}).get("error") or ""
            provider_desc = (token_json or {}).get("error_description") or ""
            hint = (
                "Check that your GitHub OAuth App callback URL matches exactly: "
                f"{redirect_uri}"
            )
            msg = "Failed to exchange GitHub code."
            if provider_err or provider_desc:
                msg = f"{msg} ({provider_err} {provider_desc})".strip()

            return Response({"detail": msg, "hint": hint}, status=status.HTTP_400_BAD_REQUEST)

        headers = {"Authorization": f"Bearer {access_token}"}

        # Get user profile
        user_resp = http_requests.get("https://api.github.com/user", headers=headers, timeout=10)
        gh_user   = user_resp.json()

        email = gh_user.get("email")
        if not email:
            # Fetch verified emails separately (email may be private)
            emails_resp = http_requests.get("https://api.github.com/user/emails", headers=headers, timeout=10)
            primary     = next((e for e in emails_resp.json() if e.get("primary") and e.get("verified")), None)
            email       = primary["email"] if primary else None

        if not email:
            return Response({"detail": "GitHub account has no public/verified email."}, status=status.HTTP_400_BAD_REQUEST)

        user = _get_or_create_social_user(email, gh_user.get("name", ""))
        return Response(_jwt_for_user(user))


# ── Facebook ─────────────────────────────────────────────────────────────

class FacebookSocialAuthView(APIView):
    """POST { code, redirect_uri } — exchange Facebook OAuth code and return JWT."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not getattr(settings, "FACEBOOK_APP_ID", "") or not getattr(settings, "FACEBOOK_APP_SECRET", ""):
            return Response({"detail": "Facebook login is not configured on the server."}, status=status.HTTP_400_BAD_REQUEST)
        code         = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri", "")
        if not code:
            return Response({"detail": "code is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Exchange code for access token
        token_resp = http_requests.get(
            "https://graph.facebook.com/v19.0/oauth/access_token",
            params={
                "client_id":     settings.FACEBOOK_APP_ID,
                "client_secret": settings.FACEBOOK_APP_SECRET,
                "redirect_uri":  redirect_uri,
                "code":          code,
            },
            timeout=10,
        )
        access_token = token_resp.json().get("access_token")
        if not access_token:
            return Response({"detail": "Failed to exchange Facebook code."}, status=status.HTTP_400_BAD_REQUEST)

        # Get user info
        user_resp = http_requests.get(
            "https://graph.facebook.com/me",
            params={"fields": "id,name,email", "access_token": access_token},
            timeout=10,
        )
        fb_user = user_resp.json()
        email   = fb_user.get("email")
        if not email:
            return Response({"detail": "Facebook account has no email. Enable email permission."}, status=status.HTTP_400_BAD_REQUEST)

        user = _get_or_create_social_user(email, fb_user.get("name", ""))
        return Response(_jwt_for_user(user))


# ── Microsoft ─────────────────────────────────────────────────────────────

class MicrosoftSocialAuthView(APIView):
    """POST { code, redirect_uri } — exchange Microsoft OAuth code and return JWT."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        if not getattr(settings, "MICROSOFT_CLIENT_ID", "") or not getattr(settings, "MICROSOFT_CLIENT_SECRET", ""):
            return Response({"detail": "Microsoft login is not configured on the server."}, status=status.HTTP_400_BAD_REQUEST)
        code         = request.data.get("code")
        redirect_uri = request.data.get("redirect_uri", "")
        if not code:
            return Response({"detail": "code is required."}, status=status.HTTP_400_BAD_REQUEST)

        tenant = getattr(settings, "MICROSOFT_TENANT_ID", "common")

        # Exchange code for access token
        token_resp = http_requests.post(
            f"https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token",
            data={
                "client_id":     settings.MICROSOFT_CLIENT_ID,
                "client_secret": settings.MICROSOFT_CLIENT_SECRET,
                "code":          code,
                "redirect_uri":  redirect_uri,
                "grant_type":    "authorization_code",
                "scope":         "openid email profile",
            },
            timeout=10,
        )
        access_token = token_resp.json().get("access_token")
        if not access_token:
            return Response({"detail": "Failed to exchange Microsoft code."}, status=status.HTTP_400_BAD_REQUEST)

        # Get user info from Microsoft Graph
        user_resp = http_requests.get(
            "https://graph.microsoft.com/v1.0/me",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
        ms_user = user_resp.json()
        email   = ms_user.get("mail") or ms_user.get("userPrincipalName")
        if not email:
            return Response({"detail": "Could not retrieve email from Microsoft."}, status=status.HTTP_400_BAD_REQUEST)

        name = f"{ms_user.get('givenName', '')} {ms_user.get('surname', '')}".strip()
        user = _get_or_create_social_user(email, name)
        return Response(_jwt_for_user(user))


class DriverViewSet(viewsets.ModelViewSet):
    serializer_class = DriverSerializer
    permission_classes = [permissions.IsAuthenticated, AdminWriteOnly]
    search_fields = ["license_number", "national_id", "user__email", "user__first_name", "user__last_name"]

    def get_queryset(self):
        # Only return drivers whose user currently holds the "driver" role
        return (
            Driver.objects.select_related("user")
            .filter(user__user_roles__role__name="driver")
            .order_by("id")
        )

    def create(self, request, *args, **kwargs):
        """Admin creates a new driver (user account + driver profile)."""
        data = request.data
        email = (data.get("email") or "").strip()
        username = (data.get("username") or "").strip()
        password = data.get("password", "")
        first_name = (data.get("first_name") or "").strip()
        last_name = (data.get("last_name") or "").strip()
        phone = (data.get("phone") or "").strip() or None
        license_number = (data.get("license_number") or "").strip()
        national_id = (data.get("national_id") or "").strip()
        address = (data.get("address") or "").strip()
        date_of_birth = data.get("date_of_birth") or None

        if not email or not username or not password:
            return Response({"detail": "email, username, and password are required."}, status=status.HTTP_400_BAD_REQUEST)
        pw_err = validate_strong_password(password)
        if pw_err:
            return Response({"detail": pw_err}, status=status.HTTP_400_BAD_REQUEST)
        if not license_number:
            return Response({"detail": "License number is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not national_id:
            return Response({"detail": "National ID is required."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(email__iexact=email).exists():
            return Response({"detail": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username__iexact=username).exists():
            return Response({"detail": "A user with this username already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if phone and User.objects.filter(phone=phone).exists():
            return Response({"detail": "A user with this phone number already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if Driver.objects.filter(license_number=license_number).exists():
            return Response({"detail": "A driver with this license number already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if Driver.objects.filter(national_id=national_id).exists():
            return Response({"detail": "A driver with this national ID already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            email=email, username=username, password=password,
            first_name=first_name, last_name=last_name, phone=phone,
        )
        role_obj, _ = Role.objects.get_or_create(name="driver")
        UserRole.objects.create(user=user, role=role_obj)

        driver = Driver.objects.create(
            user=user, license_number=license_number,
            national_id=national_id, address=address,
            date_of_birth=date_of_birth if date_of_birth else None,
        )
        return Response(
            DriverSerializer(driver, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class OfficerViewSet(viewsets.ModelViewSet):
    serializer_class = OfficerSerializer
    permission_classes = [permissions.IsAuthenticated, AdminDeleteOnly]
    search_fields = ["badge_number", "user__email"]

    def get_queryset(self):
        # Only return officers whose user currently holds the "officer" role
        return (
            Officer.objects.select_related("user")
            .filter(user__user_roles__role__name="officer")
            .order_by("id")
        )


# ── User Management (admin only) ──────────────────────────────────────────────

class UserManagementViewSet(viewsets.ModelViewSet):
    """Admin-only CRUD + role assignment for all users."""
    permission_classes = [permissions.IsAuthenticated, IsAdminRole]
    serializer_class = UserSerializer
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def perform_destroy(self, instance):
        """
        Clear simplejwt blacklist rows before deleting the user.

        When migrations for `token_blacklist` have been applied, PostgreSQL keeps
        rows in `token_blacklist_outstandingtoken` referencing this user, but
        `rest_framework_simplejwt.token_blacklist` is often NOT in INSTALLED_APPS,
        so `OutstandingToken.objects` does not exist — the ORM cleanup cannot run.

        Use raw SQL so deletes always work as long as those tables exist.
        """
        from django.db import connection
        from django.db.utils import ProgrammingError

        uid = instance.pk
        with connection.cursor() as cur:
            try:
                cur.execute(
                    """
                    DELETE FROM token_blacklist_blacklistedtoken
                    WHERE token_id IN (
                        SELECT id FROM token_blacklist_outstandingtoken
                        WHERE user_id = %s
                    );
                    """,
                    [uid],
                )
                cur.execute(
                    "DELETE FROM token_blacklist_outstandingtoken WHERE user_id = %s;",
                    [uid],
                )
            except ProgrammingError:
                # Tables not created (no blacklist migrations) — safe to skip
                pass
        instance.delete()

    def get_queryset(self):
        qs = (
            User.objects
            .select_related("driver_profile", "officer_profile")
            .prefetch_related("user_roles__role")
            .order_by("id")
        )
        q = self.request.query_params.get("search", "").strip()
        if q:
            from django.db.models import Q
            qs = qs.filter(
                Q(email__icontains=q) |
                Q(username__icontains=q) |
                Q(first_name__icontains=q) |
                Q(last_name__icontains=q)
            )
        role_filter = self.request.query_params.get("role", "").strip()
        if role_filter:
            qs = qs.filter(user_roles__role__name=role_filter)
        status_filter = self.request.query_params.get("status", "").strip()
        if status_filter == "active":
            qs = qs.filter(is_active=True)
        elif status_filter == "inactive":
            qs = qs.filter(is_active=False)
        return qs

    def get_serializer_context(self):
        return {"request": self.request}

    def create(self, request, *args, **kwargs):
        """Admin creates a new user with an assigned role."""
        data = request.data
        email     = (data.get("email") or "").strip()
        username  = (data.get("username") or "").strip()
        password  = data.get("password", "")
        role_name = (data.get("role") or "driver").strip().lower()

        if not email or not username or not password:
            return Response(
                {"detail": "email, username, and password are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pw_err = validate_strong_password(password)
        if pw_err:
            return Response({"detail": pw_err}, status=status.HTTP_400_BAD_REQUEST)
        if role_name not in ("admin", "officer", "driver"):
            role_name = "driver"

        if User.objects.filter(email=email).exists():
            return Response({"detail": "A user with this email already exists."}, status=status.HTTP_400_BAD_REQUEST)
        if User.objects.filter(username=username).exists():
            return Response({"detail": "A user with this username already exists."}, status=status.HTTP_400_BAD_REQUEST)

        phone = (data.get("phone") or "").strip() or None
        if phone and User.objects.filter(phone=phone).exists():
            return Response({"detail": "A user with this phone number already exists."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.create_user(
            email=email,
            username=username,
            password=password,
            first_name=data.get("first_name", ""),
            last_name=data.get("last_name", ""),
            phone=phone,
        )
        role_obj, _ = Role.objects.get_or_create(name=role_name)
        UserRole.objects.create(user=user, role=role_obj)

        # Create profile record — use real fields when provided, fallback to placeholders
        import uuid
        if role_name == "driver":
            license_number = (data.get("license_number") or "").strip()
            national_id = (data.get("national_id") or "").strip()
            address = (data.get("address") or "").strip()
            date_of_birth = data.get("date_of_birth") or None
            if not license_number:
                license_number = f"DRV-{uuid.uuid4().hex[:8]}"
            if not national_id:
                national_id = f"NID-{uuid.uuid4().hex[:8]}"
            Driver.objects.get_or_create(
                user=user,
                defaults={
                    "license_number": license_number,
                    "national_id": national_id,
                    "address": address,
                    "date_of_birth": date_of_birth if date_of_birth else None,
                },
            )
        elif role_name == "officer":
            badge_number = (data.get("badge_number") or "").strip()
            station = (data.get("station") or "").strip()
            rank = (data.get("rank") or "").strip()
            if not badge_number:
                badge_number = f"OFF-{uuid.uuid4().hex[:8]}"
            Officer.objects.get_or_create(
                user=user,
                defaults={
                    "badge_number": badge_number,
                    "station": station,
                    "rank": rank,
                },
            )

        return Response(
            UserSerializer(user, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, *args, **kwargs):
        """PATCH user fields + nested driver_profile / officer_profile."""
        user = self.get_object()
        data = request.data

        # Update basic user fields
        user_fields = ("first_name", "last_name", "phone", "username")
        changed = []
        for f in user_fields:
            if f in data:
                setattr(user, f, (data[f] or "").strip() if f != "phone" else ((data[f] or "").strip() or None))
                changed.append(f)
        if changed:
            user.save(update_fields=changed)

        # Update nested driver profile
        dp = data.get("driver_profile")
        if dp and isinstance(dp, dict):
            try:
                profile = user.driver_profile
                for f in ("license_number", "national_id", "address", "date_of_birth"):
                    if f in dp:
                        setattr(profile, f, dp[f] if f == "date_of_birth" else (dp[f] or "").strip())
                profile.save()
            except Driver.DoesNotExist:
                pass

        # Update nested officer profile
        op = data.get("officer_profile")
        if op and isinstance(op, dict):
            try:
                profile = user.officer_profile
                for f in ("badge_number", "station", "rank"):
                    if f in op:
                        setattr(profile, f, (op[f] or "").strip())
                profile.save()
            except Officer.DoesNotExist:
                pass

        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        """Return aggregate counts for the KPI cards (unfiltered)."""
        total    = User.objects.count()
        admin    = User.objects.filter(user_roles__role__name="admin").count()
        officer  = User.objects.filter(user_roles__role__name="officer").count()
        driver   = User.objects.filter(user_roles__role__name="driver").count()
        inactive = User.objects.filter(is_active=False).count()
        return Response({
            "total": total, "admin": admin, "officer": officer,
            "driver": driver, "inactive": inactive,
        })

    @action(detail=False, methods=["get"], url_path="export-csv")
    def export_csv(self, request):
        """Download all users as CSV."""
        import csv
        from django.http import HttpResponse as DjangoHttpResponse
        qs = self.get_queryset()
        response = DjangoHttpResponse(content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="users.csv"'
        writer = csv.writer(response)
        writer.writerow(["ID", "Email", "Username", "First Name", "Last Name", "Phone", "Role", "Active", "Date Joined", "Last Login"])
        for u in qs:
            role_names = {ur.role.name for ur in u.user_roles.all()}
            primary = "admin" if "admin" in role_names else ("officer" if "officer" in role_names else "driver")
            writer.writerow([
                u.id, u.email, u.username, u.first_name, u.last_name,
                u.phone, primary, u.is_active,
                u.date_joined.strftime("%Y-%m-%d") if u.date_joined else "",
                u.last_login.strftime("%Y-%m-%d %H:%M") if u.last_login else "",
            ])
        return response

    @action(detail=True, methods=["post"], url_path="assign-role")
    def assign_role(self, request, pk=None):
        """POST { role: 'admin'|'officer'|'driver' } — replaces all existing roles."""
        import uuid
        user = self.get_object()
        role_name = (request.data.get("role") or "").strip().lower()
        if role_name not in ("admin", "officer", "driver"):
            return Response(
                {"detail": "role must be admin, officer, or driver."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        role_obj, _ = Role.objects.get_or_create(name=role_name)
        UserRole.objects.filter(user=user).delete()
        UserRole.objects.create(user=user, role=role_obj)

        # Ensure the matching profile record exists for the new role
        if role_name == "driver":
            uid = uuid.uuid4().hex[:8]
            Driver.objects.get_or_create(
                user=user,
                defaults={"license_number": f"DRV-{uid}", "national_id": f"NID-{uid}"},
            )
        elif role_name == "officer":
            uid = uuid.uuid4().hex[:8]
            Officer.objects.get_or_create(
                user=user,
                defaults={"badge_number": f"OFF-{uid}"},
            )

        return Response(UserSerializer(user, context={"request": request}).data)

    @action(detail=True, methods=["post"], url_path="toggle-active")
    def toggle_active(self, request, pk=None):
        """Toggle is_active for the given user (cannot deactivate yourself)."""
        user = self.get_object()
        if user.pk == request.user.pk:
            return Response(
                {"detail": "You cannot deactivate your own account."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        user.is_active = not user.is_active
        user.save(update_fields=["is_active"])
        return Response(UserSerializer(user, context={"request": request}).data)


# ══════════════════════════════════════════════════════════════════════════════
#  OTP Password-Reset System
# ══════════════════════════════════════════════════════════════════════════════

PASSWORD_RESET_OTP_TTL_SECONDS = 60


def _password_reset_otp_validity_label(total_seconds: int) -> str:
    """Human-readable expiry for email/HTML (e.g. '60 seconds')."""
    if total_seconds <= 90:
        return f"{total_seconds} seconds"
    minutes, seconds = divmod(total_seconds, 60)
    if seconds == 0:
        return f"{minutes} minutes" if minutes != 1 else "1 minute"
    return f"{minutes} min {seconds} s"


def _find_user_by_identifier(identifier: str):
    """
    Return (user, send_to_email) for a login identifier.

    Lookup order:
      1. Primary email
      2. Verified backup / recovery email
      3. Username  → sends reset link to primary email

    Returns (None, None) when no match is found.
    """
    _User = get_user_model()
    if "@" in identifier:
        user = _User.objects.filter(email__iexact=identifier).first()
        if user:
            return user, user.email
        # Try verified backup email
        user = _User.objects.filter(
            backup_email__iexact=identifier,
            backup_email_verified=True,
            allow_backup_password_reset=True,
        ).first()
        if user:
            return user, user.backup_email
        return None, None
    user = _User.objects.filter(username__iexact=identifier).first()
    return (user, user.email) if user else (None, None)


class OTPRequestView(APIView):
    """POST /api/auth/otp/request/ — email a password-reset link (magic link, no numeric OTP)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]

        user, send_to = _find_user_by_identifier(identifier)
        if not user:
            return Response(
                {"detail": "No account found with this email or username."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not user.is_active:
            return Response(
                {"detail": "This account has been deactivated. Contact support."},
                status=status.HTTP_403_FORBIDDEN,
            )

        sends_to_primary = send_to == user.email
        if (
            getattr(user, "block_unverified_email_reset", False)
            and sends_to_primary
            and not getattr(user, "email_verified", False)
        ):
            return Response(
                {
                    "detail": "This account must verify its primary email before using password reset. "
                    "Sign in if you can, or use a verified recovery email if you added one."
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        ok_rl, retry_sec = _otp_throttle_request(request, f"pw:{send_to}")
        if not ok_rl:
            return Response(
                {"detail": f"Too many requests. Try again in {retry_sec} seconds."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(retry_sec)},
            )

        ok_hr, retry_hr = _password_reset_link_rate_ok(user.pk)
        if not ok_hr:
            return Response(
                {"detail": "Too many reset emails sent. Please wait before requesting again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
                headers={"Retry-After": str(retry_hr)},
            )

        public_base = (getattr(settings, "PUBLIC_APP_URL", "") or "").strip().rstrip("/")
        if not public_base:
            return Response(
                {
                    "detail": "Password reset is unavailable: PUBLIC_APP_URL is not configured on the server."
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        ttl_minutes = int(getattr(settings, "PASSWORD_RESET_LINK_TTL_MINUTES", 60) or 60)
        token = secrets.token_urlsafe(32)
        store_reset_token(token, user.pk, ttl_minutes=ttl_minutes)
        reset_link_url = f"{public_base}/reset-password?token={token}"
        validity_label = _password_reset_otp_validity_label(ttl_minutes * 60)

        sent, send_err = EmailService.send_password_reset_link_email(
            user,
            mask_email(send_to),
            reset_link_url=reset_link_url,
            validity_label=validity_label,
            to_email=send_to,
        )
        if not sent:
            detail = (
                f"Failed to send reset email: {send_err}"
                if settings.DEBUG and send_err
                else "Failed to send reset email. Please try again later."
            )
            return Response(
                {"detail": detail},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if getattr(settings, "RESEND_API_KEY", "") and getattr(settings, "RESEND_FROM", ""):
            _otp_delivery = "resend"
        else:
            _otp_delivery = (
                "smtp" if "smtp" in (settings.EMAIL_BACKEND or "").lower() else "console"
            )
        return Response({
            "success": True,
            "message": "Password reset link sent to your registered email address.",
            "masked_email": mask_email(send_to),
            "expires_in_seconds": ttl_minutes * 60,
            "otp_delivery": _otp_delivery,
        })


class OTPVerifyView(APIView):
    """POST /api/auth/otp/verify/ — verify OTP and obtain a reset token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = OTPVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        identifier = serializer.validated_data["identifier"]
        otp_code   = serializer.validated_data["otp_code"]

        user, _send_to = _find_user_by_identifier(identifier)
        if not user:
            return Response(
                {"detail": "No account found with this email or username."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Latest unused PASSWORD_RESET OTP
        otp = (
            OTPVerification.objects
            .filter(user=user, otp_type="PASSWORD_RESET", is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp:
            return Response(
                {"detail": "No active OTP found. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if otp.is_expired():
            return Response(
                {"detail": "OTP has expired. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if otp.attempts >= 5:
            return Response(
                {"detail": "Too many wrong attempts. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.otp_code != otp_code:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = 5 - otp.attempts
            return Response(
                {"detail": f"Incorrect OTP. {remaining} attempt(s) remaining."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # OTP correct — issue a short-lived reset token
        reset_token = secrets.token_urlsafe(32)
        store_reset_token(reset_token, user.pk, ttl_minutes=15)
        otp.mark_used()

        return Response({
            "success": True,
            "reset_token": reset_token,
            "expires_in_minutes": 15,
        })


class PasswordResetOTPView(APIView):
    """POST /api/auth/otp/reset-password/ — set a new password using a valid reset token."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = PasswordResetSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reset_token      = serializer.validated_data["reset_token"]
        new_password     = serializer.validated_data["new_password"]
        confirm_password = serializer.validated_data["confirm_password"]

        # Validate reset token
        user_id = get_reset_token_user(reset_token)
        if not user_id:
            return Response(
                {"detail": "Reset link has expired or is invalid. Please request a new reset link from Forgot Password."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _User = get_user_model()
        try:
            user = _User.objects.get(pk=user_id)
        except _User.DoesNotExist:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        if new_password != confirm_password:
            return Response({"detail": "Passwords do not match."}, status=status.HTTP_400_BAD_REQUEST)

        # Strength checks — ordered most-to-least specific
        if len(new_password) < 8:
            return Response({"detail": "Password must be at least 8 characters."}, status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r"[A-Z]", new_password):
            return Response({"detail": "Password must contain at least one uppercase letter."}, status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r"[a-z]", new_password):
            return Response({"detail": "Password must contain at least one lowercase letter."}, status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r"[0-9]", new_password):
            return Response({"detail": "Password must contain at least one digit."}, status=status.HTTP_400_BAD_REQUEST)
        if not re.search(r"[!@#$%^&*]", new_password):
            return Response({"detail": "Password must contain at least one special character (!@#$%^&*)."}, status=status.HTTP_400_BAD_REQUEST)
        if user.check_password(new_password):
            return Response({"detail": "New password must be different from your current password."}, status=status.HTTP_400_BAD_REQUEST)

        # Commit password change — also invalidates existing JWTs via hash change
        user.set_password(new_password)
        user.save(update_fields=["password"])

        # Consume the token (one-time use)
        delete_reset_token(reset_token)

        # Confirmation email (best-effort; errors logged inside EmailService)
        EmailService.send_password_changed_email(user)

        return Response({
            "success": True,
            "message": "Password reset successfully. Please login with your new password.",
        })


# ══════════════════════════════════════════════════════════════════════════════
#  Backup / Recovery Email
# ══════════════════════════════════════════════════════════════════════════════

def _backup_email_verify_html(display_name: str, otp_code: str, backup_email: str, year: int) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0"
             style="background:#fff;border-radius:16px;overflow:hidden;
                    box-shadow:0 4px 32px rgba(0,0,0,.12);">
        <tr>
          <td style="background:linear-gradient(135deg,#065f46 0%,#059669 100%);
                     padding:36px 40px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:24px;font-weight:700;">
              &#128274; CamTraffic AI
            </p>
            <p style="margin:8px 0 0;color:rgba(255,255,255,.75);font-size:13px;">
              Recovery Email Verification
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <p style="margin:0 0 14px;color:#1f2937;font-size:15px;">
              Hi <strong>{display_name}</strong>,
            </p>
            <p style="margin:0 0 28px;color:#374151;font-size:15px;line-height:1.6;">
              You requested to add <strong>{backup_email}</strong> as your recovery email.
              Enter the code below to verify it — valid for <strong>10&nbsp;minutes</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="background:#f0fdf4;border:2px solid #059669;border-radius:14px;
                             padding:28px;text-align:center;">
                <p style="margin:0 0 8px;color:#6b7280;font-size:11px;
                           text-transform:uppercase;letter-spacing:3px;">Verification Code</p>
                <p style="margin:0;color:#059669;font-size:48px;font-weight:900;
                           letter-spacing:14px;font-family:monospace;">{otp_code}</p>
                <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">
                  &#9201; Expires in <strong>10 minutes</strong>
                </p>
              </td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:24px;">
              <tr><td style="background:#fffbeb;border-left:4px solid #f59e0b;
                             border-radius:6px;padding:14px 18px;">
                <p style="margin:0;color:#92400e;font-size:13px;line-height:1.5;">
                  &#9888; If you didn't request this, you can safely ignore this email.
                </p>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;
                     padding:18px 40px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">
              &copy; {year} CamTraffic AI &ndash; Traffic Expert System
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


class BackupEmailRequestView(APIView):
    """
    POST  /api/auth/backup-email/  — request OTP to verify a new backup email.
    DELETE /api/auth/backup-email/ — remove the current backup email.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BackupEmailRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_backup = serializer.validated_data["backup_email"]

        _User = get_user_model()

        if new_backup == request.user.email.lower():
            return Response(
                {"detail": "Recovery email cannot be the same as your primary email."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Must not be another user's primary email
        if _User.objects.filter(email__iexact=new_backup).exclude(pk=request.user.pk).exists():
            return Response(
                {"detail": "This email is already registered as someone else's primary email."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Must not be another user's verified backup email
        if _User.objects.filter(
            backup_email__iexact=new_backup, backup_email_verified=True
        ).exclude(pk=request.user.pk).exists():
            return Response(
                {"detail": "This email is already used as another account's recovery email."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Rate limit: max 3 EMAIL_VERIFY OTPs per hour
        window_start = timezone.now() - timedelta(hours=1)
        if OTPVerification.objects.filter(
            user=request.user, otp_type="EMAIL_VERIFY",
            is_used=False, created_at__gte=window_start,
        ).count() >= 3:
            return Response(
                {"detail": "Too many verification requests. Please wait before trying again."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        # Invalidate old EMAIL_VERIFY OTPs
        OTPVerification.objects.filter(
            user=request.user, otp_type="EMAIL_VERIFY", is_used=False
        ).update(is_used=True)

        # Cache the pending email for the confirm step
        cache.set(f"backup_email_pending:{request.user.pk}", new_backup, timeout=15 * 60)

        # Create OTP
        otp_code = generate_otp_code()
        OTPVerification.objects.create(
            user=request.user,
            otp_code=otp_code,
            otp_type="EMAIL_VERIFY",
            expires_at=timezone.now() + timedelta(minutes=10),
            ip_address=get_client_ip(request),
        )

        # Send to the NEW backup email (not primary)
        sent, send_err = EmailService.send_otp_email(
            user=request.user,
            otp_code=otp_code,
            masked_email=mask_email(new_backup),
            expires_minutes=10.0,
            to_email=new_backup,
            validity_label="10 minutes",
        )
        if not sent:
            detail = (
                f"Failed to send verification email: {send_err}"
                if settings.DEBUG and send_err
                else "Failed to send verification email. Please try again later."
            )
            return Response({"detail": detail}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        return Response({
            "success": True,
            "message": "Verification code sent to your recovery email.",
            "masked_email": mask_email(new_backup),
            "expires_in_minutes": 10,
        })

    def delete(self, request):
        user = request.user
        user.backup_email = None
        user.backup_email_verified = False
        user.save(update_fields=["backup_email", "backup_email_verified"])
        cache.delete(f"backup_email_pending:{user.pk}")
        return Response({"success": True, "message": "Recovery email removed."})


class BackupEmailConfirmView(APIView):
    """POST /api/auth/backup-email/confirm/ — verify OTP and activate backup email."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = BackupEmailConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        otp_code = serializer.validated_data["otp_code"]

        pending_email = cache.get(f"backup_email_pending:{request.user.pk}")
        if not pending_email:
            return Response(
                {"detail": "No recovery email verification in progress. Please start over."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        otp = (
            OTPVerification.objects
            .filter(user=request.user, otp_type="EMAIL_VERIFY", is_used=False)
            .order_by("-created_at")
            .first()
        )
        if not otp:
            return Response(
                {"detail": "No active OTP found. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if otp.is_expired():
            return Response(
                {"detail": "OTP has expired. Please request a new one."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if otp.attempts >= 5:
            return Response(
                {"detail": "Too many wrong attempts. Please request a new OTP."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if otp.otp_code != otp_code:
            otp.attempts += 1
            otp.save(update_fields=["attempts"])
            remaining = 5 - otp.attempts
            return Response(
                {"detail": f"Incorrect OTP. {remaining} attempt(s) remaining."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Save verified backup email
        user = request.user
        user.backup_email = pending_email
        user.backup_email_verified = True
        user.save(update_fields=["backup_email", "backup_email_verified"])
        otp.mark_used()
        cache.delete(f"backup_email_pending:{user.pk}")

        return Response({
            "success": True,
            "message": "Recovery email verified and saved.",
            "backup_email": pending_email,
            "backup_email_verified": True,
        })
