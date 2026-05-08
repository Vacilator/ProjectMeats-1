from django.urls import include, path
from rest_framework.routers import DefaultRouter

from tenant_apps.purchase_orders.views import CarrierPurchaseOrderViewSet, PurchaseOrderViewSet

# Create a router and register our viewsets
router = DefaultRouter()
router.register(r"purchase-orders", PurchaseOrderViewSet)
router.register(r"carrier-pos", CarrierPurchaseOrderViewSet, basename="carrier-po")

# The API URLs are now determined automatically by the router
urlpatterns = [
    path("", include(router.urls)),
]
