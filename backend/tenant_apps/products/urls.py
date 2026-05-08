"""
URL configuration for products app.

Registers ProductViewSet for /api/v1/products/ endpoint.
Uses shared-schema multi-tenancy with tenant filtering in viewset.
"""
import logging

from rest_framework.routers import DefaultRouter

from .views import MasterProductViewSet, ProductViewSet

logger = logging.getLogger(__name__)

router = DefaultRouter()

# Register legacy product alias (system catalog)
try:
    router.register(r"products", ProductViewSet, basename="product")
    logger.info("✅ ProductViewSet registered at /api/v1/products/")
except Exception as e:
    logger.error(f"❌ Failed to register ProductViewSet: {e}")

# Register tenant master products (canonical for supplier availability)
try:
    router.register(r"master-products", MasterProductViewSet, basename="master-product")
    logger.info("✅ MasterProductViewSet registered at /api/v1/master-products/")
except Exception as e:
    logger.error(f"❌ Failed to register MasterProductViewSet: {e}")

urlpatterns = router.urls
