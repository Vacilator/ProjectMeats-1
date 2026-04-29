"""ViewSets for Locations app."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.system.models import Product
from apps.system.serializers import SystemProductSerializer

from .models import Location, LocationAssociatedProduct
from .serializers import LocationListSerializer, LocationSerializer


class LocationViewSet(viewsets.ModelViewSet):
    """ViewSet for managing Location instances with tenant isolation."""

    permission_classes = [IsAuthenticated]
    serializer_class = LocationSerializer

    def get_queryset(self):
        """Filter locations by tenant for isolation.

        Supports optional query params for drill-down UIs:
        - supplier=<id>
        - customer=<id>
        - location_type=<value>
        """

        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return Location.objects.none()

        qs = Location.objects.filter(tenant=tenant)

        supplier_id = self.request.query_params.get('supplier')
        if supplier_id:
            qs = qs.filter(supplier_id=supplier_id)

        customer_id = self.request.query_params.get('customer')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        location_type = self.request.query_params.get('location_type')
        if location_type:
            qs = qs.filter(location_type=location_type)

        return qs

    def get_serializer_class(self):
        """Use lightweight serializer for list actions."""

        if self.action == 'list':
            return LocationListSerializer
        return LocationSerializer

    def perform_create(self, serializer):
        """Assign tenant automatically on creation."""
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise DRFValidationError('Tenant context is required to create a location.')

        serializer.save(tenant=tenant)

    @action(detail=True, methods=['get'], url_path='available-products')
    def available_products(self, request, pk=None):
        """List all system products associated with this location."""

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        location = self.get_object()
        links = LocationAssociatedProduct.objects.filter(
            tenant=tenant,
            location=location,
        ).select_related('product')
        products = [link.product for link in links]
        serializer = SystemProductSerializer(products, many=True)
        return Response(serializer.data)

    @available_products.mapping.post
    def add_available_product(self, request, pk=None):
        """Add a system product to this location's associated products."""

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        location = self.get_object()
        product_id = request.data.get('product')
        if not product_id:
            return Response({'error': 'product is required'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({'error': 'Product not found'}, status=status.HTTP_404_NOT_FOUND)

        _, created = LocationAssociatedProduct.objects.get_or_create(
            tenant=tenant,
            location=location,
            product=product,
        )
        serializer = SystemProductSerializer(product)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=['delete'], url_path='available-products/(?P<product_id>[^/.]+)')
    def remove_available_product(self, request, pk=None, product_id=None):
        """Remove a system product from this location's associated products."""

        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return Response({'error': 'Tenant not found'}, status=status.HTTP_400_BAD_REQUEST)

        location = self.get_object()
        deleted, _ = LocationAssociatedProduct.objects.filter(
            tenant=tenant,
            location=location,
            product_id=product_id,
        ).delete()

        return Response({'deleted': bool(deleted)})
