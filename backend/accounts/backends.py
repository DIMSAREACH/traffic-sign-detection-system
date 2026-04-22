from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

User = get_user_model()


class EmailBackend(ModelBackend):
    """Authenticate using email instead of username.

    Normalizes email and performs case-insensitive lookup to avoid duplicates
    caused by casing/whitespace differences.
    """

    def authenticate(self, request, email=None, password=None, **kwargs):
        if email is None:
            email = kwargs.get("username")
        if email is None or password is None:
            return None

        # Normalize and use case-insensitive lookup
        try:
            email_norm = User.objects.normalize_email(email).strip().lower()
        except Exception:
            email_norm = (email or "").strip().lower()

        try:
            user = User.objects.get(email__iexact=email_norm)
        except User.DoesNotExist:
            User().set_password(password)  # timing mitigation
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None