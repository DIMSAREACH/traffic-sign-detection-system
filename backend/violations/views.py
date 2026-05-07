from django.db.models import Sum, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from accounts.permissions import AdminWriteOnly, IsAdminRole
from .models import Fine, Payment, TrafficViolation
from .serializers import FineSerializer, PaymentSerializer, TrafficViolationDetailSerializer, TrafficViolationSerializer


def _is_admin_or_officer(user):
    return user and user.is_authenticated and (user.has_role("admin") or user.has_role("officer"))


class TrafficViolationViewSet(viewsets.ModelViewSet):
    queryset = TrafficViolation.objects.select_related(
        "vehicle", "driver__user", "camera", "sign"
    ).prefetch_related("fine").all().order_by("-date")
    serializer_class = TrafficViolationSerializer
    permission_classes = [IsAuthenticated, AdminWriteOnly]
    filterset_fields = ["status", "violation_type", "camera", "sign"]
    search_fields = ["violation_type", "location"]
    ordering_fields = ["date", "status"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            return TrafficViolationDetailSerializer
        return TrafficViolationSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        # Drivers must only see their own records. Officers/Admins can see all.
        if _is_admin_or_officer(user):
            return qs
        driver = getattr(user, "driver_profile", None)
        if driver:
            return qs.filter(driver=driver)
        return qs.none()

    @action(detail=True, methods=["put"], url_path="status",
            permission_classes=[IsAuthenticated, IsAdminRole])
    def update_status(self, request, pk=None):
        violation = self.get_object()
        status_value = request.data.get("status")
        if status_value not in dict(TrafficViolation.STATUS_CHOICES):
            return Response({"detail": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
        violation.status = status_value
        violation.save(update_fields=["status"])
        return Response(self.get_serializer(violation).data)

    # ── Bulk actions ──────────────────────────────────────
    @action(detail=False, methods=["post"], url_path="bulk-status",
            permission_classes=[IsAuthenticated, IsAdminRole])
    def bulk_update_status(self, request):
        ids = request.data.get("ids", [])
        new_status = request.data.get("status")
        if not ids or not isinstance(ids, list):
            return Response({"detail": "ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
        if new_status not in dict(TrafficViolation.STATUS_CHOICES):
            return Response({"detail": "Invalid status."}, status=status.HTTP_400_BAD_REQUEST)
        updated = TrafficViolation.objects.filter(id__in=ids).update(status=new_status)
        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="bulk-delete",
            permission_classes=[IsAuthenticated, IsAdminRole])
    def bulk_delete(self, request):
        ids = request.data.get("ids", [])
        if not ids or not isinstance(ids, list):
            return Response({"detail": "ids must be a non-empty list."}, status=status.HTTP_400_BAD_REQUEST)
        deleted, _ = TrafficViolation.objects.filter(id__in=ids).delete()
        return Response({"deleted": deleted})


class FineViewSet(viewsets.ModelViewSet):
    queryset = Fine.objects.select_related(
        "violation__vehicle", "violation__driver__user"
    ).all().order_by("-due_date")
    serializer_class = FineSerializer
    permission_classes = [IsAuthenticated, AdminWriteOnly]
    filterset_fields = ["status"]
    search_fields = ["violation__violation_type", "violation__location"]
    ordering_fields = ["due_date", "amount", "status"]

    def get_serializer_class(self):
        if self.action == "retrieve":
            from .serializers import FineDetailSerializer
            return FineDetailSerializer
        return FineSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if _is_admin_or_officer(user):
            return qs
        driver = getattr(user, "driver_profile", None)
        if driver:
            return qs.filter(violation__driver=driver)
        return qs.none()

    @action(detail=True, methods=["post"], url_path="pay",
            permission_classes=[IsAuthenticated])
    def pay(self, request, pk=None):
        """Mark a fine as paid with today's date."""
        fine = self.get_object()
        if fine.status == "paid":
            return Response({"detail": "Fine is already paid."}, status=status.HTTP_400_BAD_REQUEST)
        fine.status = "paid"
        fine.payment_date = timezone.now().date()
        fine.save(update_fields=["status", "payment_date"])
        return Response(FineSerializer(fine).data)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Return DB-wide aggregate stats for all fines."""
        qs = self.get_queryset()
        today = timezone.now().date()
        agg = qs.aggregate(
            total_amount=Sum("amount"),
            unpaid_amount=Sum("amount", filter=Q(status="pending") | Q(status="overdue")),
            overdue_amount=Sum(
                "amount",
                filter=Q(status__in=["pending", "overdue"]) & Q(due_date__lt=today),
            ),
        )
        return Response({
            "total_count":    qs.count(),
            "total_amount":   float(agg["total_amount"] or 0),
            "unpaid_amount":  float(agg["unpaid_amount"] or 0),
            "overdue_amount": float(agg["overdue_amount"] or 0),
            "paid_count":     qs.filter(status="paid").count(),
            "pending_count":  qs.filter(status="pending").count(),
            "overdue_count":  qs.filter(
                Q(status__in=["pending", "overdue"]) & Q(due_date__lt=today)
            ).count(),
        })


class PaymentViewSet(viewsets.ModelViewSet):
    """CRUD for payment records — linked to violations."""
    queryset = Payment.objects.select_related(
        "violation__vehicle", "violation__driver__user"
    ).all().order_by("-created_at")
    serializer_class = PaymentSerializer
    permission_classes = [IsAuthenticated, AdminWriteOnly]
    filterset_fields = ["status", "method"]
    search_fields = ["reference", "violation__violation_type", "violation__location"]
    ordering_fields = ["created_at", "amount", "status"]

    def perform_create(self, serializer):
        """When a payment is completed, also mark the linked fine as paid."""
        payment = serializer.save()
        if payment.status == "completed":
            self._mark_fine_paid(payment.violation)

    def perform_update(self, serializer):
        payment = serializer.save()
        if payment.status == "completed":
            self._mark_fine_paid(payment.violation)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        if _is_admin_or_officer(user):
            return qs
        driver = getattr(user, "driver_profile", None)
        if driver:
            return qs.filter(violation__driver=driver)
        return qs.none()

    @staticmethod
    def _mark_fine_paid(violation):
        try:
            fine = violation.fine
            if fine.status != "paid":
                fine.status = "paid"
                fine.payment_date = timezone.now().date()
                fine.save(update_fields=["status", "payment_date"])
        except Fine.DoesNotExist:
            pass

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Aggregated payment statistics."""
        qs = self.get_queryset()
        total = qs.aggregate(total=Sum("amount"))["total"] or 0
        completed = qs.filter(status="completed").aggregate(total=Sum("amount"))["total"] or 0
        pending_amt = qs.filter(status="pending").aggregate(total=Sum("amount"))["total"] or 0
        return Response({
            "total_count":     qs.count(),
            "total_amount":    float(total),
            "completed_amount": float(completed),
            "pending_amount":  float(pending_amt),
            "completed_count": qs.filter(status="completed").count(),
            "pending_count":   qs.filter(status="pending").count(),
            "failed_count":    qs.filter(status="failed").count(),
            "refunded_count":  qs.filter(status="refunded").count(),
        })
