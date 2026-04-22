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


def create_user_with_role(email, username, password, role_name, **user_fields):
    user, created = User.objects.get_or_create(
        email=email, defaults={"username": username, **user_fields}
    )
    if created:
        user.set_password(password)
        user.save()
    else:
        updated_fields = []
        for key, value in user_fields.items():
            if getattr(user, key) != value:
                setattr(user, key, value)
                updated_fields.append(key)
        if updated_fields:
            user.save(update_fields=updated_fields)
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
