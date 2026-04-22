from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Fine, TrafficViolation
from .utils import calculate_fine_amount, default_due_date


@receiver(post_save, sender=TrafficViolation)
def create_fine_on_violation(sender, instance, created, **kwargs):
    if not created:
        return
    Fine.objects.get_or_create(
        violation=instance,
        defaults={
            "amount": calculate_fine_amount(instance.violation_type),
            "due_date": default_due_date(),
        },
    )
