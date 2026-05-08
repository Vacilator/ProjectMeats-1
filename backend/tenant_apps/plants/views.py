import logging

from django.core.exceptions import ValidationError
from django.db.models import Exists, OuterRef, Q
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from django_filters.rest_framework import DjangoFilterBackend
from tenant_apps.plants.models import Plant
from tenant_apps.plants.serializers import PlantSerializer

from apps.core.permissions import IsRoleAuthorized

logger = logging.getLogger(__name__)


class PlantViewSet(viewsets.ModelViewSet):
    queryset = Plant.objects.all()
    serializer_class = PlantSerializer
    permission_classes = [IsAuthenticated, IsRoleAuthorized]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["supplier", "plant_type", "is_active", "city", "state"]
    search_fields = ["name", "address", "city", "state", "plant_est_num"]
    ordering_fields = ["name", "created_at", "capacity"]
    ordering = ["name"]

    def get_queryset(self):
        """Filter plants by current tenant."""
        if hasattr(self.request, "tenant") and self.request.tenant:
            queryset = Plant.objects.for_tenant(self.request.tenant)
            # Filter by active plants by default unless specified
            is_active = self.request.query_params.get("is_active")
            if is_active is None:
                queryset = queryset.filter(is_active=True)
            return queryset
        return Plant.objects.none()

    def perform_create(self, serializer):
        """Set the tenant when creating a new plant.

        Tenant context must be explicitly resolved by middleware/auth.
        We do not silently default to the user's first tenant on writes.
        """

        tenant = getattr(self.request, "tenant", None)
        if not tenant:
            logger.error(
                "Plant creation attempted without tenant context",
                extra={
                    "user": self.request.user.username
                    if self.request.user and self.request.user.is_authenticated
                    else "Anonymous",
                    "has_request_tenant": hasattr(self.request, "tenant"),
                    "timestamp": timezone.now().isoformat(),
                },
            )
            raise DRFValidationError("Tenant context is required to create a plant.")

        serializer.save(tenant=tenant)

    def create(self, request, *args, **kwargs):
        """Create a new plant with enhanced error handling."""
        # Log incoming request for debugging
        logger.info(
            f"Creating plant with data: {request.data}",
            extra={
                "user": request.user.username if request.user and request.user.is_authenticated else "Anonymous",
                "tenant": getattr(request, "tenant", None),
                "has_tenant_attr": hasattr(request, "tenant"),
            },
        )

        try:
            return super().create(request, *args, **kwargs)
        except DRFValidationError as e:
            logger.error(
                f"Validation error creating plant: {str(e.detail)}",
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user and request.user.is_authenticated else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            # Re-raise DRF validation errors to return 400
            raise
        except ValidationError as e:
            logger.error(
                f"Django validation error creating plant: {str(e)}",
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user and request.user.is_authenticated else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            return Response({"error": "Validation failed", "details": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(
                f"Unexpected error creating plant: {str(e)}",
                exc_info=True,
                extra={
                    "request_data": request.data,
                    "user": request.user.username if request.user and request.user.is_authenticated else "Anonymous",
                    "timestamp": timezone.now().isoformat(),
                },
            )
            return Response(
                {"error": "Failed to create plant", "details": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=["get"], url_path="for-supplier-product")
    def for_supplier_product(self, request):
        """Return plants for a supplier, sorted by whether they have the given product.

        GET /api/v1/plants/for-supplier-product/?supplier=<supplier-id>&product=<system-product-uuid>

        - Filters to the supplier's plants (via Plant.supplier or SupplierPlant link)
        - Does NOT filter out plants without the product; it only sorts them last
        """
        tenant = getattr(request, "tenant", None)
        supplier_id = request.query_params.get("supplier")
        product_id = request.query_params.get("product")

        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)
        if not supplier_id:
            return Response({"error": "supplier is required"}, status=status.HTTP_400_BAD_REQUEST)

        qs = Plant.objects.for_tenant(tenant)

        is_active = request.query_params.get("is_active")
        if is_active is None:
            qs = qs.filter(is_active=True)

        qs = qs.filter(
            Q(supplier_id=supplier_id) | Q(supplier_links__tenant=tenant, supplier_links__supplier_id=supplier_id)
        ).distinct()

        if product_id:
            from tenant_apps.plants.models import PlantAssociatedProduct

            available = PlantAssociatedProduct.objects.filter(
                tenant=tenant,
                plant_id=OuterRef("pk"),
                product_id=product_id,
            )
            qs = qs.annotate(has_product=Exists(available)).order_by("-has_product", "name")
        else:
            qs = qs.order_by("name")

        data = [
            {
                "id": p.id,
                "name": p.name,
                "has_product": bool(getattr(p, "has_product", False)),
            }
            for p in qs.only("id", "name")
        ]

        return Response(data)

    @action(detail=True, methods=["get"], url_path="available-products")
    def available_products(self, request, pk=None):
        """
        List all system products associated with this plant.

        GET /api/v1/plants/{id}/available-products/
        """
        from tenant_apps.plants.models import PlantAssociatedProduct

        from apps.system.serializers import SystemProductSerializer

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

        plant = self.get_object()
        links = PlantAssociatedProduct.objects.filter(
            tenant=tenant,
            plant=plant,
        ).select_related("product")
        products = [link.product for link in links]
        serializer = SystemProductSerializer(products, many=True)
        return Response(serializer.data)

    @available_products.mapping.post
    def add_available_product(self, request, pk=None):
        """
        Add a system product to plant's available products.

        POST /api/v1/plants/{id}/available-products/
        Body: { "product": "<system-product-uuid>" }
        """
        from tenant_apps.plants.models import PlantAssociatedProduct

        from apps.system.models import Product
        from apps.system.serializers import SystemProductSerializer

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

        plant = self.get_object()
        product_id = request.data.get("product")
        if not product_id:
            return Response({"error": "product is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # system.Product is a shared, tenant-agnostic catalog visible to all tenants.
            product = Product.objects.get(id=product_id, is_active=True)
        except Product.DoesNotExist:
            return Response({"error": "Product not found"}, status=status.HTTP_404_NOT_FOUND)

        _, created = PlantAssociatedProduct.objects.get_or_create(
            tenant=tenant,
            plant=plant,
            product=product,
        )
        serializer = SystemProductSerializer(product)
        return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["delete"], url_path="available-products/(?P<product_id>[^/.]+)")
    def remove_available_product(self, request, pk=None, product_id=None):
        """
        Remove a system product from plant's available products.

        DELETE /api/v1/plants/{id}/available-products/{product_id}/
        """
        from tenant_apps.plants.models import PlantAssociatedProduct

        tenant = getattr(request, "tenant", None)
        if not tenant:
            return Response({"error": "Tenant not found"}, status=status.HTTP_400_BAD_REQUEST)

        plant = self.get_object()
        try:
            link = PlantAssociatedProduct.objects.get(
                tenant=tenant,
                plant=plant,
                product_id=product_id,
            )
            link.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except PlantAssociatedProduct.DoesNotExist:
            return Response({"error": "Product association not found"}, status=status.HTTP_404_NOT_FOUND)
