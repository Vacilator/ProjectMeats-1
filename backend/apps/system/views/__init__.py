"""System app views."""
from apps.system.views.product_viewset import SystemProductViewSet, TenantProductPreferenceViewSet
from apps.system.views.choice_viewsets import (
    SystemChoiceListViewSet,
    SystemChoiceItemViewSet,
    SystemFieldSchemaViewSet,
    TenantConfigViewSet,
    TenantChoiceOverrideViewSet,
    ConfigResolverView,
    ConfigAuditLogViewSet,
    EntityIntrospectionViewSet,
)

__all__ = [
    'SystemProductViewSet', 
    'TenantProductPreferenceViewSet',
    'SystemChoiceListViewSet',
    'SystemChoiceItemViewSet',
    'SystemFieldSchemaViewSet',
    'TenantConfigViewSet',
    'TenantChoiceOverrideViewSet',
    'ConfigResolverView',
    'ConfigAuditLogViewSet',
    'EntityIntrospectionViewSet',
]
