from rest_framework import serializers

from .models import Vehicle


class VehicleSerializer(serializers.ModelSerializer):
    driver_name = serializers.SerializerMethodField()
    violation_count = serializers.SerializerMethodField()

    class Meta:
        model = Vehicle
        fields = [
            "id",
            "plate_number",
            "driver",
            "driver_name",
            "vehicle_type",
            "make",
            "model",
            "color",
            "year",
            "registered_at",
            "violation_count",
        ]
        read_only_fields = ["driver_name", "violation_count"]

    def get_driver_name(self, obj):
        if obj.driver and obj.driver.user:
            u = obj.driver.user
            full = f"{u.first_name} {u.last_name}".strip()
            return full or u.username
        return None

    def get_violation_count(self, obj):
        return obj.trafficviolation_set.count()
