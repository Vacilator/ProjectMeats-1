"""
System Configuration Models.

This module provides a 3-tier configuration system:
- SystemChoiceList: System-wide dropdown/choice list definitions
- SystemChoiceItem: Individual items within a choice list
- SystemFieldSchema: Field-level configuration and validation
- TenantConfig: Tenant-specific overrides and preferences
- Product: System-wide product catalog (shared across all tenants)
- TenantProductPreference: Tenant-specific product customizations
- ConfigAuditLog: Audit trail for configuration changes
- TenantForm: Tenant-specific form definitions (WorkForms Phase 1.4)
- TenantWorkForm: Tenant-specific workflow definitions (WorkForms Phase 1.6)
- TenantChoiceOverride: Tenant-specific choice list overrides (Phase 3)
- TenantFieldDefinition: Virtual field definitions (Phase 3)
"""
from apps.system.models.system_choice import SystemChoiceList, SystemChoiceItem
from apps.system.models.system_schema import SystemFieldSchema
from apps.system.models.system_configuration import SystemConfiguration
from apps.system.models.tenant_config import TenantConfig
from apps.system.models.product import Product, ProductCategoryChoices
from apps.system.models.tenant_product_preference import TenantProductPreference
from apps.system.models.audit_log import ConfigAuditLog
from apps.system.models.tenant_form import TenantForm, FormTypeChoices
from apps.system.models.tenant_workform import TenantWorkForm, WorkFormStatusChoices
from apps.system.models.tenant_choice_override import TenantChoiceOverride
from apps.system.models.tenant_field_definition import TenantFieldDefinition, FieldTypeChoices

__all__ = [
    'SystemChoiceList',
    'SystemChoiceItem',
    'SystemFieldSchema',
    'SystemConfiguration',
    'TenantConfig',
    'Product',
    'ProductCategoryChoices',
    'TenantProductPreference',
    'ConfigAuditLog',
    'TenantForm',
    'FormTypeChoices',
    'TenantWorkForm',
    'WorkFormStatusChoices',
    'TenantChoiceOverride',
    'TenantFieldDefinition',
    'FieldTypeChoices',
]
