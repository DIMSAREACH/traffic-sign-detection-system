from rest_framework.routers import DefaultRouter

from .views import CameraViewSet, RoadViewSet, TrafficSignalViewSet, TrafficSignViewSet

router = DefaultRouter()
router.register(r"roads", RoadViewSet)
router.register(r"cameras", CameraViewSet)
router.register(r"signals", TrafficSignalViewSet)
router.register(r"signs", TrafficSignViewSet)

urlpatterns = router.urls
