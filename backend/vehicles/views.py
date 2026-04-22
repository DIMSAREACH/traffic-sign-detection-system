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
