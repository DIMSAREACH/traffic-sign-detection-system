from rest_framework import status
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import GenericViewSet
from rest_framework.mixins import ListModelMixin, DestroyModelMixin

from .models import Notification
from .serializers import NotificationSerializer


class _NotifPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 50


class NotificationViewSet(ListModelMixin, DestroyModelMixin, GenericViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]

    def get_pagination_class(self):
        # bell dropdown sends ?all=1 → no pagination
        if self.request.query_params.get("all"):
            return None
        return _NotifPagination

    @property
    def paginator(self):
        cls = self.get_pagination_class()
        if cls is None:
            return None
        if not hasattr(self, "_paginator") or not isinstance(self._paginator, cls):
            self._paginator = cls()
        return self._paginator

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        # type filter
        t = self.request.query_params.get("type")
        if t and t in ("violation", "fine", "system", "alert"):
            qs = qs.filter(notif_type=t)
        # read/unread filter
        read = self.request.query_params.get("is_read")
        if read == "true":
            qs = qs.filter(is_read=True)
        elif read == "false":
            qs = qs.filter(is_read=False)
        # search
        q = self.request.query_params.get("search", "").strip()
        if q:
            qs = qs.filter(title__icontains=q) | qs.filter(message__icontains=q)
        return qs

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        count = Notification.objects.filter(user=request.user, is_read=False).count()
        return Response({"count": count})

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notif = self.get_object()
        notif.is_read = True
        notif.save(update_fields=["is_read"])
        return Response({"ok": True})

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        Notification.objects.filter(user=request.user, is_read=False).update(is_read=True)
        return Response({"ok": True})

    @action(detail=False, methods=["delete"], url_path="clear-all")
    def clear_all(self, request):
        Notification.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
