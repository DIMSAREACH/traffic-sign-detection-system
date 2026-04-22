import random
import re
import time

import requests as http_requests
from django.conf import settings
from django.contrib.auth import get_user_model
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

from .models import Driver, Officer, Role, UserRole
from .permissions import AdminDeleteOnly, AdminWriteOnly, IsAdminRole
from .serializers import (
    DriverSerializer,
    LoginSerializer,
    OfficerSerializer,
    ProfileUpdateSerializer,
    RegisterSerializer,
    UserSerializer,
)


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = [permissions.AllowAny]


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

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
    """POST { email } — generates a 6-digit OTP (returned in response for demo)."""
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        email = (request.data.get("email") or "").strip().lower()
        if not email:
            return Response({"detail": "Email is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            User.objects.get(email=email)
        except User.DoesNotExist:
            # Don't reveal whether the email exists
            return Response({"detail": "If that email is registered you will receive an OTP."})

        otp = f"{random.randint(0, 999999):06d}"
        _reset_codes[email] = (otp, time.time() + _RESET_TTL)

        return Response({
            "detail": "OTP generated.",
            "otp": otp,          # demo only – remove in production and send via email
        })


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
        access_token = token_resp.json().get("access_token")
        if not access_token:
            return Response({"detail": "Failed to exchange GitHub code."}, status=status.HTTP_400_BAD_REQUEST)

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
