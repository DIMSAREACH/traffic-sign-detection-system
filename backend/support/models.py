from django.conf import settings
from django.db import models


class IssueReport(models.Model):
    """User-submitted issue / feedback report."""

    class Type(models.TextChoices):
        BUG = "bug", "Bug"
        FEATURE = "feature", "Feature Request"
        UI = "ui", "UI / Design"
        OTHER = "other", "Other"

    class Priority(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    class Status(models.TextChoices):
        OPEN = "open", "Open"
        IN_PROGRESS = "in_progress", "In Progress"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="issue_reports",
    )
    type = models.CharField(max_length=20, choices=Type.choices, default=Type.BUG)
    priority = models.CharField(max_length=20, choices=Priority.choices, default=Priority.MEDIUM)
    subject = models.CharField(max_length=255)
    description = models.TextField()
    screenshot = models.ImageField(upload_to="issue_screenshots/", null=True, blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.OPEN)
    admin_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"[{self.get_type_display()}] {self.subject}"
