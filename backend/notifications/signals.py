from django.db.models.signals import post_save
from django.dispatch import receiver

from violations.models import Fine, TrafficViolation


def _staff_users():
    """Return all active admin/officer users."""
    from django.contrib.auth import get_user_model
    from accounts.models import UserRole

    User = get_user_model()
    staff_ids = UserRole.objects.filter(
        role__name__in=["admin", "officer"]
    ).values_list("user_id", flat=True)
    return User.objects.filter(id__in=staff_ids, is_active=True)


def _bulk_notify(users, title, message, notif_type):
    from .models import Notification

    Notification.objects.bulk_create([
        Notification(user=u, title=title, message=message, notif_type=notif_type)
        for u in users
    ])


@receiver(post_save, sender=TrafficViolation)
def notify_new_violation(sender, instance, created, **kwargs):
    if not created:
        return
    vtype = instance.violation_type.replace("_", " ").title()
    sev = instance.severity.capitalize()
    loc = f" at {instance.location}" if instance.location else ""
    _bulk_notify(
        _staff_users(),
        title=f"New {vtype} Violation",
        message=f"{sev} severity violation detected{loc}.",
        notif_type="violation",
    )


@receiver(post_save, sender=Fine)
def notify_new_fine(sender, instance, created, **kwargs):
    if not created:
        return
    amount = float(instance.amount)
    _bulk_notify(
        _staff_users(),
        title="New Fine Issued",
        message=f"A fine of ${amount:,.2f} has been issued (due {instance.due_date}).",
        notif_type="fine",
    )
