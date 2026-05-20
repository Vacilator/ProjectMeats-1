"""
URL configuration for products app.

Registers ProductViewSet for /api/v1/products/ endpoint.
Uses shared-schema multi-tenancy with tenant filtering in viewset.

Note: /api/v1/products/master/ is exposed as a backward-compatible alias for
/api/v1/master-products/ (MasterProductViewSet list/create). It MUST be declared
before router.urls so the literal `master/` segment is not consumed by the
ProductViewSet detail route (`products/{pk}/`), which would otherwise try to
parse `master` as a UUID and raise ValidationError -> Http404.
"""
import logging
from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import ProductViewSet, MasterProductViewSet

logger = logging.getLogger(__name__)

router = DefaultRouter()

# Register legacy product alias (system catalog)
try:
    router.register(r'products', ProductViewSet, basename='product')
    logger.info("✅ ProductViewSet registered at /api/v1/products/")
except Exception as e:
    logger.error(f"❌ Failed to register ProductViewSet: {e}")

# Register tenant master products (canonical for supplier availability)
try:
    router.register(r'master-products', MasterProductViewSet, basename='master-product')
    logger.info("✅ MasterProductViewSet registered at /api/v1/master-products/")
except Exception as e:
    logger.error(f"❌ Failed to register MasterProductViewSet: {e}")

# Backward-compatible alias: /api/v1/products/master/ -> MasterProductViewSet list/create.
# Declared BEFORE router.urls so it shadows the products/{pk}/ detail route and prevents
# `master` from being parsed as a UUID pk (which produced noisy Http404s; see Sentry
# issue PROJECTMEATS-BACKEND-2G).
urlpatterns = [
    path(
        'products/master/',
        MasterProductViewSet.as_view({'get': 'list', 'post': 'create'}),
        name='products-master-list',
    ),
] + router.urls
