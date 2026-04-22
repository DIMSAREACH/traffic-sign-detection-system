from rest_framework import serializers

from .models import Camera, Road, TrafficSignal, TrafficSign


class RoadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Road
        fields = ["id", "name", "code", "location"]


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = ["id", "road", "name", "ip_address", "location", "latitude", "longitude", "active"]


class TrafficSignalSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficSignal
        fields = ["id", "road", "signal_type", "location", "status"]


class TrafficSignSerializer(serializers.ModelSerializer):
    class Meta:
        model = TrafficSign
        fields = ["id", "road", "sign_type", "description", "location", "speed_limit", "image"]
