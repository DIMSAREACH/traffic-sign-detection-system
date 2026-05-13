from rest_framework import serializers

from .models import Fine, Payment, TrafficViolation
from .services import create_violation_with_fine


class TrafficViolationSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficViolation
        fields = [
            "id",
            "vehicle",
            "driver",
            "sign",
            "camera",
            "violation_type",
            "severity",
            "evidence_photo_url",
            "location",
            "latitude",
            "longitude",
            "status",
            "date",
        ]

    def create(self, validated_data):
        return create_violation_with_fine(**validated_data)


class FineSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fine
        fields = [
            "id",
            "violation",
            "amount",
            "status",
            "due_date",
            "payment_date",
        ]


class FineDetailSerializer(serializers.ModelSerializer):
    """Rich read-serializer for fine detail — includes linked violation info."""

    violation_type = serializers.CharField(source="violation.violation_type", read_only=True)
    violation_severity = serializers.CharField(source="violation.severity", read_only=True)
    violation_status = serializers.CharField(source="violation.status", read_only=True)
    violation_location = serializers.CharField(source="violation.location", read_only=True)
    violation_date = serializers.DateTimeField(source="violation.date", read_only=True)
    vehicle_display = serializers.SerializerMethodField()
    driver_display = serializers.SerializerMethodField()

    class Meta:
        model = Fine
        fields = [
            "id",
            "violation",
            "amount",
            "status",
            "due_date",
            "payment_date",
            "violation_type",
            "violation_severity",
            "violation_status",
            "violation_location",
            "violation_date",
            "vehicle_display",
            "driver_display",
        ]

    @staticmethod
    def get_vehicle_display(obj):
        v = obj.violation
        return str(v.vehicle) if v and v.vehicle else None

    @staticmethod
    def get_driver_display(obj):
        v = obj.violation
        if v and v.driver and v.driver.user:
            u = v.driver.user
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return None


class FineNestedSerializer(serializers.ModelSerializer):
    """Lightweight serializer used when nesting a fine inside a violation."""

    class Meta:
        model = Fine
        fields = ["id", "amount", "status", "due_date", "payment_date"]


class TrafficViolationDetailSerializer(serializers.ModelSerializer):
    """Rich read-serializer returned on retrieve — includes display names & nested fine."""

    fine = FineNestedSerializer(read_only=True)
    vehicle_display = serializers.SerializerMethodField()
    driver_display = serializers.SerializerMethodField()
    camera_display = serializers.SerializerMethodField()
    sign_display = serializers.SerializerMethodField()

    class Meta:
        model = TrafficViolation
        fields = [
            "id",
            "vehicle",
            "vehicle_display",
            "driver",
            "driver_display",
            "sign",
            "sign_display",
            "camera",
            "camera_display",
            "violation_type",
            "severity",
            "evidence_photo_url",
            "location",
            "latitude",
            "longitude",
            "status",
            "date",
            "fine",
        ]

    @staticmethod
    def get_vehicle_display(obj):
        return str(obj.vehicle) if obj.vehicle else None

    @staticmethod
    def get_driver_display(obj):
        if obj.driver and obj.driver.user:
            u = obj.driver.user
            name = f"{u.first_name} {u.last_name}".strip() or u.email
            return name
        return None

    @staticmethod
    def get_camera_display(obj):
        return str(obj.camera) if obj.camera else None

    @staticmethod
    def get_sign_display(obj):
        return str(obj.sign) if obj.sign else None


class PaymentSerializer(serializers.ModelSerializer):
    violation_type = serializers.CharField(source="violation.violation_type", read_only=True)
    driver_display = serializers.SerializerMethodField()
    vehicle_display = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = [
            "id",
            "violation",
            "amount",
            "method",
            "status",
            "reference",
            "notes",
            "created_at",
            "violation_type",
            "driver_display",
            "vehicle_display",
        ]
        read_only_fields = ["created_at"]

    @staticmethod
    def get_driver_display(obj):
        v = obj.violation
        if v and v.driver and v.driver.user:
            u = v.driver.user
            return f"{u.first_name} {u.last_name}".strip() or u.email
        return None

    @staticmethod
    def get_vehicle_display(obj):
        v = obj.violation
        return str(v.vehicle) if v and v.vehicle else None
