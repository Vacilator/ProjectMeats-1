"""
ViewSet for system-wide products with tenant preferences.

Products are shared across all tenants (system.Product).
Tenants customize via TenantProductPreference (display names, pricing, availability).

This replaces tenant_apps.products.views.ProductViewSet.
"""
import logging

from django.db.models import Prefetch
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend

from apps.system.models import Product, TenantProductPreference
from apps.system.permissions import IsTenantAdminOrOwnerForTenantContext
from apps.system.services.product_visibility import visible_products_qs

logger = logging.getLogger(__name__)


class SystemProductPagination(PageNumberPagination):
    """Product pagination tuned for admin master-data workflows.

    Global defaults are intentionally conservative; for Master Products screens we
    need to safely fetch larger batches.
    """

    page_size = 20
    page_size_query_param = "limit"
    max_page_size = 1000

    def get_page_size(self, request):
        raw = request.query_params.get("limit") or request.query_params.get("page_size")
        if raw is None:
            return self.page_size

        try:
            parsed = int(raw)
        except (TypeError, ValueError):
            return self.page_size

        if parsed <= 0:
            return self.page_size

        return min(parsed, self.max_page_size)


class SystemProductViewSet(viewsets.ModelViewSet):
    """ViewSet for system-wide products.

    - GET is available to authenticated users (tenant visibility rules apply).
    - Writes are restricted to staff users (Admin Workspace power feature).
    """

    queryset = Product.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    pagination_class = SystemProductPagination

    # Search fields
    search_fields = ["product_code", "name", "description", "namp_code", "usda_code"]

    # Filterset fields
    filterset_fields = [
        "category",
        "protein_type",
        "fresh_or_frozen",
        "package_type",
        "is_active",
        "tested_product",
    ]

    # Ordering fields
    ordering_fields = ["product_code", "name", "category", "unit_weight", "created_at"]
    ordering = ["product_code"]

    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]

    def get_serializer_class(self):
        from apps.system.serializers import SystemProductSerializer, SystemProductWriteSerializer

        if self.request.method in permissions.SAFE_METHODS:
            return SystemProductSerializer
        return SystemProductWriteSerializer

    def get_queryset(self):
        """Return products visible to the current tenant.

        Staff users get the full catalog (optionally including inactive).
        Regular users get tenant-visible products only.
        """

        include_inactive_raw = str(self.request.query_params.get("include_inactive") or "").lower()
        include_inactive = include_inactive_raw in ("1", "true", "yes")

        # Non-staff users must never be able to include globally inactive products.
        if not (self.request.user.is_staff or self.request.user.is_superuser):
            include_inactive = False

        queryset = Product.objects.all()

        if self.request.user.is_staff or self.request.user.is_superuser:
            if not include_inactive:
                queryset = queryset.filter(is_active=True)
            return queryset

        tenant = getattr(self.request, "tenant", None)
        queryset = visible_products_qs(tenant=tenant, qs=queryset, include_inactive=include_inactive)

        if tenant:
            queryset = queryset.prefetch_related(
                Prefetch(
                    "tenant_preferences",
                    queryset=TenantProductPreference.objects.filter(tenant=tenant),
                )
            )

        protein_param = self.request.query_params.get("protein") or self.request.query_params.get("protein_type")
        if protein_param:
            from django.db.models import Q

            proteins = [p.strip() for p in protein_param.split(",")]
            q_objects = Q()
            for p in proteins:
                q_objects |= Q(protein_type__iexact=p)
            queryset = queryset.filter(q_objects)

        return queryset

    @action(detail=False, methods=["get"], url_path="export", pagination_class=None)
    def export(self, request):
        """Export all visible products (unpaginated).

        Respects the same filters as the list endpoint.
        """

        queryset = self.filter_queryset(self.get_queryset())
        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="my-products")
    def my_products(self, request):
        """
        Get products customized for current tenant.

        Returns system products filtered by TenantProductPreference:
        - Only products tenant has marked as active
        - Includes tenant-specific display names, pricing
        - Ordered by tenant's sort_order preference
        """
        if not hasattr(request, "tenant") or not request.tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        # Get tenant preferences
        preferences = (
            TenantProductPreference.objects.filter(
                tenant=request.tenant,
                is_active=True,
                product__is_active=True,
            )
            .select_related("product")
            .order_by("sort_order", "product__name")
        )

        # Build response with tenant customizations
        from apps.system.serializers import TenantProductSerializer

        serializer = TenantProductSerializer(preferences, many=True, context={"request": request})

        return Response(serializer.data)


class TenantProductPreferenceViewSet(viewsets.ModelViewSet):
    """ViewSet for managing tenant product preferences.

    Tenants can:
    - Override display names, pricing, notes
    - Mark favorites
    - Activate/deactivate products (per-tenant)

    Permissions:
    - SAFE methods: any authenticated tenant member.
    - Writes: tenant owners/admins (superuser/staff always allowed).
    """

    permission_classes = [permissions.IsAuthenticated, IsTenantAdminOrOwnerForTenantContext]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]

    # Filterset fields
    filterset_fields = ["is_active", "is_favorite", "preferred_supplier"]

    # Ordering fields
    ordering_fields = ["sort_order", "created_at", "updated_at"]
    ordering = ["sort_order"]

    def get_serializer_class(self):
        """Return appropriate serializer."""
        from apps.system.serializers import TenantProductPreferenceSerializer

        return TenantProductPreferenceSerializer

    def get_queryset(self):
        """Filter preferences by tenant."""
        if not hasattr(self.request, "tenant") or not self.request.tenant:
            logger.warning("No tenant context in TenantProductPreferenceViewSet")
            return TenantProductPreference.objects.none()

        return TenantProductPreference.objects.filter(tenant=self.request.tenant).select_related(
            "product", "preferred_supplier"
        )

    def create(self, request, *args, **kwargs):
        """Upsert by (tenant, product).

        Frontend toggle flows can race or have stale state; allowing an idempotent
        create avoids unique-constraint 400s.
        """
        if not hasattr(request, "tenant") or not request.tenant:
            return Response({"error": "Tenant context required"}, status=status.HTTP_400_BAD_REQUEST)

        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        product = serializer.validated_data.get("product")
        existing = None
        if product is not None:
            existing = TenantProductPreference.objects.filter(tenant=request.tenant, product=product).first()

        if existing:
            update_serializer = self.get_serializer(existing, data=request.data, partial=True)
            update_serializer.is_valid(raise_exception=True)
            update_serializer.save()
            return Response(update_serializer.data, status=status.HTTP_200_OK)

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        """Auto-assign tenant on creation."""
        if not hasattr(self.request, "tenant") or not self.request.tenant:
            raise ValueError("Tenant context is required")

        serializer.save(tenant=self.request.tenant)
        logger.info(f"Created product preference for tenant: {self.request.tenant.slug}")
