from rest_framework.routers import DefaultRouter

from .views import FineViewSet, PaymentViewSet, TrafficViolationViewSet

router = DefaultRouter()
router.register(r"fines", FineViewSet)
router.register(r"payments", PaymentViewSet)
router.register(r"", TrafficViolationViewSet)

urlpatterns = router.urls
