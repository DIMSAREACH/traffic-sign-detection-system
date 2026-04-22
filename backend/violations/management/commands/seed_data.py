"""
Management command: seed_data
Usage:  python manage.py seed_data
        python manage.py seed_data --clear   (wipe existing data first)

Creates:
  - 5 Roads + 8 Cameras (6 active)
  - 4 TrafficSigns
  - 12 Vehicles with drivers
  - 60 Violations spread over the last 60 days (all severities / statuses)
  - 60 Fines (mix of paid / pending / overdue)
"""

import random
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from accounts.models import Driver, Role, User, UserRole
from cameras.models import Camera, Road, TrafficSign
from vehicles.models import Vehicle
from violations.models import Fine, TrafficViolation


VIOLATION_TYPES = [
    ("speed_limit",    "high"),
    ("red_light",      "critical"),
    ("no_entry",       "high"),
    ("wrong_way",      "critical"),
    ("illegal_parking","low"),
    ("no_seatbelt",    "medium"),
    ("mobile_phone",   "medium"),
    ("no_helmet",      "medium"),
    ("overloading",    "warning"),
    ("lane_violation", "warning"),
]

LOCATIONS = [
    "Monivong Blvd, Phnom Penh",
    "Norodom Blvd, Phnom Penh",
    "Street 271, Toul Kork",
    "National Road 4, Kandal",
    "Russian Blvd, Phnom Penh",
    "Mao Tse Toung Blvd",
    "Sihanouk Blvd",
    "Olympic Stadium Area",
]

FINE_AMOUNTS = {
    "critical": 200,
    "high":     150,
    "medium":   100,
    "low":       50,
    "warning":   25,
}

VEHICLE_DATA = [
    ("ABC-1234", "car",       "Toyota",   "Camry",    "White",  2019),
    ("DEF-5678", "car",       "Honda",    "Civic",    "Black",  2021),
    ("GHI-9012", "motorbike", "Honda",    "Wave",     "Red",    2020),
    ("JKL-3456", "truck",     "Isuzu",    "D-MAX",    "Blue",   2018),
    ("MNO-7890", "car",       "Toyota",   "Fortuner", "Silver", 2022),
    ("PQR-1122", "motorbike", "Yamaha",   "NMAX",     "Black",  2021),
    ("STU-3344", "bus",       "Hyundai",  "County",   "White",  2017),
    ("VWX-5566", "car",       "Lexus",    "RX350",    "Gray",   2023),
    ("YZA-7788", "car",       "Kia",      "Sportage", "Blue",   2020),
    ("BCD-9900", "motorbike", "Kawasaki", "Ninja",    "Green",  2022),
    ("EFG-1111", "truck",     "Ford",     "Ranger",   "Orange", 2019),
    ("HIJ-2222", "car",       "BMW",      "X5",       "Black",  2024),
]


