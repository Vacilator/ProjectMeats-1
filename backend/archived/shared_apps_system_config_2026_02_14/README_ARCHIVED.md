# Archived: shared_apps/system_config

**Archive Date**: February 14, 2026  
**Reason**: Dead code - superseded by apps/system implementation  
**Phase**: WorkForms Enhancement Phase 2

## Context

This code was part of an experimental workflow engine implementation that has been superseded by the production `apps/system` implementation.

### Why Archived

1. **Not Used in Production**: The `WorkflowRun` model and execution engine were experimental and never deployed to production
2. **Superseded by apps/system**: All production workflow functionality is in `backend/apps/system/` with models:
   - `TenantForm` - Form definitions
   - `TenantWorkForm` - Workflow definitions  
   - `TenantConfig` - Tenant settings
3. **Unique Models Preserved**: The `WorkflowRun` model in this archive is NOT a duplicate - it was a different design approach that was ultimately not used

### What Was Archived

```
shared_apps/system_config/
├── __init__.py
├── admin.py
├── apps.py
├── engine.py              # Workflow execution engine (unused)
├── management/
├── migrations/
├── models.py              # WorkflowRun model (experimental)
├── serializers.py
├── tests/
├── urls.py
└── views.py
```

### Migration Notes

- **No data migration needed** - This app was never used in production
- **INSTALLED_APPS updated** - Removed 'shared_apps.system_config' from settings
- **No breaking changes** - All production code uses `apps.system`

### Restoration

If needed, this code can be restored by:
1. Copying back to `backend/shared_apps/system_config/`
2. Adding `'shared_apps.system_config'` to INSTALLED_APPS
3. Running migrations: `python manage.py migrate system_config`

However, restoration is **not recommended** as this represents an abandoned design pattern.

## Related Documentation

- Phase 2 Discovery Report: Discovery confirmed WorkflowRun is unique and not in production use
- Production Models: `backend/apps/system/models/`
- Architecture Decision: Shared-schema multi-tenancy with ForeignKey isolation

---

**Archived By**: Phase 2 Cleanup  
**Safe to Delete**: Yes (after 90 days retention period)
