"""
Customers views for ProjectMeats.

Provides REST API endpoints for customer management with strict multi-tenant isolation.

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
from django.contrib.postgres.aggregates import ArrayAgg
from django.contrib.postgres.fields import ArrayField
from django.db import models
from django.db.models import Q, Value
from django.db.models.functions import Coalesce
from django.core.cache import cache

from apps.core.cache_utils import get_tenant_cache_version, stable_query_hash
from apps.system.serializers import SystemProductSerializer

from tenant_apps.customers.models import Customer
from tenant_apps.customers.serializers import CustomerSerializer
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)


class CustomerViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing customers with strict tenant isolation.

    Security Model:
    - Authentication is REQUIRED for all environments
    - Tenant context is MANDATORY - users only see their tenant's data
    - No DEBUG-based bypasses - consistent security across all environments
    """

    CACHE_TTL_SECONDS = 60 * 15

    def _cache_key(self, *, scope: str, tenant_id: str, query_hash: str = 'none') -> str:
        version = get_tenant_cache_version('customers', str(tenant_id))
        return f'pm:v1:customers:v{version}:{scope}:tenant:{tenant_id}:q:{query_hash}'

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

    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = [IsAuthenticated]
    search_fields = ["name", "contact_person", "email"]

    def get_queryset(self):
        """
        Filter customers by tenant - strict isolation enforced.
        
        Tenant Resolution:
        1. request.tenant (set by TenantMiddleware from X-Tenant-ID header or user association)
        2. Empty queryset if no tenant (security - no data exposure)
        
        Returns:
            QuerySet: Customers for the current tenant only
        """
        # Use tenant from middleware
        if hasattr(self.request, 'tenant') and self.request.tenant:
            tenant = self.request.tenant

            empty_id_array = Value([], output_field=ArrayField(models.BigIntegerField()))

            preferred_from_locations = ArrayAgg(
                'customer_locations__associated_master_product_links__master_product_id',
                distinct=True,
                filter=Q(customer_locations__associated_master_product_links__tenant=tenant),
            )
            preferred_from_contacts = ArrayAgg(
                'customer_locations__contacts__preferred_master_product_links__master_product_id',
                distinct=True,
                filter=Q(customer_locations__contacts__preferred_master_product_links__tenant=tenant),
            )

            return Customer.objects.for_tenant(tenant).annotate(
                preferred_products_from_locations=Coalesce(preferred_from_locations, empty_id_array),
                preferred_products_from_contacts=Coalesce(preferred_from_contacts, empty_id_array),
            ).prefetch_related('customer_locations', 'customer_locations__contacts')
        
        # No tenant = no data (security)
        logger.warning(
            f'No tenant context for user {self.request.user.username} '
            f'accessing customers - returning empty queryset'
        )
        return Customer.objects.none()

    def perform_create(self, serializer):
        """Set the tenant when creating a new customer.

        Tenant context must be explicitly resolved by middleware/auth.
        We do not silently default to the user's first tenant on writes.
        """

        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            logger.error(
                'Customer creation attempted without tenant context',
                extra={
                    'user': self.request.user.username if self.request.user.is_authenticated else 'Anonymous',
                    'has_request_tenant': hasattr(self.request, 'tenant'),
                    'timestamp': timezone.now().isoformat(),
                },
            )
            raise DRFValidationError('Tenant context is required to create a customer.')

        serializer.save(tenant=tenant)
        logger.info(f'Created customer: {serializer.data.get("name")} for tenant: {tenant.name}')

    def create(self, request, *args, **kwargs):
        """Create a new customer with enhanced error handling."""
        try:
            return super().create(request, *args, **kwargs)
        except DRFValidationError as e:
            logger.error(
                f'Validation error creating customer: {str(e.detail)}',
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            # Re-raise DRF validation errors to return 400
            raise
        except ValidationError as e:
            logger.error(
                f'Validation error creating customer: {str(e)}',
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            return Response(
                {'error': 'Validation failed', 'details': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            logger.error(
                f'Error creating customer: {str(e)}',
                exc_info=True,
                extra={
                    'request_data': request.data,
                    'user': request.user.username if request.user else 'Anonymous',
                    'timestamp': timezone.now().isoformat()
                }
            )
            return Response(
                {'error': 'Failed to create customer', 'details': 'Internal server error'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    @action(detail=True, methods=['get'], url_path='products')
    def products(self, request, pk=None):
        """List all products associated with this customer.

        GET /api/v1/customers/{id}/products/

        Returns products that have this customer in their M2M relationship.
        Respects tenant isolation.
        """

        customer = self.get_object()
        products = customer.products.all()
        serializer = SystemProductSerializer(products, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'], url_path='product-history')
    def product_history(self, request, pk=None):
        """Aggregated distinct product history for a customer.

        This powers the Customer UI's "Product History" tab.

        We treat Sales Orders as the customer's purchase history for reporting.
        """

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        customer = self.get_object()

        from tenant_apps.sales_orders.models import SalesOrder

        product_ids = (
            SalesOrder.objects.for_tenant(tenant)
            .filter(customer=customer)
            .exclude(product__isnull=True)
            .values_list('product_id', flat=True)
            .distinct()
        )

        from apps.system.models import Product

        products = Product.objects.filter(id__in=list(product_ids), is_active=True).order_by('product_code')
        return Response(SystemProductSerializer(products, many=True).data)
