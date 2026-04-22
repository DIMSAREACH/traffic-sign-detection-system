from rest_framework import generics, permissions
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from .models import IssueReport
from .serializers import IssueReportSerializer


class IssueReportCreateView(generics.CreateAPIView):
    """Authenticated users can submit an issue report."""
    serializer_class = IssueReportSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]


class IssueReportListView(generics.ListAPIView):
    """Admin can list all issue reports; regular users see only their own."""
    serializer_class = IssueReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = IssueReport.objects.all()
        if not (user.is_staff or user.has_role("admin")):
            qs = qs.filter(user=user)
        return qs


class IssueReportDetailView(generics.RetrieveUpdateAPIView):
    """Retrieve or update (admin only) an issue report."""
    serializer_class = IssueReportSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.has_role("admin"):
            return IssueReport.objects.all()
        return IssueReport.objects.filter(user=user)
