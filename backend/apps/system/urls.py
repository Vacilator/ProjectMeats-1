"""
URL configuration for System app API.

Provides endpoints for:
- /api/v1/system/choice-lists/
- /api/v1/system/choice-items/
- /api/v1/system/field-schemas/
- /api/v1/system/tenant-configs/
- /api/v1/system/config/resolve/
- /api/v1/system/config/choices/{slug}/
- /api/v1/system/audit-logs/
"""
from django.urls import path, include
from rest_framework.routers import DefaultRouter

from apps.system.views import (
    SystemChoiceListViewSet,
    SystemChoiceItemViewSet,
    SystemFieldSchemaViewSet,
    TenantConfigViewSet,
    ConfigResolverView,
    ConfigAuditLogViewSet,
    EntityIntrospectionViewSet,
    SystemProductViewSet,
    TenantProductPreferenceViewSet,
)
from apps.system.views.search_viewset import RankedSearchViewSet
from apps.system.views.entity_viewset import EntityViewSet

app_name = 'system'

router = DefaultRouter()
router.register(r'choice-lists', SystemChoiceListViewSet, basename='choice-list')
router.register(r'choice-items', SystemChoiceItemViewSet, basename='choice-item')
router.register(r'field-schemas', SystemFieldSchemaViewSet, basename='field-schema')
router.register(r'tenant-configs', TenantConfigViewSet, basename='tenant-config')
router.register(r'config', ConfigResolverView, basename='config')
router.register(r'audit-logs', ConfigAuditLogViewSet, basename='audit-log')
router.register(r'entities-introspect', EntityIntrospectionViewSet, basename='entity-introspect')
router.register(r'entities', EntityViewSet, basename='entity-graph')
router.register(r'products', SystemProductViewSet, basename='product')
router.register(r'product-preferences', TenantProductPreferenceViewSet, basename='product-preference')
router.register(r'search/ranked', RankedSearchViewSet, basename='ranked-search')

urlpatterns = [
    # Cockpit Entity Graph (typed URLs)
    # The DefaultRouter only supports /entities/<pk>/..., but Cockpit uses /entities/<type>/<id>/...
    path(
        'entities/<str:type>/<str:pk>/relationships/',
        EntityViewSet.as_view({'get': 'relationships'}),
        name='entity-relationships',
    ),
    path(
        'entities/<str:type>/<str:pk>/fuzzy-related/',
        EntityViewSet.as_view({'get': 'fuzzy_related'}),
        name='entity-fuzzy-related',
    ),
    path(
        'entities/<str:type>/<str:pk>/',
        EntityViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update'}),
        name='entity-detail',
    ),

    path('', include(router.urls)),
]
