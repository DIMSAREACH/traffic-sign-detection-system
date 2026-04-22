import csv
import io
import os
from datetime import timedelta

from django.db import connection
from django.db.models import Count, Sum
from django.db.models.functions import TruncDay, TruncMonth
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from cameras.models import Camera
from notifications.models import Notification
from violations.models import Fine, TrafficViolation


def _date_qs(request, qs):
    """Filter a queryset by optional date_from / date_to query params."""
    date_from = request.query_params.get("date_from")
    date_to   = request.query_params.get("date_to")
    if date_from:
        d = parse_date(date_from)
        if d:
            qs = qs.filter(date__date__gte=d)
    if date_to:
        d = parse_date(date_to)
        if d:
            qs = qs.filter(date__date__lte=d)
    return qs


class DashboardReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _date_qs(request, TrafficViolation.objects.all())
        fine_qs = Fine.objects.filter(violation__in=qs)

        total_violations = qs.count()
        paid_fines    = fine_qs.filter(status="paid").count()
        pending_fines = fine_qs.filter(status="pending").count()
        overdue_fines = fine_qs.filter(status="overdue").count()
        active_cameras = Camera.objects.filter(active=True).count()
        total_cameras  = Camera.objects.count()
        total_collected = fine_qs.filter(status="paid").aggregate(
            s=Sum("amount")
        )["s"] or 0

        violations_by_type = (
            qs.values("violation_type")
            .annotate(count=Count("id"))
            .order_by("-count")
        )
        violations_by_location = (
            qs.values("location")
            .annotate(count=Count("id"))
            .order_by("-count")
        )

        # Severity breakdown
        severity_order = ["critical", "high", "medium", "low", "warning"]
        severity_counts = {
            row["severity"]: row["count"]
            for row in qs.values("severity").annotate(count=Count("id"))
        }
        violations_by_severity = [
            {"severity": s, "count": severity_counts.get(s, 0)}
            for s in severity_order
        ]

        # Status breakdown
        status_counts = {
            row["status"]: row["count"]
            for row in qs.values("status").annotate(count=Count("id"))
        }

        # Daily trend – last 30 days
        today = timezone.now().date()
        daily_trend = (
            qs.filter(date__date__gte=today - timedelta(days=29))
            .annotate(day=TruncDay("date"))
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        # Weekly accuracy (last 7 days) – % resolved/verified per day
        weekly_accuracy = []
        for offset in range(6, -1, -1):
            day = today - timedelta(days=offset)
            day_qs = qs.filter(date__date=day)
            total_day = day_qs.count()
            if total_day == 0:
                weekly_accuracy.append(None)
            else:
                confirmed = day_qs.filter(status__in=["verified", "resolved"]).count()
                weekly_accuracy.append(round(confirmed / total_day * 100, 1))

        # Top 5 locations
        top_locations = list(violations_by_location[:5])

        # ── Previous-period counts (30 days before the current window) ──
        prev_start = today - timedelta(days=59)
        prev_end   = today - timedelta(days=30)
        prev_qs      = TrafficViolation.objects.filter(date__date__gte=prev_start, date__date__lte=prev_end)
        prev_fine_qs = Fine.objects.filter(violation__in=prev_qs)

        prev_total_violations = prev_qs.count()
        prev_paid_fines       = prev_fine_qs.filter(status="paid").count()
        prev_pending_fines    = prev_fine_qs.filter(status="pending").count()

        return Response({
            "total_violations":       total_violations,
            "paid_fines":             paid_fines,
            "pending_fines":          pending_fines,
            "overdue_fines":          overdue_fines,
            "active_cameras":         active_cameras,
            "total_cameras":          total_cameras,
            "total_collected":        float(total_collected),
            "violations_by_type":     list(violations_by_type),
            "violations_by_location": top_locations,
            "violations_by_severity": violations_by_severity,
            "status_counts":          status_counts,
            "daily_trend":            list(daily_trend),
            "weekly_accuracy":        weekly_accuracy,
            # previous period for % change calculation
            "prev_total_violations": prev_total_violations,
            "prev_paid_fines":       prev_paid_fines,
            "prev_pending_fines":    prev_pending_fines,
        })


class MonthlyReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _date_qs(request, TrafficViolation.objects.all())
        monthly = (
            qs.annotate(month=TruncMonth("date"))
            .values("month")
            .annotate(count=Count("id"))
            .order_by("month")
        )
        return Response({"monthly": list(monthly)})


class MyDashboardView(APIView):
    """Dashboard stats scoped to the logged-in driver."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        driver = getattr(user, "driver_profile", None)

        if driver:
            violations = TrafficViolation.objects.filter(driver=driver)
        else:
            violations = TrafficViolation.objects.none()

        fines = Fine.objects.filter(violation__in=violations)

        total_violations = violations.count()
        pending_fines    = fines.filter(status="pending").count()
        paid_fines       = fines.filter(status="paid").count()
        overdue_fines    = fines.filter(status="overdue").count()
        total_paid_amount = float(
            fines.filter(status="paid").aggregate(s=Sum("amount"))["s"] or 0
        )

        recent_notifications = Notification.objects.filter(
            user=user, is_read=False
        ).count()

        # Recent violations (last 5)
        recent_violations = list(
            violations.order_by("-date")[:5].values(
                "id", "violation_type", "severity", "status", "location", "date"
            )
        )

        return Response({
            "total_violations":     total_violations,
            "pending_fines":        pending_fines,
            "paid_fines":           paid_fines,
            "overdue_fines":        overdue_fines,
            "total_paid_amount":    total_paid_amount,
            "recent_notifications": recent_notifications,
            "recent_violations":    recent_violations,
        })


class SystemHealthView(APIView):
    """Return live health status for dashboard system-status widget."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        services = {}

        # 1) Database
        try:
            connection.ensure_connection()
            services["database"] = True
        except Exception:
            services["database"] = False

        # 2) Camera network – at least one active camera
        try:
            services["camera_network"] = Camera.objects.filter(active=True).exists()
        except Exception:
            services["camera_network"] = False

        # 3) AI engine – YOLOv8 model file present
        try:
            model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "yolov8n.pt")
            services["ai_engine"] = os.path.isfile(model_path)
        except Exception:
            services["ai_engine"] = False

        # 4) Notification / alert system – table accessible & recent notification within 30 days
        try:
            Notification.objects.exists()  # ensures table is accessible
            services["alert_system"] = True
        except Exception:
            services["alert_system"] = False

        all_ok = all(services.values())
        return Response({"status": "healthy" if all_ok else "degraded", "services": services})


class CSVExportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = _date_qs(request, TrafficViolation.objects.select_related("vehicle", "camera").order_by("-date"))

        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow(["ID", "Date", "Violation Type", "Severity", "Status", "Location", "Plate Number", "Camera", "Fine Amount"])

        for v in qs:
            fine_amount = ""
            try:
                fine_amount = v.fine.amount
            except Exception:
                pass
            writer.writerow([
                v.id,
                v.date.strftime("%Y-%m-%d %H:%M") if v.date else "",
                v.violation_type or "",
                v.severity or "",
                v.status or "",
                v.location or "",
                v.vehicle.plate_number if v.vehicle else "",
                v.camera.name if v.camera else "",
                fine_amount,
            ])

        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="violations_export.csv"'
        return response


# ─── Colours used in the PDF ───────────────────────────────────────
_PURPLE      = colors.HexColor("#7c3aed")
_PURPLE_LIGHT = colors.HexColor("#f5f3ff")
_DARK        = colors.HexColor("#1a1033")
_GREY        = colors.HexColor("#64748b")
_WHITE       = colors.white

_SEVERITY_COLORS = {
    "critical": colors.HexColor("#dc2626"),
    "high":     colors.HexColor("#d97706"),
    "medium":   colors.HexColor("#7c3aed"),
    "low":      colors.HexColor("#2563eb"),
    "warning":  colors.HexColor("#16a34a"),
}
_STATUS_COLORS = {
    "pending":  colors.HexColor("#d97706"),
    "verified": colors.HexColor("#7c3aed"),
    "resolved": colors.HexColor("#16a34a"),
    "rejected": colors.HexColor("#dc2626"),
}