class Command(BaseCommand):
    help = "Seed sample data: roads, cameras, vehicles, violations, fines"

    def add_arguments(self, parser):
        parser.add_argument("--clear", action="store_true", help="Clear existing seeded data first")

    def handle(self, *args, **options):
        if options["clear"]:
            self.stdout.write("Clearing existing data…")
            from django.db import connection
            with connection.cursor() as cur:
                cur.execute("TRUNCATE violations_fine, violations_trafficviolation RESTART IDENTITY CASCADE;")
                cur.execute("DELETE FROM vehicles_vehicle WHERE plate_number = ANY(%s);",
                            [[v[0] for v in VEHICLE_DATA]])
                cur.execute("DELETE FROM cameras_camera WHERE name LIKE 'CAM-%%';")
                cur.execute("DELETE FROM cameras_road WHERE code LIKE 'SEED-%%';")
            self.stdout.write(self.style.WARNING("Cleared."))

        # ── 1. Roads ─────────────────────────────────────────────────
        road_names = [
            ("SEED-R1", "Monivong Blvd"),
            ("SEED-R2", "Norodom Blvd"),
            ("SEED-R3", "Russian Blvd"),
            ("SEED-R4", "National Road 4"),
            ("SEED-R5", "Sihanouk Blvd"),
        ]
        roads = []
        for code, name in road_names:
            r, _ = Road.objects.get_or_create(code=code, defaults={"name": name, "location": f"{name}, Phnom Penh"})
            roads.append(r)
        self.stdout.write(f"  Roads:    {len(roads)}")

        # ── 2. Cameras ───────────────────────────────────────────────
        cam_specs = [
            ("CAM-001", roads[0], "192.168.1.1",  True),
            ("CAM-002", roads[0], "192.168.1.2",  True),
            ("CAM-003", roads[1], "192.168.1.3",  True),
            ("CAM-004", roads[1], "192.168.1.4",  True),
            ("CAM-005", roads[2], "192.168.1.5",  True),
            ("CAM-006", roads[3], "192.168.1.6",  True),
            ("CAM-007", roads[4], "192.168.1.7",  False),
            ("CAM-008", roads[4], "192.168.1.8",  False),
        ]
        cameras = []
        for name, road, ip, active in cam_specs:
            c, _ = Camera.objects.get_or_create(
                name=name,
                defaults={"road": road, "ip_address": ip, "location": road.location, "active": active},
            )
            cameras.append(c)
        self.stdout.write(f"  Cameras:  {len(cameras)} (6 active)")

        # ── 3. TrafficSigns ──────────────────────────────────────────
        sign_specs = [
            ("speed_limit", "Max 60 km/h"),
            ("stop",        "Mandatory stop"),
            ("no_entry",    "No entry zone"),
            ("yield",       "Yield to traffic"),
        ]
        signs = []
        for sign_type, desc in sign_specs:
            s, _ = TrafficSign.objects.get_or_create(
                sign_type=sign_type,
                defaults={"road": roads[0], "description": desc, "location": roads[0].location},
            )
            signs.append(s)
        self.stdout.write(f"  Signs:    {len(signs)}")

        # ── 4. Driver role ───────────────────────────────────────────
        driver_role, _ = Role.objects.get_or_create(name="driver")

        # ── 5. Vehicles + Drivers ────────────────────────────────────
        vehicle_objs = []
        for i, (plate, vtype, make, model, color, year) in enumerate(VEHICLE_DATA):
            # create a user + driver for each vehicle
            uname  = f"driver{i+1:02d}"
            email  = f"{uname}@seed.local"
            fname  = ["Sok", "Chan", "Dara", "Vuth", "Rina", "Pov", "Lina", "Bora",
                      "Mony", "Vibol", "Ratana", "Sophea"][i]
            lname  = ["Kim", "Pov", "Sen", "Ly", "Heng", "Sarun", "Vann", "Srey",
                      "Penh", "Keo", "Nhem", "Thai"][i]

            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": uname,
                    "first_name": fname,
                    "last_name": lname,
                },
            )
            if created:
                user.set_password("Seed@12345")
                user.save()
            UserRole.objects.get_or_create(user=user, role=driver_role)

            driver, _ = Driver.objects.get_or_create(
                user=user,
                defaults={
                    "license_number": f"LIC-{plate}",
                    "national_id":    f"NID-{plate}",
                    "address":        random.choice(LOCATIONS),
                },
            )

            vehicle, _ = Vehicle.objects.get_or_create(
                plate_number=plate,
                defaults={
                    "driver":       driver,
                    "vehicle_type": vtype,
                    "make":         make,
                    "model":        model,
                    "color":        color,
                    "year":         year,
                },
            )
            vehicle_objs.append(vehicle)
        self.stdout.write(f"  Vehicles: {len(vehicle_objs)}")

        # ── 6. Violations + Fines ────────────────────────────────────
        created_v = 0
        today = date.today()

        for day_offset in range(60):
            target_date = today - timedelta(days=day_offset)
            dt = timezone.make_aware(
                timezone.datetime(target_date.year, target_date.month, target_date.day,
                                  random.randint(6, 22), random.randint(0, 59))
            )

            # 1–2 violations per day
            for _ in range(random.randint(1, 2)):
                vtype, severity = random.choice(VIOLATION_TYPES)

                # bias status: recent → pending, older → verified or resolved
                if day_offset < 7:
                    vstatus = random.choice(["pending", "pending", "verified"])
                elif day_offset < 30:
                    vstatus = random.choice(["pending", "verified", "verified", "resolved"])
                else:
                    vstatus = random.choice(["verified", "resolved", "resolved"])

                vehicle = random.choice(vehicle_objs)
                camera  = random.choice(cameras[:6])  # active cameras only

                v = TrafficViolation.objects.create(
                    vehicle=vehicle,
                    driver=vehicle.driver,
                    camera=camera,
                    violation_type=vtype,
                    severity=severity,
                    location=camera.location,
                    status=vstatus,
                )
                # force the date back in time
                TrafficViolation.objects.filter(pk=v.pk).update(date=dt)

                # fine
                base   = FINE_AMOUNTS[severity]
                amount = base + random.choice([-10, 0, 0, 10, 25])
                due    = target_date + timedelta(days=30)

                if vstatus == "resolved":
                    fstatus = "paid"
                    pay_date = target_date + timedelta(days=random.randint(1, 29))
                elif due < today:
                    fstatus = random.choice(["overdue", "overdue", "paid"])
                    pay_date = target_date + timedelta(days=random.randint(1, 25)) if fstatus == "paid" else None
                else:
                    fstatus = "pending"
                    pay_date = None

                Fine.objects.update_or_create(
                    violation=v,
                    defaults=dict(
                        amount=amount,
                        status=fstatus,
                        due_date=due,
                        payment_date=pay_date,
                    ),
                )
                created_v += 1

        self.stdout.write(f"  Violations + Fines: {created_v}")
        self.stdout.write(self.style.SUCCESS("\nSeed complete!"))
