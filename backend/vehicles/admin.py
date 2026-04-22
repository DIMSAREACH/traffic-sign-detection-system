from django.contrib import admin

from .models import Vehicle


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
	list_display = ("plate_number", "vehicle_type", "driver", "make", "model")
	list_filter = ("vehicle_type",)
	search_fields = ("plate_number", "make", "model", "driver__user__email")
