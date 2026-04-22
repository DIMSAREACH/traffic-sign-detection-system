from django.urls import path

from .views import CSVExportView, DashboardReportView, MonthlyReportView, MyDashboardView, PDFExportView, SystemHealthView

urlpatterns = [
    path("dashboard/",       DashboardReportView.as_view(), name="dashboard"),
    path("my-dashboard/",    MyDashboardView.as_view(),     name="my-dashboard"),
    path("monthly/",         MonthlyReportView.as_view(),   name="monthly"),
    path("system-health/",   SystemHealthView.as_view(),    name="system-health"),
    path("export/csv/",      CSVExportView.as_view(),       name="csv-export"),
    path("export/pdf/",      PDFExportView.as_view(),       name="pdf-export"),
]
