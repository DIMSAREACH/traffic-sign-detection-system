from rest_framework import serializers
from .models import IssueReport


class IssueReportSerializer(serializers.ModelSerializer):
    user_email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = IssueReport
        fields = [
            "id",
            "user",
            "user_email",
            "type",
            "priority",
            "subject",
            "description",
            "screenshot",
            "status",
            "admin_notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "user", "user_email", "status", "admin_notes", "created_at", "updated_at"]

    def create(self, validated_data):
        validated_data["user"] = self.context["request"].user
        return super().create(validated_data)
