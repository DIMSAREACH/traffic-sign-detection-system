from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    time_ago = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "title", "message", "notif_type", "is_read", "created_at", "time_ago"]
        read_only_fields = fields

    def get_time_ago(self, obj):
        from django.utils import timezone
        delta = timezone.now() - obj.created_at
        s = int(delta.total_seconds())
        if s < 60:
            return "just now"
        if s < 3600:
            m = s // 60
            return f"{m}m ago"
        if s < 86400:
            h = s // 3600
            return f"{h}h ago"
        d = s // 86400
        return f"{d}d ago"
