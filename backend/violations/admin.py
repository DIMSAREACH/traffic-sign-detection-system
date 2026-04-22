from django.contrib import admin

from .models import Fine, TrafficViolation


@admin.register(TrafficViolation)
class TrafficViolationAdmin(admin.ModelAdmin):
	list_display = ("violation_type", "status", "vehicle", "camera", "date")
	list_filter = ("status", "violation_type", "camera")
	search_fields = ("violation_type", "location", "vehicle__plate_number")


@admin.register(Fine)
class FineAdmin(admin.ModelAdmin):
	list_display = ("violation", "amount", "status", "due_date", "payment_date")
	list_filter = ("status",)
