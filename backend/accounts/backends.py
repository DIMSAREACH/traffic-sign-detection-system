from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

User = get_user_model()


class EmailBackend(ModelBackend):
    """Authenticate using email instead of username."""

    def authenticate(self, request, email=None, password=None, **kwargs):
        if email is None:
            email = kwargs.get("username")
        if email is None or password is None:
            return None
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            User().set_password(password)  # timing attack mitigation
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

User = get_user_model()

class EmailBackend(ModelBackend):
    def authenticate(self, request, email=None, password=None, **kwargs):
        if email is None:
            email = kwargs.get("username")
        if email is None or password is None:
            return None
        # Normalize and use case-insensitive lookup
        email = User.objects.normalize_email(email).strip().lower()
        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            User().set_password(password)  # timing mitigation
            return None
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None