from django.contrib import admin
from .models import IssueReport


@admin.register(IssueReport)
class IssueReportAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "type", "priority", "subject", "status", "created_at")
    list_filter = ("type", "priority", "status")
    search_fields = ("subject", "description", "user__email")
    readonly_fields = ("created_at", "updated_at")
