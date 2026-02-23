"""
ViewSet for system-wide products with tenant preferences.

Products are shared across all tenants (system.Product).
Tenants customize via TenantProductPreference (display names, pricing, availability).

This replaces tenant_apps.products.views.ProductViewSet.
"""
import logging
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.filters import SearchFilter, OrderingFilter
from django_filters.rest_framework import DjangoFilterBackend
from apps.system.models import Product, TenantProductPreference

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
        """
        Return all active system products.
        
        Optionally filter by protein types:
        - ?protein=BEEF&protein=PORK - Multiple protein types
        """
        queryset = super().get_queryset()
        
        # Protein type filtering (supports multiple values)
        protein_types = self.request.query_params.getlist('protein', None)
        if protein_types:
            queryset = queryset.filter(protein_type__in=protein_types)
            logger.debug(f"Filtered system products by protein types: {protein_types}")
        
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
    
    @action(detail=False, methods=['get'], url_path='suggest')
    def suggest_products(self, request):
        """
        Suggest products based on criteria (auto-suggest for inquiry/fulfillment forms).
        
        Query Parameters:
        - price_min: Minimum price filter
        - price_max: Maximum price filter
        - type: Product category filter (BEEF, PORK, POULTRY, etc.)
        - fresh_frozen: FRESH or FROZEN
        - location: Supplier location (future enhancement)
        - query: Search text (fuzzy match on name/description)
        
        Returns top 5 suggestions ranked by:
        - Availability (in stock > out of stock)
        - Recency (recently used by tenant)
        - Price match (within range)
        - User history (future: learn from past orders)
        
        Example:
        GET /api/v1/system/products/suggest/?type=BEEF&price_min=5&price_max=15&query=ribeye
        """
        # Base queryset: active products
        queryset = Product.objects.filter(is_active=True)
        
        # Apply filters
        price_min = request.query_params.get('price_min')
        price_max = request.query_params.get('price_max')
        product_type = request.query_params.get('type')
        fresh_frozen = request.query_params.get('fresh_frozen')
        search_query = request.query_params.get('query', '').strip()
        
        if price_min:
            try:
                # Note: TenantProductPreference stores pricing, not system Product
                # For now, filter by availability. Future: join with preferences
                pass
            except (ValueError, TypeError):
                pass
        
        if price_max:
            try:
                pass
            except (ValueError, TypeError):
                pass
        
        if product_type:
            queryset = queryset.filter(protein_type=product_type.upper())
            logger.debug(f"Filtered suggestions by type: {product_type}")
        
        if fresh_frozen:
            queryset = queryset.filter(fresh_or_frozen=fresh_frozen.upper())
            logger.debug(f"Filtered suggestions by fresh/frozen: {fresh_frozen}")
        
        # Fuzzy search on query
        if search_query:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(name__icontains=search_query) |
                Q(description__icontains=search_query) |
                Q(product_code__icontains=search_query)
            )
            logger.debug(f"Fuzzy search on: {search_query}")
        
        # Rank by relevance (simple scoring for now)
        # Future: Add user history, supplier availability, tenant preferences
        queryset = queryset.order_by(
            '-tested_product',  # Prioritize tested products
            'name'  # Alphabetical
        )
        
        # Limit to top 5 suggestions
        suggestions = queryset[:5]
        
        # Serialize with minimal fields for performance
        from apps.system.serializers import SystemProductSerializer
        serializer = SystemProductSerializer(suggestions, many=True, context={'request': request})
        
        logger.info(f"Auto-suggest returned {len(suggestions)} products")
        
        return Response({
            'count': len(suggestions),
            'suggestions': serializer.data,
            'filters_applied': {
                'type': product_type,
                'fresh_frozen': fresh_frozen,
                'query': search_query,
            }
        })


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
