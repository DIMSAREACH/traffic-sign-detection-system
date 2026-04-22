from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AvatarUploadView,
    ChangePasswordView,
    DeleteAccountView,
    FacebookSocialAuthView,
    GitHubSocialAuthView,
    GoogleSocialAuthView,
    LoginView,
    MicrosoftSocialAuthView,
    PasswordResetConfirmView,
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
    path("delete-account/",          DeleteAccountView.as_view(),         name="delete-account"),
    path("password-reset/request/", PasswordResetRequestView.as_view(), name="password-reset-request"),
    path("password-reset/confirm/", PasswordResetConfirmView.as_view(), name="password-reset-confirm"),
    # Social OAuth
    path("social/google/",          GoogleSocialAuthView.as_view(),     name="social-google"),
    path("social/github/",          GitHubSocialAuthView.as_view(),     name="social-github"),
    path("social/facebook/",        FacebookSocialAuthView.as_view(),   name="social-facebook"),
    path("social/microsoft/",       MicrosoftSocialAuthView.as_view(),  name="social-microsoft"),
    # User management (admin)
    path("", include(router.urls)),
]

