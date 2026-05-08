"""System app views."""
from apps.system.views.choice_viewsets import (
    ConfigAuditLogViewSet,
    ConfigResolverView,
    EntityIntrospectionViewSet,
    SystemChoiceItemViewSet,
    SystemChoiceListViewSet,
    SystemChoicesAPIView,
    SystemFieldSchemaViewSet,
    TenantChoiceOverrideViewSet,
    TenantConfigViewSet,
)
from apps.system.views.product_viewset import SystemProductViewSet, TenantProductPreferenceViewSet

__all__ = [
    "SystemProductViewSet",
    "TenantProductPreferenceViewSet",
    "SystemChoiceListViewSet",
    "SystemChoiceItemViewSet",
    "SystemFieldSchemaViewSet",
    "TenantConfigViewSet",
    "TenantChoiceOverrideViewSet",
    "ConfigResolverView",
    "ConfigAuditLogViewSet",
    "EntityIntrospectionViewSet",
    "SystemChoicesAPIView",
]
