from django.contrib.auth import authenticate
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Driver, Officer, Permission, Role, RolePermission, User, UserRole


class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = ["id", "name", "description"]


class PermissionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Permission
        fields = ["id", "name", "code"]


class UserRoleSerializer(serializers.ModelSerializer):
    role = RoleSerializer(read_only=True)

    class Meta:
        model = UserRole
        fields = ["id", "role"]


class DriverProfileInlineSerializer(serializers.ModelSerializer):
    """Lightweight driver‑profile for nesting inside UserSerializer."""
    class Meta:
        model = Driver
        fields = ["license_number", "national_id", "address", "date_of_birth"]


class OfficerProfileInlineSerializer(serializers.ModelSerializer):
    """Lightweight officer‑profile for nesting inside UserSerializer."""
    class Meta:
        model = Officer
        fields = ["badge_number", "station", "rank"]


class UserSerializer(serializers.ModelSerializer):
    roles = UserRoleSerializer(many=True, source="user_roles", read_only=True)
    avatar_url = serializers.SerializerMethodField()
    role = serializers.SerializerMethodField()
    driver_profile = DriverProfileInlineSerializer(read_only=True)
    officer_profile = OfficerProfileInlineSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "email",
            "username",
            "first_name",
            "last_name",
            "phone",
            "avatar_url",
            "is_active",
            "date_joined",
            "last_login",
            "roles",
            "role",
            "driver_profile",
            "officer_profile",
        ]

    def get_avatar_url(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(obj.avatar.url)
        return obj.avatar.url

    def get_role(self, obj):
        """Return the primary role name (admin > officer > driver) as a flat string."""
        if obj.is_staff or obj.is_superuser:
            return "admin"
        role_names = {ur.role.name for ur in obj.user_roles.select_related("role").all()}
        for r in ("admin", "officer", "driver"):
            if r in role_names:
                return r
        return "officer"  # safe default


class ProfileUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["username", "first_name", "last_name", "phone"]


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ["email", "username", "password", "first_name", "last_name", "phone"]

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value.lower().strip()

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("A user with this username already exists.")
        return value.strip()

    def validate_phone(self, value):
        phone = (value or "").strip() or None
        if phone and User.objects.filter(phone=phone).exists():
            raise serializers.ValidationError("A user with this phone number already exists.")
        return phone

    def validate_password(self, value):
        import re
        if len(value) < 8:
            raise serializers.ValidationError("Password must be at least 8 characters.")
        checks = [
            (r"[A-Z]", "one uppercase letter"),
            (r"[0-9]", "one number"),
            (r"[^A-Za-z0-9]", "one special character"),
        ]
        missing = [msg for pat, msg in checks if not re.search(pat, value)]
        if missing:
            raise serializers.ValidationError(f"Password must contain {', '.join(missing)}.")
        return value

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        # Auto-assign "driver" role so the user can log in immediately
        role, _ = Role.objects.get_or_create(name="driver")
        UserRole.objects.get_or_create(user=user, role=role)
        return user


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    role = serializers.CharField(required=False, default="")

    def validate(self, attrs):
        email = attrs.get("email", "").strip().lower()
        password = attrs.get("password")

        # Check if user exists first — gives a clearer error
        from .models import User as UserModel
        if not UserModel.objects.filter(email=email).exists():
            raise serializers.ValidationError("No account found with this email address.")

        user = authenticate(email=email, password=password)
        if not user:
            raise serializers.ValidationError("Incorrect password. Please try again.")

        if not user.is_active:
            raise serializers.ValidationError("This account has been deactivated.")

        # If a role tab was selected, verify the user actually has that role
        requested_role = attrs.get("role", "").strip().lower()
        if requested_role:
            if not user.has_role(requested_role):
                raise serializers.ValidationError(
                    f"This account does not have the '{requested_role}' role."
                )

        from django.utils import timezone
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        refresh = RefreshToken.for_user(user)
        return {
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": UserSerializer(user, context=self.context).data,
        }


class DriverSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Driver
        fields = ["id", "user", "license_number", "national_id", "address", "date_of_birth"]


class OfficerSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Officer
        fields = ["id", "user", "badge_number", "station", "rank"]
