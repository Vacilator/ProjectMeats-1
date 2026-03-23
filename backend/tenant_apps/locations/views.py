"""
ViewSets for Locations app.
"""
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from .models import Location
from .serializers import LocationSerializer, LocationListSerializer


class LocationViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing Location instances with tenant isolation.
    """
    permission_classes = [IsAuthenticated]
    serializer_class = LocationSerializer
    
    def get_queryset(self):
        """Filter locations by tenant for isolation.

        Supports optional query params for drill-down UIs:
        - supplier=<id>
        - customer=<id>
        - location_type=<value>
        """
        qs = Location.objects.filter(tenant=self.request.tenant)

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
        serializer.save(tenant=self.request.tenant)
