from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import SettlementEventViewSet, SettlementSourceViewSet, TenantAPIKeyViewSet, TenantWebhookViewSet

router = DefaultRouter()
router.register(r"tenant-webhooks", TenantWebhookViewSet, basename="tenant-webhook")
router.register(r"tenant-api-keys", TenantAPIKeyViewSet, basename="tenant-api-key")
router.register(r"settlement-sources", SettlementSourceViewSet, basename="settlement-source")
router.register(r"settlement-events", SettlementEventViewSet, basename="settlement-event")

urlpatterns = [
    path("", include(router.urls)),
]
