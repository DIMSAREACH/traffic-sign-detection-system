from django.contrib import admin

from .models import Driver, Officer, Permission, Role, RolePermission, User, UserRole


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
	list_display = ("email", "username", "is_active", "is_staff", "date_joined")
	list_filter = ("is_active", "is_staff")
	search_fields = ("email", "username", "first_name", "last_name")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
	list_display = ("name", "description")
	search_fields = ("name",)


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
	list_display = ("name", "code")
	search_fields = ("name", "code")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
	list_display = ("role", "permission")
	list_filter = ("role",)


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
	list_display = ("user", "role")
	list_filter = ("role",)
	search_fields = ("user__email", "user__username")


@admin.register(Driver)
class DriverAdmin(admin.ModelAdmin):
	list_display = ("user", "license_number", "national_id")
	search_fields = ("user__email", "license_number", "national_id")


@admin.register(Officer)
class OfficerAdmin(admin.ModelAdmin):
	list_display = ("user", "badge_number", "station", "rank")
	search_fields = ("user__email", "badge_number", "station")
