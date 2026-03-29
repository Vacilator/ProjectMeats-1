"""
ViewSet for system-wide products with tenant preferences.

Products are shared across all tenants (system.Product).
Tenants customize via TenantProductPreference (display names, pricing, availability).

This replaces tenant_apps.products.views.ProductViewSet.
"""
import logging

from django.db.models import Prefetch
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend

from apps.system.models import Product, TenantProductPreference
from apps.system.services.product_visibility import visible_products_qs

logger = logging.getLogger(__name__)


class SystemProductViewSet(viewsets.ModelViewSet):
    """ViewSet for system-wide products.

    - GET is available to authenticated users (tenant visibility rules apply).
    - Writes are restricted to staff users (Admin Workspace power feature).
    """

    queryset = Product.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    # Search fields
    search_fields = ['product_code', 'name', 'description', 'namp_code', 'usda_code']
    
    # Filterset fields
    filterset_fields = [
        'category',
        'protein_type',
        'fresh_or_frozen',
        'package_type',
        'is_active',
        'tested_product',
    ]
    
    # Ordering fields
    ordering_fields = ['product_code', 'name', 'category', 'unit_weight', 'created_at']
    ordering = ['product_code']
    
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

        include_inactive_raw = str(self.request.query_params.get('include_inactive') or '').lower()
        include_inactive = include_inactive_raw in ('1', 'true', 'yes')

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

            proteins = [p.strip() for p in protein_param.split(',')]
            q_objects = Q()
            for p in proteins:
                q_objects |= Q(protein_type__iexact=p)
            queryset = queryset.filter(q_objects)

        return queryset
    
    @action(detail=False, methods=['get'], url_path='my-products')
    def my_products(self, request):
        """
        Get products customized for current tenant.
        
        Returns system products filtered by TenantProductPreference:
        - Only products tenant has marked as active
        - Includes tenant-specific display names, pricing
        - Ordered by tenant's sort_order preference
        """
        if not hasattr(request, 'tenant') or not request.tenant:
            return Response(
                {"error": "Tenant context required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get tenant preferences
        preferences = TenantProductPreference.objects.filter(
            tenant=request.tenant,
            is_active=True
        ).select_related('product').order_by('sort_order', 'product__name')
        
        # Build response with tenant customizations
        from apps.system.serializers import TenantProductSerializer
        serializer = TenantProductSerializer(preferences, many=True, context={'request': request})
        
        return Response(serializer.data)


class TenantProductPreferenceViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tenant product preferences.
    
    Tenants can:
    - Add system products to their catalog
    - Customize display names
    - Set pricing
    - Mark favorites
    - Set preferred suppliers
    - Activate/deactivate products
    
    Permissions:
    - Authenticated users can manage their tenant's preferences
    """
    
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    
    # Filterset fields
    filterset_fields = ['is_active', 'is_favorite', 'preferred_supplier']
    
    # Ordering fields
    ordering_fields = ['sort_order', 'created_at', 'updated_at']
    ordering = ['sort_order']
    
    def get_serializer_class(self):
        """Return appropriate serializer."""
        from apps.system.serializers import TenantProductPreferenceSerializer
        return TenantProductPreferenceSerializer
    
    def get_queryset(self):
        """Filter preferences by tenant."""
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            logger.warning("No tenant context in TenantProductPreferenceViewSet")
            return TenantProductPreference.objects.none()
        
        return TenantProductPreference.objects.filter(
            tenant=self.request.tenant
        ).select_related('product', 'preferred_supplier')
    
    def perform_create(self, serializer):
        """Auto-assign tenant on creation."""
        if not hasattr(self.request, 'tenant') or not self.request.tenant:
            raise ValueError("Tenant context is required")
        
        serializer.save(tenant=self.request.tenant)
        logger.info(f"Created product preference for tenant: {self.request.tenant.slug}")
