import os
import sys

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "traffic_system.settings")

import django

django.setup()

from django.db import transaction

from accounts.models import Driver, Officer, Role, User, UserRole

from django.contrib.auth import get_user_model
UserModel = get_user_model()


def create_user_with_role(email, username, password, role_name, update_password=False, **user_fields):
    # Normalize email for lookup
    try:
        email_norm = UserModel.objects.normalize_email(email).strip().lower()
    except Exception:
        email_norm = (email or "").strip().lower()

    user = UserModel.objects.filter(email__iexact=email_norm).first()
    created = False
    if not user:
        user = UserModel.objects.create_user(email=email_norm, password=password, username=username, **user_fields)
        created = True
    else:
        updated = False
        for key, value in user_fields.items():
            if getattr(user, key) != value:
                setattr(user, key, value)
                updated = True
        if update_password:
            user.set_password(password)
            updated = True
        if updated:
            user.save()

    role = Role.objects.get(name=role_name)
    UserRole.objects.get_or_create(user=user, role=role)
    return user, created


with transaction.atomic():
    for name in ("admin", "officer", "driver"):
        Role.objects.get_or_create(name=name)

    admin_user, admin_created = create_user_with_role(
        "dimsareach009@gmail.com", "dimsareach009", "admin123", "admin",
        is_staff=True,
    )

    officer_user, officer_created = create_user_with_role(
        "sareach@gmail.com", "sareach", "12345", "officer"
    )
    Officer.objects.get_or_create(
        user=officer_user,
        defaults={
            "badge_number": f"OFF-{officer_user.username}",
            "station": "Main",
            "rank": "Officer",
        },
    )

    driver_user, driver_created = create_user_with_role(
        "reaksa@gmail.com", "reaksa", "12345", "driver"
    )
    Driver.objects.get_or_create(
        user=driver_user,
        defaults={
            "license_number": f"LIC-{driver_user.username}",
            "national_id": f"NID-{driver_user.username}",
            "address": "",
        },
    )

print(f"Admin user: {admin_user.email} (created={admin_created})")
print(f"Officer user: {officer_user.email} (created={officer_created})")
print(f"Driver user: {driver_user.email} (created={driver_created})")
