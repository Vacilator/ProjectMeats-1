"""
Bug Reports views for ProjectMeats.
"""
from rest_framework import viewsets, filters
from django_filters.rest_framework import DjangoFilterBackend
from .models import BugReport
from .serializers import BugReportSerializer


class BugReportViewSet(viewsets.ModelViewSet):
    """API endpoint for managing bug reports.

    Provides CRUD operations for bug reports with strict tenant isolation.
    """

    queryset = BugReport.objects.all()
    serializer_class = BugReportSerializer
    permission_classes = []  # set in get_permissions()
    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_fields = ["status", "severity", "category", "reporter"]
    search_fields = ["title", "description"]
    ordering_fields = ["created_at", "updated_at", "severity"]
    ordering = ["-created_at"]

    def get_permissions(self):
        # Bug reports are internal; require auth.
        from rest_framework.permissions import IsAuthenticated

        return [IsAuthenticated()]

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return BugReport.objects.none()
        return BugReport.objects.filter(tenant=tenant)

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            from rest_framework.exceptions import ValidationError

            raise ValidationError({'tenant': 'Tenant context required'})

        serializer.save(tenant=tenant, reporter=getattr(self.request, 'user', None))
