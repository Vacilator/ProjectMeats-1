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
    TenantChoiceOverrideViewSet,
    ConfigResolverView,
    ConfigAuditLogViewSet,
    EntityIntrospectionViewSet,
    SystemProductViewSet,
    TenantProductPreferenceViewSet,
)
from apps.system.views.search_viewset import RankedSearchViewSet
from apps.system.views.entity_viewset import EntityViewSet
from apps.system.views.forms_schema import SystemFormSchemaView

app_name = 'system'

router = DefaultRouter()
router.register(r'choice-lists', SystemChoiceListViewSet, basename='choice-list')
router.register(r'choice-items', SystemChoiceItemViewSet, basename='choice-item')
router.register(r'field-schemas', SystemFieldSchemaViewSet, basename='field-schema')
router.register(r'tenant-configs', TenantConfigViewSet, basename='tenant-config')
router.register(r'tenant-overrides', TenantChoiceOverrideViewSet, basename='tenant-override')
router.register(r'config', ConfigResolverView, basename='config')
router.register(r'audit-logs', ConfigAuditLogViewSet, basename='audit-log')
# IMPORTANT:
# - `/api/v1/system/entities/` is reserved for Schema Bridge entity introspection (FlowEditor, admin-form builder parity).
# - Cockpit record/relationship APIs use typed routes: `/api/v1/system/entities/<type>/<id>/...` (see custom paths below).
#
# Keep an alias at `entities-introspect` for backward compatibility, but the canonical path is `entities`.
router.register(r'entities', EntityIntrospectionViewSet, basename='entity-introspect')
router.register(r'entities-introspect', EntityIntrospectionViewSet, basename='entity-introspect-alias')
router.register(r'products', SystemProductViewSet, basename='product')
router.register(r'product-preferences', TenantProductPreferenceViewSet, basename='product-preference')
router.register(r'search/ranked', RankedSearchViewSet, basename='ranked-search')

urlpatterns = [
    # IMPORTANT: include router first so Schema Bridge routes work:
    # - /api/v1/system/entities/<entity_id>/fields/
    # - /api/v1/system/entities/<entity_id>/display-fields/
    # (These would otherwise be captured by the typed Cockpit routes below.)
    path('', include(router.urls)),

    # Metadata-driven UI schemas
    path('forms/schema/', SystemFormSchemaView.as_view(), name='forms-schema'),

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
        'entities/<str:type>/<str:pk>/summary/',
        EntityViewSet.as_view({'get': 'summary'}),
        name='entity-summary',
    ),
    path(
        'entities/<str:type>/<str:pk>/',
        EntityViewSet.as_view({'get': 'retrieve', 'patch': 'partial_update'}),
        name='entity-detail',
    ),
]
