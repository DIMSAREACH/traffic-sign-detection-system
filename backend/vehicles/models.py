from django.db import models

from accounts.models import Driver


class Vehicle(models.Model):
    VEHICLE_TYPES = [
        ("car", "Car"),
        ("motorbike", "Motorbike"),
        ("truck", "Truck"),
        ("bus", "Bus"),
    ]

    plate_number = models.CharField(max_length=50, unique=True)
    driver = models.ForeignKey(Driver, on_delete=models.SET_NULL, null=True, blank=True)
    vehicle_type = models.CharField(max_length=20, choices=VEHICLE_TYPES)
    make = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    color = models.CharField(max_length=50, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    registered_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.plate_number
