from django.db import models

from accounts.models import Driver
from cameras.models import Camera, TrafficSign
from vehicles.models import Vehicle


class TrafficViolation(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("verified", "Verified"),
        ("resolved", "Resolved"),
        ("rejected", "Rejected"),
    ]

    SEVERITY_CHOICES = [
        ("critical", "Critical"),
        ("high", "High"),
        ("medium", "Medium"),
        ("low", "Low"),
        ("warning", "Warning"),
    ]

    vehicle = models.ForeignKey(Vehicle, on_delete=models.SET_NULL, null=True, blank=True)
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True)
    sign = models.ForeignKey(TrafficSign, on_delete=models.SET_NULL, null=True, blank=True)
    camera = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True, blank=True)
    violation_type = models.CharField(max_length=100)
    severity = models.CharField(max_length=20, choices=SEVERITY_CHOICES, default="medium")
    evidence_photo_url = models.URLField(blank=True)
    location = models.CharField(max_length=255, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    date = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.violation_type} - {self.date}"


class Fine(models.Model):
    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("paid", "Paid"),
        ("overdue", "Overdue"),
    ]

    violation = models.OneToOneField(
        TrafficViolation, on_delete=models.CASCADE, related_name="fine"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    due_date = models.DateField()
    payment_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f"Fine {self.amount}"


class Payment(models.Model):
    METHOD_CHOICES = [
        ("cash", "Cash"),
        ("bank_transfer", "Bank Transfer"),
        ("credit_card", "Credit Card"),
        ("mobile_payment", "Mobile Payment"),
    ]

    STATUS_CHOICES = [
        ("pending", "Pending"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("refunded", "Refunded"),
    ]

    violation = models.ForeignKey(
        TrafficViolation, on_delete=models.CASCADE, related_name="payments"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default="cash")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    reference = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Payment {self.amount} ({self.status})"
