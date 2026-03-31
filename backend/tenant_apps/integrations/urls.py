from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import TenantAPIKeyViewSet, TenantWebhookViewSet

router = DefaultRouter()
router.register(r'tenant-webhooks', TenantWebhookViewSet, basename='tenant-webhook')
router.register(r'tenant-api-keys', TenantAPIKeyViewSet, basename='tenant-api-key')

urlpatterns = [
    path('', include(router.urls)),
]
