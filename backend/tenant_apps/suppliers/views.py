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
from tenant_apps.suppliers.models import Supplier
from tenant_apps.suppliers.serializers import SupplierSerializer
from apps.tenants.models import TenantUser
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

    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    permission_classes = [IsAuthenticated]

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
            return Supplier.objects.for_tenant(self.request.tenant)
        
        # No tenant = no data (security)
        logger.warning(
            f'No tenant context for user {self.request.user.username} '
            f'accessing suppliers - returning empty queryset'
        )
        return Supplier.objects.none()

    def perform_create(self, serializer):
        """
        Set the tenant when creating a new supplier.
        
        Tenant Resolution:
        1. Use request.tenant from TenantMiddleware
        2. Fallback to user's TenantUser association if middleware didn't set tenant
        3. Raise ValidationError if no tenant found
        
        Args:
            serializer: Validated serializer instance
            
        Raises:
            ValidationError: If no tenant context is available
        """
        tenant = None
        
        # Get tenant from middleware (request.tenant)
        if hasattr(self.request, 'tenant') and self.request.tenant:
            tenant = self.request.tenant
        
        # Fallback: Query user's TenantUser association if middleware didn't set tenant
        elif self.request.user and self.request.user.is_authenticated:
            tenant_user = (
                TenantUser.objects.filter(user=self.request.user, is_active=True)
                .select_related('tenant')
                .order_by('-role')  # Prioritize owner/admin roles
                .first()
            )
            if tenant_user:
                tenant = tenant_user.tenant
                logger.debug(
                    f'Tenant resolved from user association: {tenant.slug} '
                    f'for user {self.request.user.username}'
                )
        
        # Require tenant - raise error if still not found
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
            logger.error(
                f'Validation error creating supplier: {str(e)}',
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
    
    @action(detail=True, methods=['get'], url_path='products')
    def products(self, request, pk=None):
        """
        List all products associated with this supplier.
        
        GET /api/v1/suppliers/{id}/products/
        
        Returns products that have this supplier in their M2M relationship.
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
