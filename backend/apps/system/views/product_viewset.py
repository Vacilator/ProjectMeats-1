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


class SystemProductViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only ViewSet for system products.
    
    All tenants share the same product catalog (system.Product).
    Products are created via management command: python manage.py seed_system_products
    
    Permissions:
    - Authenticated users can view all system products
    - System products are READ-ONLY (managed by admins only)
    
    Filters:
    - Search: product_code, name, description
    - Filter: category, protein_type, fresh_or_frozen, is_active
    - Ordering: product_code, name, category, unit_weight
    """
    
    queryset = Product.objects.filter(is_active=True)
    permission_classes = [permissions.IsAuthenticated]
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
    
    def get_serializer_class(self):
        """Return appropriate serializer based on action."""
        from apps.system.serializers import SystemProductSerializer
        return SystemProductSerializer
    
    def get_queryset(self):
        """Return products visible to the current tenant.

        Three-tier strategy:
        - System products (golden list) are visible by default.
        - Tenants can hide/override via TenantProductPreference.
        - Tenant custom products are represented as system.Product rows with
          is_system=False and are visible only to the owning tenant.

        Cascade filtering (protein → product):
        - ?protein=beef&protein=pork - Multiple protein types (lowercase slugs)
        - ?protein_type=beef - Single protein type
        - Case-insensitive matching for backward compatibility
        """

        # Base queryset is active products; visibility rules are applied next.
        queryset = Product.objects.all()

        tenant = getattr(self.request, "tenant", None)
        queryset = visible_products_qs(tenant=tenant, qs=queryset)

        # Prefetch tenant preference rows for serializer/UI overlays.
        if tenant:
            queryset = queryset.prefetch_related(
                Prefetch(
                    "tenant_preferences",
                    queryset=TenantProductPreference.objects.filter(tenant=tenant),
                )
            )

        # Protein type filtering (comma-separated, case-insensitive)
        protein_param = self.request.query_params.get("protein") or self.request.query_params.get("protein_type")

        if protein_param:
            from django.db.models import Q

            proteins = [p.strip() for p in protein_param.split(',')]
            q_objects = Q()
            for p in proteins:
                q_objects |= Q(protein_type__iexact=p)
            queryset = queryset.filter(q_objects)
            logger.debug(f"Filtered products by protein types: {proteins}")

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
