from django.db import models

from cameras.models import Camera
from violations.models import TrafficViolation


class AIDetectionLog(models.Model):
    camera = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True, blank=True)
    detected_object = models.CharField(max_length=100)
    confidence_score = models.FloatField()
    image_url = models.URLField(blank=True)
    detected_at = models.DateTimeField()
    processed = models.BooleanField(default=False)
    created_violation = models.ForeignKey(
        TrafficViolation, on_delete=models.SET_NULL, null=True, blank=True
    )

    def __str__(self):
        return f"{self.detected_object} {self.detected_at}"


class LicensePlateLog(models.Model):
    camera = models.ForeignKey(Camera, on_delete=models.SET_NULL, null=True, blank=True)
    detected_plate = models.CharField(max_length=50)
    confidence_score = models.FloatField()
    detected_at = models.DateTimeField()

    def __str__(self):
        return self.detected_plate
