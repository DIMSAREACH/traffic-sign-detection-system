from django.urls import path
from .views import IssueReportCreateView, IssueReportListView, IssueReportDetailView

urlpatterns = [
    path("reports/", IssueReportListView.as_view(), name="issue-report-list"),
    path("reports/create/", IssueReportCreateView.as_view(), name="issue-report-create"),
    path("reports/<int:pk>/", IssueReportDetailView.as_view(), name="issue-report-detail"),
]
