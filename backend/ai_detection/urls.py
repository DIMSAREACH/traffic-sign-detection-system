from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    AIDetectionLogViewSet,
    LicensePlateLogViewSet,
    ProcessImageView,
    UploadVideoView,
)

router = DefaultRouter()
router.register(r"logs", AIDetectionLogViewSet)
router.register(r"plates", LicensePlateLogViewSet)

urlpatterns = router.urls + [
    path("process-image/", ProcessImageView.as_view(), name="process-image"),
    path("upload-video/", UploadVideoView.as_view(), name="upload-video"),
]
