from rest_framework.routers import DefaultRouter

from .views import DriverViewSet, OfficerViewSet

router = DefaultRouter()
router.register(r"drivers", DriverViewSet, basename="driver")
router.register(r"officers", OfficerViewSet, basename="officer")

urlpatterns = router.urls
