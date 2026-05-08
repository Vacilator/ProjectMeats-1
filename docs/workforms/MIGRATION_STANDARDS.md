# Workforms Editor - Migration Standards

**Last Updated:** 2026-02-21
**Status:** 🔒 ENFORCED - All Changes Must Be Additive-Only

---

## 🚨 Golden Rule: ADDITIVE-ONLY Changes

**WHY THIS MATTERS:**
- ProjectMeats has 5+ months of production workflows
- Any breaking change risks data loss or execution failures
- Golden pipeline CI/CD requires backward compatibility
- Multi-tenancy means changes affect ALL tenants simultaneously

---

## ✅ ALLOWED Changes (Safe)

### 1. Add New Node Types
```typescript
// ✅ SAFE: Add to existing nodeTypes
export const newNodeType = {
  type: 'myNewNode',
  // ...
};

// Register alongside existing types
nodeTypes.myNewNode = MyNewNode;
```

### 2. Add New Schema Fields
```typescript
// ✅ SAFE: Add optional fields to schema
export const formNodeSchema = {
  // Existing fields...
  existingField: { type: 'string', required: true },

  // NEW field with default
  newOptionalField: {
    type: 'array',
    required: false,
    default: []
  }
};
```

### 3. Add New API Endpoints
```python
# ✅ SAFE: New ViewSet or endpoint
class NewFeatureViewSet(viewsets.ModelViewSet):
    queryset = NewModel.objects.all()
    # ...
```

### 4. Add New Database Fields
```python
# ✅ SAFE: New field with default or null=True
class TenantWorkflow(models.Model):
    # Existing fields...

    new_feature_flag = models.BooleanField(
        default=False,
        help_text="New feature (additive)"
    )
```

### 5. Extend Functionality
```typescript
// ✅ SAFE: Add new handlers without removing old ones
const handleNewFeature = useCallback(() => {
  // New logic
}, [deps]);

// Old handlers remain unchanged
```

---

## ❌ PROHIBITED Changes (Breaking)

### 1. Remove/Rename Node Types
```typescript
// ❌ BREAKING: Existing workflows use this node
// nodeTypes.formNode = undefined; // DON'T DO THIS!

// ✅ INSTEAD: Deprecate + alias
nodeTypes.formNodeLegacy = FormNode;
nodeTypes.formNode = ImprovedFormNode; // with backward compat
```

### 2. Remove Schema Fields
```typescript
// ❌ BREAKING: Workflows may have this field in data
export const schema = {
  // oldField: { type: 'string' }, // DON'T DELETE!
  newField: { type: 'string' }
};

// ✅ INSTEAD: Mark deprecated
export const schema = {
  oldField: {
    type: 'string',
    deprecated: true,
    fallbackTo: 'newField'
  }
};
```

### 3. Change Field Types Without Migration
```typescript
// ❌ BREAKING: Type change without migration
formFields: { type: 'array' } // was 'string'

// ✅ INSTEAD: Add migration logic
const migrateFormFields = (data) => {
  if (typeof data.formFields === 'string') {
    return { ...data, formFields: [data.formFields] };
  }
  return data;
};
```

### 4. Remove API Endpoints
```python
# ❌ BREAKING: Frontend may still call this
# class OldViewSet(viewsets.ModelViewSet): # DON'T DELETE!

# ✅ INSTEAD: Deprecate + redirect
class OldViewSet(viewsets.ModelViewSet):
    """DEPRECATED: Use NewViewSet instead"""
    def list(self, request):
        return redirect('new-endpoint')
```

### 5. Delete Database Fields
```python
# ❌ BREAKING: Data loss risk
# class TenantWorkflow(models.Model):
#     # old_field = models.CharField() # DON'T DELETE!

# ✅ INSTEAD: Mark as unused + hide from API
class TenantWorkflow(models.Model):
    old_field_unused = models.CharField(
        null=True,
        editable=False,
        help_text="DEPRECATED: Do not use"
    )
```

---

## 🔄 Safe Migration Patterns

### Pattern 1: Schema Evolution (Add Field)
```typescript
// Step 1: Add optional field
export const schema = {
  existingField: { type: 'string', required: true },
  newField: { type: 'array', required: false, default: [] }
};

// Step 2: Use migration helper
const migrateNodeData = (data: any) => {
  if (!data.newField) {
    return { ...data, newField: [] }; // Apply default
  }
  return data;
};

// Step 3: Apply on load
useEffect(() => {
  const migratedNodes = nodes.map(node => ({
    ...node,
    data: migrateNodeData(node.data)
  }));
  setNodes(migratedNodes);
}, []);
```

### Pattern 2: Node Type Evolution (Rename)
```typescript
// Step 1: Create new type
const ImprovedFormNode = (props) => {
  // Enhanced logic
  return <FormNode {...props} enhanced />; // Reuse existing
};

// Step 2: Register both (alias)
nodeTypes.formNode = ImprovedFormNode;
nodeTypes.formNodeLegacy = FormNode;

// Step 3: Migration function
const migrateNodeType = (type: string) => {
  const migrations = {
    'oldFormNode': 'formNode',
    'formNodeV1': 'formNode'
  };
  return migrations[type] || type;
};
```