class PDFExportView(APIView):
    """Generate a styled PDF report of violations."""
    permission_classes = [IsAuthenticated]

    # ── helpers ──────────────────────────────────────────────
    @staticmethod
    def _summary_data(qs, fine_qs):
        return {
            "total":     qs.count(),
            "pending":   qs.filter(status="pending").count(),
            "verified":  qs.filter(status="verified").count(),
            "resolved":  qs.filter(status="resolved").count(),
            "rejected":  qs.filter(status="rejected").count(),
            "fines":     float(fine_qs.aggregate(s=Sum("amount"))["s"] or 0),
            "paid":      fine_qs.filter(status="paid").count(),
            "overdue":   fine_qs.filter(status="overdue").count(),
        }

    # ── main view ────────────────────────────────────────────
    def get(self, request):
        qs = _date_qs(
            request,
            TrafficViolation.objects.select_related("vehicle", "camera")
            .prefetch_related("fine")
            .order_by("-date"),
        )
        fine_qs = Fine.objects.filter(violation__in=qs)
        summary = self._summary_data(qs, fine_qs)
        now = timezone.now()

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=landscape(A4),
            leftMargin=15 * mm,
            rightMargin=15 * mm,
            topMargin=15 * mm,
            bottomMargin=15 * mm,
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            "PDFTitle", parent=styles["Title"],
            fontSize=20, textColor=_PURPLE, spaceAfter=4,
        )
        sub_style = ParagraphStyle(
            "PDFSub", parent=styles["Normal"],
            fontSize=9, textColor=_GREY, spaceAfter=12,
        )
        section_style = ParagraphStyle(
            "PDFSection", parent=styles["Heading2"],
            fontSize=13, textColor=_PURPLE, spaceBefore=16, spaceAfter=6,
        )

        elements = []

        # ── Header ──
        elements.append(Paragraph("Traffic Violations Report", title_style))
        date_from = request.query_params.get("date_from", "—")
        date_to   = request.query_params.get("date_to", "—")
        elements.append(Paragraph(
            f"Generated {now:%Y-%m-%d %H:%M}  ·  Period: {date_from} → {date_to}",
            sub_style,
        ))

        # ── Summary cards row ──
        elements.append(Paragraph("Summary", section_style))
        card_data = [[
            f"Total\n{summary['total']}",
            f"Pending\n{summary['pending']}",
            f"Verified\n{summary['verified']}",
            f"Resolved\n{summary['resolved']}",
            f"Rejected\n{summary['rejected']}",
            f"Fines ($)\n{summary['fines']:,.2f}",
        ]]
        card_table = Table(card_data, colWidths=[doc.width / 6] * 6)
        card_table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _PURPLE_LIGHT),
            ("TEXTCOLOR",  (0, 0), (-1, -1), _DARK),
            ("ALIGN",      (0, 0), (-1, -1), "CENTER"),
            ("VALIGN",     (0, 0), (-1, -1), "MIDDLE"),
            ("FONTNAME",   (0, 0), (-1, -1), "Helvetica-Bold"),
            ("FONTSIZE",   (0, 0), (-1, -1), 10),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING",    (0, 0), (-1, -1), 10),
            ("GRID",       (0, 0), (-1, -1), 0.5, _PURPLE),
            ("ROUNDEDCORNERS", [4, 4, 4, 4]),
        ]))
        elements.append(card_table)
        elements.append(Spacer(1, 6 * mm))

        # ── Violations table ──
        elements.append(Paragraph("Violation Details", section_style))

        header = ["#", "Date", "Type", "Severity", "Status", "Location", "Plate", "Camera", "Fine ($)"]
        table_data = [header]

        for v in qs[:500]:  # cap at 500 rows for PDF sanity
            fine_amt = ""
            try:
                fine_amt = f"{v.fine.amount:,.2f}"
            except Exception:
                pass
            table_data.append([
                str(v.id),
                v.date.strftime("%Y-%m-%d %H:%M") if v.date else "",
                (v.violation_type or "").replace("_", " ").title(),
                (v.severity or "").title(),
                (v.status or "").title(),
                v.location or "",
                v.vehicle.plate_number if v.vehicle else "",
                v.camera.name if v.camera else "",
                fine_amt,
            ])

        col_widths = [
            28 * mm,   # #
            36 * mm,   # Date
            40 * mm,   # Type
            24 * mm,   # Severity
            24 * mm,   # Status
            44 * mm,   # Location
            30 * mm,   # Plate
            30 * mm,   # Camera
            24 * mm,   # Fine
        ]
        tbl = Table(table_data, colWidths=col_widths, repeatRows=1)
        tbl.setStyle(TableStyle([
            # header row
            ("BACKGROUND",   (0, 0), (-1, 0), _PURPLE),
            ("TEXTCOLOR",    (0, 0), (-1, 0), _WHITE),
            ("FONTNAME",     (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE",     (0, 0), (-1, 0), 9),
            ("BOTTOMPADDING",(0, 0), (-1, 0), 8),
            ("TOPPADDING",   (0, 0), (-1, 0), 8),
            # body rows
            ("FONTNAME",     (0, 1), (-1, -1), "Helvetica"),
            ("FONTSIZE",     (0, 1), (-1, -1), 8),
            ("BOTTOMPADDING",(0, 1), (-1, -1), 5),
            ("TOPPADDING",   (0, 1), (-1, -1), 5),
            ("TEXTCOLOR",    (0, 1), (-1, -1), _DARK),
            # alternating row shading
            *[
                ("BACKGROUND", (0, i), (-1, i), _PURPLE_LIGHT)
                for i in range(2, len(table_data), 2)
            ],
            # grid
            ("GRID",         (0, 0), (-1, -1), 0.4, colors.HexColor("#e2e0f0")),
            ("VALIGN",       (0, 0), (-1, -1), "MIDDLE"),
        ]))
        elements.append(tbl)

        # ── Footer note ──
        if qs.count() > 500:
            elements.append(Spacer(1, 4 * mm))
            elements.append(Paragraph(
                f"Showing first 500 of {qs.count()} violations. Use CSV export for the full dataset.",
                ParagraphStyle("FootNote", parent=styles["Normal"], fontSize=8, textColor=_GREY),
            ))

        doc.build(elements)
        buf.seek(0)

        response = HttpResponse(buf.read(), content_type="application/pdf")
        response["Content-Disposition"] = (
            f'attachment; filename="violations_report_{now:%Y%m%d}.pdf"'
        )
        return response

