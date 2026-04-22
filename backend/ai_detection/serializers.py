from rest_framework import serializers

from .models import AIDetectionLog, LicensePlateLog


class AIDetectionLogSerializer(serializers.ModelSerializer):
    camera_name = serializers.CharField(source="camera.name", read_only=True, default=None)
    violation_type = serializers.CharField(
        source="created_violation.violation_type", read_only=True, default=None
    )

    class Meta:
        model = AIDetectionLog
        fields = [
            "id",
            "camera",
            "camera_name",
            "detected_object",
            "confidence_score",
            "image_url",
            "detected_at",
            "processed",
            "created_violation",
            "violation_type",
        ]


class LicensePlateLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = LicensePlateLog
        fields = ["id", "camera", "detected_plate", "confidence_score", "detected_at"]
