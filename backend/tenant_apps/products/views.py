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

from rest_framework import permissions, viewsets

from apps.system.views.product_viewset import SystemProductViewSet

from .serializers import LegacySystemProductSerializer

logger = logging.getLogger(__name__)


class ProductViewSet(SystemProductViewSet):
    """Deprecated alias for system products.

    Returns a backwards-compatible payload shape using legacy field names.
    """

    permission_classes = [permissions.IsAuthenticated]

    def get_serializer_class(self):
        return LegacySystemProductSerializer

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