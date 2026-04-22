from django.db import models


class Road(models.Model):
    name = models.CharField(max_length=150)
    code = models.CharField(max_length=50, unique=True)
    location = models.CharField(max_length=255, blank=True)

    def __str__(self):
        return self.name


class Camera(models.Model):
    road = models.ForeignKey(Road, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=150)
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True)
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class TrafficSignal(models.Model):
    SIGNAL_TYPES = [
        ("traffic_light", "Traffic Light"),
        ("speed_camera", "Speed Camera"),
    ]

    road = models.ForeignKey(Road, on_delete=models.SET_NULL, null=True, blank=True)
    signal_type = models.CharField(max_length=50, choices=SIGNAL_TYPES)
    location = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=50, default="active")

    def __str__(self):
        return f"{self.signal_type}"


class TrafficSign(models.Model):
    SIGN_TYPES = [
        ("speed_limit", "Speed Limit"),
        ("stop", "Stop"),
        ("no_entry", "No Entry"),
        ("yield", "Yield"),
    ]

    road = models.ForeignKey(Road, on_delete=models.SET_NULL, null=True, blank=True)
    sign_type = models.CharField(max_length=50, choices=SIGN_TYPES)
    description = models.CharField(max_length=255, blank=True)
    location = models.CharField(max_length=255, blank=True)
    speed_limit = models.PositiveIntegerField(null=True, blank=True)
    image = models.ImageField(upload_to="signs/", null=True, blank=True)

    def __str__(self):
        return self.sign_type
