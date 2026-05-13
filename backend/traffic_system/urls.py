from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


def root_view(request):
        return JsonResponse(
                {
                        "message": "Traffic System API is running",
                        "docs": "/api/docs/",
                        "admin": "/admin/",
                }
        )

urlpatterns = [
    path("", root_view, name="root"),
    path("admin/", admin.site.urls),
    # ── API documentation ──
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # ── App endpoints ──
    path("api/auth/", include("accounts.urls")),
    path("api/", include("accounts.api_urls")),
    path("api/vehicles/", include("vehicles.urls")),
    path("api/violations/", include("violations.urls")),
    path("api/ai/", include("ai_detection.urls")),
    path("api/reports/", include("reports.urls")),
    path("api/cameras/", include("cameras.urls")),
    path("api/notifications/", include("notifications.urls")),
    path("api/support/", include("support.urls")),
]

if getattr(settings, "SERVE_MEDIA_LOCALLY", settings.DEBUG):
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
