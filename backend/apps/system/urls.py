"""
URL configuration for System app API.

Provides endpoints for:
- /api/v1/system/choice-lists/
- /api/v1/system/choice-items/
- /api/v1/system/field-schemas/
- /api/v1/system/tenant-configs/
- /api/v1/system/config/resolve/
- /api/v1/system/config/choices/{slug}/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.system.views import (
    SystemChoiceListViewSet,
    SystemChoiceItemViewSet,
    SystemFieldSchemaViewSet,
    TenantConfigViewSet,
    ConfigResolverView,
)

app_name = 'system'

router = DefaultRouter()
router.register(r'choice-lists', SystemChoiceListViewSet, basename='choice-list')
router.register(r'choice-items', SystemChoiceItemViewSet, basename='choice-item')
router.register(r'field-schemas', SystemFieldSchemaViewSet, basename='field-schema')
router.register(r'tenant-configs', TenantConfigViewSet, basename='tenant-config')
router.register(r'config', ConfigResolverView, basename='config')

urlpatterns = [
    path('', include(router.urls)),
]
