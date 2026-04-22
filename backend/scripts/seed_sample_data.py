import os
import sys
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
if BASE_DIR not in sys.path:
    sys.path.append(BASE_DIR)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "traffic_system.settings")

import django

django.setup()

from django.db import transaction
from django.utils import timezone

from accounts.models import Driver, User
from cameras.models import Camera, Road, TrafficSign
from vehicles.models import Vehicle
from violations.models import TrafficViolation


def get_or_create_driver(email, username):
    user, _ = User.objects.get_or_create(email=email, defaults={"username": username})
    driver, _ = Driver.objects.get_or_create(
        user=user,
        defaults={
            "license_number": f"LIC-{username}",
            "national_id": f"NID-{username}",
            "address": "Phnom Penh",
        },
    )
    return driver


with transaction.atomic():
    road, _ = Road.objects.get_or_create(
        code="RN1", defaults={"name": "National Road 1", "location": "Phnom Penh"}
    )
    camera, _ = Camera.objects.get_or_create(
        name="Camera A",
        defaults={"road": road, "location": "Intersection A", "active": True},
    )
    sign, _ = TrafficSign.objects.get_or_create(
        sign_type="speed_limit",
        defaults={"road": road, "location": "Zone 1", "speed_limit": 40},
    )

    driver = get_or_create_driver("driver1@example.com", "driver1")
    vehicle, _ = Vehicle.objects.get_or_create(
        plate_number="PP-1234",
        defaults={"driver": driver, "vehicle_type": "car", "make": "Toyota"},
    )

    TrafficViolation.objects.get_or_create(
        vehicle=vehicle,
        driver=driver,
        sign=sign,
        camera=camera,
        violation_type="speeding",
        defaults={
            "evidence_photo_url": "",
            "location": "Intersection A",
            "status": "pending",
            "date": timezone.now() - timedelta(hours=2),
        },
    )

print("Sample data created: road, camera, sign, driver, vehicle, violation.")
