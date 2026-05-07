from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AvatarUploadView,
    BackupEmailConfirmView,
    BackupEmailRequestView,
    ChangeEmailConfirmView,
    ChangeEmailRequestView,
    ChangePasswordView,
    DeleteAccountView,
    FacebookSocialAuthView,
    GitHubSocialAuthView,
    GoogleSocialAuthView,
    LoginView,
    MicrosoftSocialAuthView,
    OTPRequestView,
    OTPVerifyView,
    PasswordResetConfirmView,
    PasswordResetOTPView,
    PasswordResetRequestView,
    ProfileView,
    RegisterView,
    UserManagementViewSet,
)

router = DefaultRouter()
router.register("users", UserManagementViewSet, basename="user-management")

urlpatterns = [
    path("register/",               RegisterView.as_view(),             name="register"),
    path("login/",                  LoginView.as_view(),                name="login"),
    path("token/refresh/",          TokenRefreshView.as_view(),         name="token-refresh"),
    path("profile/",                ProfileView.as_view(),              name="profile"),
    path("avatar/",                 AvatarUploadView.as_view(),         name="avatar-upload"),
    path("change-password/",        ChangePasswordView.as_view(),       name="change-password"),
    path("change-email/request/",  ChangeEmailRequestView.as_view(),    name="change-email-request"),
    path("change-email/confirm/",  ChangeEmailConfirmView.as_view(),    name="change-email-confirm"),
    path("delete-account/",          DeleteAccountView.as_view(),         name="delete-account"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    # OTP Password-Reset (3-step flow)
    path("otp/request/",        OTPRequestView.as_view(),       name="otp-request"),
    path("otp/verify/",         OTPVerifyView.as_view(),        name="otp-verify"),
    path("otp/reset-password/", PasswordResetOTPView.as_view(), name="otp-reset-password"),
    # Backup / recovery email management
    path("backup-email/",         BackupEmailRequestView.as_view(), name="backup-email"),
    path("backup-email/confirm/", BackupEmailConfirmView.as_view(), name="backup-email-confirm"),
    # Social OAuth
    path("social/google/",          GoogleSocialAuthView.as_view(),     name="social-google"),
    path("social/github/",          GitHubSocialAuthView.as_view(),     name="social-github"),
    path("social/facebook/",        FacebookSocialAuthView.as_view(),   name="social-facebook"),
    path("social/microsoft/",       MicrosoftSocialAuthView.as_view(),  name="social-microsoft"),
    # User management (admin)
    path("", include(router.urls)),
]

