from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import Vehicle
from .serializers import VehicleSerializer
from accounts.permissions import AdminWriteOnly


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("-registered_at")
    serializer_class = VehicleSerializer
    permission_classes = [IsAuthenticated, AdminWriteOnly]
    filterset_fields = ["vehicle_type"]
    search_fields = ["plate_number", "make", "model"]
    ordering_fields = ["registered_at", "plate_number"]

    def get_queryset(self):
        """
        RBAC data scoping:
        - driver: only their own vehicles
        - officer/admin: all vehicles (read-only for non-admin via AdminWriteOnly)
        """
        qs = super().get_queryset()
        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return qs.none()

        # Drivers should only see their own vehicles.
        try:
            if user.has_role("driver"):
                driver = getattr(user, "driver_profile", None)
                if not driver:
                    return qs.none()
                return qs.filter(driver=driver)
        except Exception:
            # If roles/relations are missing, fail closed for drivers.
            return qs.none()

        return qs
