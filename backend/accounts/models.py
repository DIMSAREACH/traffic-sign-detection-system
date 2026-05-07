import uuid
from datetime import timedelta

from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        user = self.create_user(email, password, **extra_fields)
        # Ensure superusers are also recognized as admins in role-based checks.
        role, _ = Role.objects.get_or_create(name="admin")
        UserRole.objects.get_or_create(user=user, role=role)
        return user


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    username = models.CharField(max_length=150, unique=True)
    first_name = models.CharField(max_length=150, blank=True)
    last_name = models.CharField(max_length=150, blank=True)
    phone = models.CharField(max_length=50, blank=True, null=True, unique=True)
    avatar = models.ImageField(upload_to="avatars/", null=True, blank=True)
    # Security / account state
    email_verified = models.BooleanField(default=False)
    failed_login_count = models.PositiveIntegerField(default=0)
    locked_until = models.DateTimeField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    # Recovery (backup) email — must be verified before use
    backup_email          = models.EmailField(null=True, blank=True)
    backup_email_verified = models.BooleanField(default=False)
    allow_backup_password_reset = models.BooleanField(default=True)
    # Email visibility & password-reset policy (user-controlled via profile)
    keep_email_private = models.BooleanField(
        default=True,
        help_text="When True, mask this user's emails for other non-admin API consumers.",
    )
    block_unverified_email_reset = models.BooleanField(
        default=False,
        help_text="When True, password-reset OTP to the primary email requires email_verified.",
    )

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username"]

    def __str__(self):
        return self.email

    def save(self, *args, **kwargs):
        # Normalize empty phone to None so unique constraint allows multiple blanks
        if not self.phone:
            self.phone = None
        # Ensure email is stored normalized (lowercase, trimmed)
        if self.email:
            try:
                self.email = self.__class__.objects.normalize_email(self.email).strip().lower()
            except Exception:
                self.email = (self.email or "").strip().lower()
        super().save(*args, **kwargs)

    def has_role(self, role_name):
        role = (role_name or "").strip().lower()
        if role == "admin" and (self.is_staff or self.is_superuser):
            return True
        return self.user_roles.filter(role__name=role).exists()

    def is_locked(self):
        from django.utils import timezone
        return bool(self.locked_until and self.locked_until > timezone.now())

    def clear_lockout(self, save=False):
        self.failed_login_count = 0
        self.locked_until = None
        if save:
            self.save(update_fields=["failed_login_count", "locked_until"])


class Role(models.Model):
    name = models.CharField(max_length=100, unique=True)
    description = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class Permission(models.Model):
    name = models.CharField(max_length=100, unique=True)
    code = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(
        Permission, on_delete=models.CASCADE, related_name="role_permissions"
    )

    class Meta:
        unique_together = ("role", "permission")


class UserRole(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")

    class Meta:
        unique_together = ("user", "role")


class Driver(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="driver_profile")
    license_number = models.CharField(max_length=100, unique=True, blank=True, default="")
    national_id = models.CharField(max_length=100, unique=True, blank=True, default="")
    address = models.CharField(max_length=255, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Driver {self.user.email}"


class Officer(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name="officer_profile")
    badge_number = models.CharField(max_length=100, unique=True, blank=True, default="")
    station = models.CharField(max_length=150, blank=True)
    rank = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f"Officer {self.user.email}"


class OTPVerification(models.Model):
    OTP_TYPE_CHOICES = [
        ("PASSWORD_RESET", "Password Reset"),
        ("LOGIN_2FA",      "Login 2FA"),
        ("EMAIL_VERIFY",   "Email Verify"),
    ]

    otp_id     = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(User, on_delete=models.CASCADE, related_name="otps")
    otp_code   = models.CharField(max_length=6)
    otp_type   = models.CharField(max_length=20, choices=OTP_TYPE_CHOICES)
    is_used    = models.BooleanField(default=False)
    attempts   = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    ip_address = models.GenericIPAddressField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"OTP({self.otp_type}) for {self.user.email}"

    def is_expired(self):
        return timezone.now() > self.expires_at

    def is_valid(self):
        return not self.is_used and not self.is_expired() and self.attempts < 5

    def mark_used(self):
        self.is_used = True
        self.save(update_fields=["is_used"])
