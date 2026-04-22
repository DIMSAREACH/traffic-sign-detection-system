from django.db import transaction

from .models import Fine, TrafficViolation
from .utils import calculate_fine_amount, default_due_date


@transaction.atomic
def create_violation_with_fine(**violation_data):
    violation = TrafficViolation.objects.create(**violation_data)
    Fine.objects.get_or_create(
        violation=violation,
        defaults={
            "amount": calculate_fine_amount(violation.violation_type),
            "due_date": default_due_date(),
        },
    )
    return violation
