"""
System Configuration Models.

This module provides a 3-tier configuration system:
- SystemChoiceList: System-wide dropdown/choice list definitions
- SystemChoiceItem: Individual items within a choice list
- SystemFieldSchema: Field-level configuration and validation
- TenantConfig: Tenant-specific overrides and preferences
- Product: System-wide product catalog (shared across all tenants)
- TenantProductPreference: Tenant-specific product customizations
"""
from apps.system.models.system_choice import SystemChoiceList, SystemChoiceItem
from apps.system.models.system_schema import SystemFieldSchema
from apps.system.models.tenant_config import TenantConfig
from apps.system.models.product import Product, ProductCategoryChoices
from apps.system.models.tenant_product_preference import TenantProductPreference

__all__ = [
    'SystemChoiceList',
    'SystemChoiceItem',
    'SystemFieldSchema',
    'TenantConfig',
    'Product',
    'ProductCategoryChoices',
    'TenantProductPreference',
]
