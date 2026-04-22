from datetime import timedelta

from django.utils import timezone


def calculate_fine_amount(violation_type):
    mapping = {
        "speeding": 25.00,
        "red_light": 30.00,
        "no_entry": 20.00,
        "helmet": 10.00,
    }
    return mapping.get(violation_type, 15.00)


def default_due_date():
    return timezone.now().date() + timedelta(days=14)
