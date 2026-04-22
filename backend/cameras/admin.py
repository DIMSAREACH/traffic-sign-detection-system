from django.contrib import admin

from .models import Camera, Road, TrafficSignal, TrafficSign


@admin.register(Road)
class RoadAdmin(admin.ModelAdmin):
	list_display = ("name", "code", "location")
	search_fields = ("name", "code", "location")


@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
	list_display = ("name", "road", "location", "active")
	list_filter = ("active", "road")
	search_fields = ("name", "location", "ip_address")


@admin.register(TrafficSignal)
class TrafficSignalAdmin(admin.ModelAdmin):
	list_display = ("signal_type", "road", "location", "status")
	list_filter = ("signal_type", "status", "road")
	search_fields = ("location",)


@admin.register(TrafficSign)
class TrafficSignAdmin(admin.ModelAdmin):
	list_display = ("sign_type", "road", "location", "speed_limit")
	list_filter = ("sign_type", "road")
	search_fields = ("description", "location")
