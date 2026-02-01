"""
System app for ProjectMeats.

Provides centralized configuration management with 3-tier resolution:
1. System Core (superuser-defined defaults)
2. System Admin (system-wide overrides)
3. Tenant Admin (tenant-specific customizations)
"""
default_app_config = 'apps.system.apps.SystemConfig'