### Pattern 3: API Evolution (Deprecate Endpoint)
```python
# Step 1: Create new endpoint
class EnhancedViewSet(viewsets.ModelViewSet):
    """New endpoint with improved features"""
    pass

# Step 2: Keep old endpoint with deprecation warning
class LegacyViewSet(viewsets.ModelViewSet):
    """DEPRECATED: Use /api/v2/enhanced/ instead"""

    def list(self, request, *args, **kwargs):
        warnings.warn("This endpoint is deprecated", DeprecationWarning)
        # Redirect or proxy to new endpoint
        return EnhancedViewSet().list(request, *args, **kwargs)

# Step 3: Document in API docs
urlpatterns = [
    path('api/v1/legacy/', LegacyViewSet.as_view(), name='legacy'),  # Keep for 6 months
    path('api/v2/enhanced/', EnhancedViewSet.as_view(), name='enhanced'),
]
```

### Pattern 4: Database Migration (Add Field)
```python
# migrations/0042_add_feature_flag.py
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('workflows', '0041_previous_migration'),
    ]

    operations = [
        migrations.AddField(
            model_name='tenantworkflow',
            name='new_feature_enabled',
            field=models.BooleanField(default=False),
        ),
    ]

# ✅ SAFE: Additive, with default, no data loss
```

---

## 🧪 Testing Requirements

### Before Merging ANY Workforms Change:

#### 1. Backward Compatibility Test
```bash
# Load old workflow JSON and verify it still works
npm run test:legacy-workflows
```

#### 2. Schema Validation Test
```typescript
// Ensure old data passes new schema
import { validateSchema } from './schemaValidator';

test('Legacy workflow data is valid', () => {
  const legacyData = loadLegacyWorkflow();
  expect(validateSchema(schema, legacyData)).toBe(true);
});
```

#### 3. Migration Test
```bash
# Verify migration doesn't lose data
python manage.py test apps/workflows/tests/test_migrations.py
```

#### 4. Integration Test
```bash
# Full end-to-end with old and new data
npm run test:e2e -- --spec=workforms-integration
```

---

## 📋 Migration Checklist

Before submitting PR for Workforms changes:

- [ ] **Additive-Only**: No deletions, only additions
- [ ] **Default Values**: All new fields have sensible defaults
- [ ] **Backward Compat**: Old workflows still load and execute
- [ ] **Migration Logic**: Data transformation helpers added
- [ ] **Tests Pass**: Legacy workflow tests pass
- [ ] **Docs Updated**: WORKFORMS_SESSION_STATE.md reflects changes
- [ ] **API Versioning**: Breaking API changes use new version (v2)
- [ ] **Database Migration**: Additive migration created if needed
- [ ] **Golden Pipeline**: CI checks pass (no breaking changes detected)
- [ ] **Deprecation Notice**: Old patterns marked deprecated with timeline

---

## 🚨 Emergency Rollback Plan

If a breaking change is accidentally deployed:

### Step 1: Immediate Rollback (Git)
```bash
# Revert the breaking commit
git revert <commit-sha>
git push upstream development

# Trigger redeployment
gh workflow run deploy-dev.yml
```

### Step 2: Database Rollback (If Needed)
```bash
# SSH to server
ssh user@dev.meatscentral.com

# Rollback migration
docker exec -it pm-backend python manage.py migrate workflows <previous-migration>
```

### Step 3: Data Recovery (If Data Lost)
```bash
# Restore from backup
pg_restore -d projectmeats_dev /backups/latest.dump
```

### Step 4: Communication
- Notify team in Slack #dev-alerts
- Update incident log
- Document root cause
- Add test to prevent recurrence

---

## 📚 Related Documentation

- **Golden Pipeline Standards**: `/docs/GOLDEN_STANDARD_ACHIEVEMENT.md`
- **PostgreSQL Migration Guide**: `/docs/POSTGRESQL_MIGRATION_GUIDE.md`
- **Workforms Development Playbook**: `/docs/workforms/WORKFORMS_DEVELOPMENT_PLAYBOOK.md`
- **Session State**: `/docs/workforms/WORKFORMS_SESSION_STATE.md`

---

## 🔒 Approval Process

**For Major Workforms Changes (Requires Review):**
- New node types (requires PM approval)
- Schema changes affecting >5 fields
- API endpoint changes
- Database model changes

**For Minor Changes (Self-Merge OK):**
- Bug fixes (no schema changes)
- Documentation updates
- UI improvements (no behavior changes)
- Performance optimizations

---

**Document Version:** 1.0
**Maintainer:** Infrastructure Team
**Review Date:** 2026-02-28 (1 week)
**Enforcement:** 🔒 MANDATORY - CI checks enforce additive-only
