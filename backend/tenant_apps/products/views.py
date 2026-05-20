"""Products endpoint compatibility layer.

Phase 8.0 introduced the three-tier product architecture using system.Product.

Canonical endpoint:
  - /api/v1/system/products/

Legacy endpoint (deprecated but kept for backwards compatibility):
  - /api/v1/products/

This module implements /api/v1/products/ as a *read-only alias* that returns
system products visible to the current tenant (including tenant custom products)
using the same visibility rules as the canonical endpoint.
"""

import logging
import uuid

from django.http import Http404
from rest_framework import permissions, viewsets
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.system.views.product_viewset import SystemProductViewSet

from .models import MasterProduct
from .serializers import LegacySystemProductSerializer, ProductSerializer

logger = logging.getLogger(__name__)


class MasterProductViewSet(viewsets.ModelViewSet):
    """CRUD API for tenant-scoped MasterProduct.

    This is the canonical API for the tenant's product definitions used by supplier
    availability (SupplierAvailableItem) and plant associations.

    Kept separate from /api/v1/products/, which is a deprecated, read-only alias to
    /api/v1/system/products/ (three-tier catalog).
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProductSerializer

    def get_queryset(self):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            return MasterProduct.objects.none()

        return MasterProduct.objects.filter(tenant=tenant).order_by('display_name')

    def perform_create(self, serializer):
        tenant = getattr(self.request, 'tenant', None)
        if not tenant:
            raise DRFValidationError('Tenant context is required to create a product.')

        serializer.save(tenant=tenant)


class ProductViewSet(SystemProductViewSet):
    """Deprecated alias for system products.

    Returns a backwards-compatible payload shape using legacy field names.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return LegacySystemProductSerializer

    def get_object(self):
        """Short-circuit non-UUID pks with a silent Http404.

        The legacy /api/v1/products/ alias proxies to SystemProductViewSet which uses
        UUID primary keys. Stale clients occasionally hit /api/v1/products/<non-uuid>/
        (e.g. /products/master/), which would otherwise raise ValidationError ->
        Http404 with noisy error logging (Sentry issue PROJECTMEATS-BACKEND-2G).
        Validate the pk format here and 404 cleanly instead.
        """
        pk = self.kwargs.get(self.lookup_field or 'pk')
        if pk is not None:
            try:
                uuid.UUID(str(pk))
            except (ValueError, AttributeError, TypeError):
                raise Http404("Product not found.")
        return super().get_object()

    def list(self, request, *args, **kwargs):
        response = super().list(request, *args, **kwargs)
        response["X-ProjectMeats-Deprecated"] = "true"
        response["X-ProjectMeats-Canonical"] = "/api/v1/system/products/"
        return response

    def retrieve(self, request, *args, **kwargs):
        response = super().retrieve(request, *args, **kwargs)
        response["X-ProjectMeats-Deprecated"] = "true"
        response["X-ProjectMeats-Canonical"] = "/api/v1/system/products/"
        return response
