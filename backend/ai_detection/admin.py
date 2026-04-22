from django.contrib import admin

from .models import AIDetectionLog, LicensePlateLog


@admin.register(AIDetectionLog)
class AIDetectionLogAdmin(admin.ModelAdmin):
	list_display = ("detected_object", "camera", "confidence_score", "detected_at", "processed")
	list_filter = ("processed", "camera")
	search_fields = ("detected_object",)


@admin.register(LicensePlateLog)
class LicensePlateLogAdmin(admin.ModelAdmin):
	list_display = ("detected_plate", "camera", "confidence_score", "detected_at")
	list_filter = ("camera",)
	search_fields = ("detected_plate",)
