from rest_framework import viewsets
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from rest_framework.permissions import IsAuthenticated

from .models import Camera, Road, TrafficSignal, TrafficSign
from .serializers import (
    CameraSerializer,
    RoadSerializer,
    TrafficSignalSerializer,
    TrafficSignSerializer,
)
from accounts.permissions import AdminDeleteOnly


class RoadViewSet(viewsets.ModelViewSet):
    queryset = Road.objects.all().order_by("name")
    serializer_class = RoadSerializer
    permission_classes = [IsAuthenticated, AdminDeleteOnly]
    search_fields = ["name", "code", "location"]


class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all().order_by("name")
    serializer_class = CameraSerializer
    permission_classes = [IsAuthenticated, AdminDeleteOnly]
    filterset_fields = ["active", "road"]
    search_fields = ["name", "location", "ip_address"]


class TrafficSignalViewSet(viewsets.ModelViewSet):
    queryset = TrafficSignal.objects.all().order_by("id")
    serializer_class = TrafficSignalSerializer
    permission_classes = [IsAuthenticated, AdminDeleteOnly]
    filterset_fields = ["signal_type", "road", "status"]


class TrafficSignViewSet(viewsets.ModelViewSet):
    queryset = TrafficSign.objects.all().order_by("id")
    serializer_class = TrafficSignSerializer
    permission_classes = [IsAuthenticated, AdminDeleteOnly]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    filterset_fields = ["sign_type", "road"]
    search_fields = ["description", "location"]
