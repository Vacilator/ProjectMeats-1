"""
Suppliers views for ProjectMeats.

Provides REST API endpoints for supplier management with strict multi-tenant isolation.

SECURITY MODEL:
===============
All Environments:
    - Authentication is REQUIRED (IsAuthenticated permission)
    - Tenant context is MANDATORY from middleware (X-Tenant-ID header or user association)
    - Strict tenant isolation enforced - users only see their tenant's data
    - ✅ SECURE: Proper multi-tenant data isolation across all environments
"""
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError as DRFValidationError
from django.core.exceptions import ValidationError
from django.db import models
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db.models import Exists, OuterRef, Q, Value
from django.db.models.functions import Coalesce
from django.core.cache import cache
from tenant_apps.suppliers.models import Supplier
from tenant_apps.suppliers.serializers import SupplierSerializer
from apps.core.cache_utils import get_tenant_cache_version, stable_query_hash
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class SupplierViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing suppliers with strict tenant isolation.

    Security Model:
    - Authentication is REQUIRED for all environments
    - Tenant context is MANDATORY - users only see their tenant's data
    - No DEBUG-based bypasses - consistent security across all environments
    """

    CACHE_TTL_SECONDS = 60 * 15

    def _cache_key(self, *, scope: str, tenant_id: str, query_hash: str = 'none') -> str:
        version = get_tenant_cache_version('suppliers', str(tenant_id))
        return f'pm:v1:suppliers:v{version}:{scope}:tenant:{tenant_id}:q:{query_hash}'

    def list(self, request, *args, **kwargs):
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        query_items: list[tuple[str, str]] = []
        for key in sorted(request.query_params.keys()):
            for value in sorted(request.query_params.getlist(key)):
                query_items.append((key, value))
        qh = stable_query_hash(query_items)

        cache_key = self._cache_key(scope='list', tenant_id=str(tenant.id), query_hash=qh)
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().list(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, self.CACHE_TTL_SECONDS)
        return response

    def retrieve(self, request, *args, **kwargs):
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        pk = kwargs.get('pk')
        cache_key = self._cache_key(scope=f'retrieve:{pk}', tenant_id=str(tenant.id))
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached)

        response = super().retrieve(request, *args, **kwargs)
        if response.status_code == status.HTTP_200_OK:
            cache.set(cache_key, response.data, self.CACHE_TTL_SECONDS)
        return response

    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "contact_person", "email"]

    def get_queryset(self):
        """
        Filter suppliers by tenant - strict isolation enforced.
        
        Tenant Resolution:
        1. request.tenant (set by TenantMiddleware from X-Tenant-ID header or user association)
        2. Empty queryset if no tenant (security - no data exposure)
        
        Returns:
            QuerySet: Suppliers for the current tenant only
        """
        # Use tenant from middleware
        if hasattr(self.request, 'tenant') and self.request.tenant:
            tenant = self.request.tenant
            empty_id_array = Value([], output_field=ArrayField(models.BigIntegerField()))

            products_available = ArrayAgg(
                'supplier_plants__associated_master_product_links__master_product_id',
                distinct=True,
                filter=Q(supplier_plants__associated_master_product_links__tenant=tenant),
            )

            return Supplier.objects.for_tenant(tenant).annotate(
                products_available=Coalesce(products_available, empty_id_array),
            ).prefetch_related('supplier_plants', 'supplier_plants__contacts')
        
        # No tenant = no data (security)
        logger.warning(
            f'No tenant context for user {self.request.user.username} '
            f'accessing suppliers - returning empty queryset'
        )
        return Supplier.objects.none()

    def perform_create(self, serializer):
        """
        Set the tenant when creating a new supplier.

        Tenant context must already be resolved by middleware/auth. We do not
        silently choose a membership when the request is ambiguous.
        """
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            error_message = 'Tenant context is required to create a supplier. Please ensure you are associated with a tenant.'
            logger.error(
                'Supplier creation attempted without tenant context',
                extra={
                    'user': self.request.user.username if self.request.user.is_authenticated else 'Anonymous',
                    'has_request_tenant': hasattr(self.request, 'tenant'),
                    'timestamp': timezone.now().isoformat(),
                }
            )
            raise ValidationError(error_message)
        
        # Save with tenant association
        serializer.save(tenant=tenant)
        logger.info(f'Created supplier: {serializer.data.get("name")} for tenant: {tenant.name}')

    def create(self, request, *args, **kwargs):
        """Create a new supplier with enhanced error handling."""
        try:
            return super().create(request, *args, **kwargs)
        except DRFValidationError as e:
            logger.error(
                f'Validation error creating supplier: {str(e.detail)}',
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            # Re-raise DRF validation errors to return 400
            raise
        except ValidationError as e:
            if hasattr(e, 'message_dict'):
                details = e.message_dict
            elif hasattr(e, 'messages'):
                details = e.messages
            else:
                details = [str(e)]

            logger.error(
                f'Validation error creating supplier: {str(e)}',
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            return Response(
                {'error': 'Validation failed', 'details': details},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(
                f'Error creating supplier: {str(e)}',
                exc_info=True,
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            return Response(
                {'error': 'Failed to create supplier', 'details': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=False, methods=['get'], url_path='for-product')
    def for_product(self, request):
        """Return all suppliers, sorted by whether they have the given product available.

        GET /api/v1/suppliers/for-product/?product=<system-product-uuid>

        Does NOT filter out suppliers without the product; it only sorts them last.
        """
        tenant = getattr(request, 'tenant', None)
        product_id = request.query_params.get('product')

        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        qs = Supplier.objects.for_tenant(tenant).only('id', 'name')

        if product_id:
            from tenant_apps.suppliers.models import SupplierAvailableItem

            available = SupplierAvailableItem.objects.filter(
                tenant=tenant,
                supplier_id=OuterRef('pk'),
                product_id=product_id,
                is_active=True,
            )
            qs = qs.annotate(has_product=Exists(available)).order_by('-has_product', 'name')
        else:
            qs = qs.annotate(has_product=models.Value(False, output_field=models.BooleanField())).order_by('name')

        data = [
            {
                'id': s.id,
                'name': s.name,
                'has_product': bool(getattr(s, 'has_product', False)),
            }
            for s in qs
        ]
        return Response(data)

    @action(detail=True, methods=['get'], url_path='products')
    def products(self, request, pk=None):
        """
        List all available items (active and inactive) associated with this supplier.

        GET /api/v1/suppliers/{id}/products/

        Returns all SupplierAvailableItems regardless of is_active status.
        Use the is_active field in the response to filter on the client if needed.
        Respects tenant isolation.
        """
        from tenant_apps.suppliers.serializers import SupplierAvailableItemSerializer

        supplier = self.get_object()
        items = supplier.available_items.filter(tenant=request.tenant).select_related('product')
        serializer = SupplierAvailableItemSerializer(items, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'], url_path='available-products')
    def add_available_product(self, request, pk=None):
        """
        Add a system product to supplier's available items.

        POST /api/v1/suppliers/{id}/available-products/
        Body: { "product": "<system-product-uuid>" }
        """
        from tenant_apps.suppliers.models import SupplierAvailableItem
        from tenant_apps.suppliers.serializers import SupplierAvailableItemSerializer
        from apps.system.models import Product

        supplier = self.get_object()
        product_id = request.data.get('product')
        if not product_id:
            return Response({'error': 'product is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # system.Product is a shared, tenant-agnostic catalog visible to all tenants.
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        item, created = SupplierAvailableItem.objects.get_or_create(
            tenant=request.tenant,
            supplier=supplier,
            product=product,
            defaults={'is_active': True},
        )
        if not created:
            item.is_active = True
            item.save(update_fields=['is_active'])

        serializer = SupplierAvailableItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='available-products/(?P<product_id>[^/.]+)')
    def remove_available_product(self, request, pk=None, product_id=None):
        """
        Remove a system product from supplier's available items.

        DELETE /api/v1/suppliers/{id}/available-products/{product_id}/
        """
        from tenant_apps.suppliers.models import SupplierAvailableItem

        supplier = self.get_object()
        try:
            item = SupplierAvailableItem.objects.get(
                tenant=request.tenant,
                supplier=supplier,
                product_id=product_id,
            )
            item.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except SupplierAvailableItem.DoesNotExist:
            return Response({'error': 'Available item not found'}, status=status.HTTP_404_NOT_FOUND)
