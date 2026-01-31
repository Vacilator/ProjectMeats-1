# Admin Backend & Data Architecture Revamp Plan

**Document Version**: 1.0  
**Created**: 2026-01-31  
**Status**: 📋 PLANNING - Awaiting Implementation Approval  
**Priority**: HIGH  
**Estimated Duration**: 3-4 weeks

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Architectural Decisions](#architectural-decisions)
4. [Three-Tier Permission Hierarchy](#three-tier-permission-hierarchy)
5. [Unified Configuration System](#unified-configuration-system)
6. [Apps to Delete/Consolidate](#apps-to-deleteconsolidate)
7. [New Data Models](#new-data-models)
8. [API Design](#api-design)
9. [Admin UI Strategy](#admin-ui-strategy)
10. [Integration Points](#integration-points)
11. [Implementation Phases](#implementation-phases)
12. [Migration Runbook](#migration-runbook)
13. [Success Criteria](#success-criteria)
14. [Risks & Mitigations](#risks--mitigations)
15. [Related Documents](#related-documents)

---

## Executive Summary

A comprehensive revamp of the ProjectMeats admin backend and data architecture to create a **unified, hierarchical configuration system** that is:

- **INTUITIVE** - Zero learning curve, actions feel natural
- **SMART** - AI-assisted suggestions, auto-complete
- **SIMPLE** - Clean, uncluttered UI with progressive disclosure
- **EFFICIENT** - Minimal clicks, keyboard shortcuts
- **DYNAMIC** - Real-time updates, responsive to context
- **POWERFUL** - Deep functionality without complexity
- **IDEAL** - Optimized for meat broker workflows
- **EXTENSIBLE** - Plugin-ready for future enhancements

### Core Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM CORE TIER                          │
│              (Superadmin/Superuser ONLY)                     │
│  Django internals, tenant model, feature flags, auth        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      SYSTEM TIER                             │
│           (System Admins - affects ALL tenants)              │
│  Proteins, statuses, contact types, base field schemas      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      TENANT TIER                             │
│          (Tenant Admins - affects THEIR tenant)              │
│  Custom lists, field overrides, form flows, preferences     │
└─────────────────────────────────────────────────────────────┘
```

---

## Problem Statement

### Current Issues

1. **Fragmented Configuration**
   - `schema_builder` app: 0 records, abandoned
   - `system_config` app: 1 record, underutilized
   - `TenantList` in workflows: Partially implemented
   - TextChoices scattered across 20+ models
   - No unified way to manage dropdown options

2. **Permission Confusion**
   - No clear distinction between system-level and tenant-level config
   - Global admins can accidentally modify tenant data
   - Tenant admins can't customize their experience

3. **Admin UX Problems**
   - Django admin is functional but dated
   - React admin-studio is half-built
   - No visual form builder for choice lists
   - No way for tenants to customize dropdowns

4. **Data Duplication**
   - Same protein types seeded per tenant
   - Same product categories repeated
   - No inheritance from system defaults

### Desired State

- **Single source of truth** for all configuration
- **Clear permission boundaries** between tiers
- **Intuitive visual editors** for both Django and React
- **Inheritance model**: System → Root Tenant → Tenant
- **Audit trail** for all configuration changes

---

## Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Permission Model** | 3-tier hierarchy | Balances security with flexibility |
| **Admin UI** | Both Django + React | Gradual migration, no disruption |
| **Data Migration** | Fresh start | Old apps have 0-1 records, not worth preserving |
| **Root Tenant** | UUID `00000000-...` | Single source for system defaults |
| **Config Storage** | JSONField in models | Flexible schema, no migrations for new fields |
| **Override Strategy** | Extend/Replace/Prepend modes | Covers all customization patterns |

---

## Three-Tier Permission Hierarchy

### Tier 1: System Core (🔒 Superuser Only)

**Access**: Django `is_superuser=True` flag

**Entities**:
| Entity | Reason |
|--------|--------|
| `contenttypes.ContentType` | Django internal |
| `auth.Permission` | Security-critical |
| `auth.Group` | Permission management |
| `authtoken.Token` | API authentication |
| `sessions.Session` | User sessions |
| `tenants.Tenant` | Tenant model itself |
| `tenants.TenantDomain` | Domain routing |
| Feature Flags | System behavior |
| Webhook Configs | External integrations |
| API Rate Limits | Security controls |

**UI**: Hidden from non-superusers, collapsed by default

### Tier 2: System (📋 System Admins)

**Access**: `is_superuser=True` OR `groups__name='Global System Admins'`

**Entities**:
| Entity | Description | Tenant Impact |
|--------|-------------|---------------|
| `SystemChoiceList` | Dropdown option lists | Propagates to ALL |
| `SystemChoiceItem` | Items in lists | Propagates to ALL |
| `SystemFieldSchema` | Base field definitions | Propagates to ALL |
| `core.Protein` | Protein types | Shared across tenants |
| Order Statuses | Draft, Pending, etc. | Shared across tenants |
| Invoice Statuses | Sent, Paid, etc. | Shared across tenants |
| Contact Types | Sales, Billing, etc. | Shared across tenants |

**UI**: Accessible via "System Configuration" admin section

### Tier 3: Tenant (🏠 Tenant Admins)

**Access**: `TenantUser.role IN ('owner', 'admin')` for their tenant

**Entities**:
| Entity | Description | Scope |
|--------|-------------|-------|
| `TenantConfig` | Per-tenant overrides | This tenant only |
| Custom Lists | Tenant-specific dropdowns | This tenant only |
| Field Overrides | Additional fields on entities | This tenant only |
| Form Flows | `TenantForm`, `TenantWorkflow` | This tenant only |
| Layouts | Dashboard, quick actions | This tenant only |

**UI**: Accessible via "Tenant Settings" section (filtered to their tenant)

---

## Unified Configuration System

### Configuration Resolution Flow

```
Request comes in for "protein_type" choices
                │
                ▼
┌─────────────────────────────────────────┐
│  1. Load SystemChoiceList('protein_type') │
│     Base choices: [Beef, Pork, Chicken...]│
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  2. Check TenantConfig for override      │
│     mode: 'extend' | 'replace' | 'prepend'│
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  3. Apply override rules                 │
│     extend: base + tenant items          │
│     replace: tenant items only           │
│     prepend: tenant items + base         │
└─────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────┐
│  4. Return effective choices             │
│     Cached for performance               │
└─────────────────────────────────────────┘
```

### Override Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `extend` | Add tenant items after system items | "I want all proteins plus 'Exotic Meats'" |
| `prepend` | Add tenant items before system items | "Show my favorites first" |
| `replace` | Use only tenant items | "We only deal in Beef and Pork" |
| `filter` | Remove specific system items | "Hide 'Seafood' option" |

### Inheritance Rules

| System Config | Tenant Behavior |
|---------------|-----------------|
| `is_locked=True` | Cannot override at all |
| `allow_tenant_extend=True` | Can add items |
| `allow_tenant_override=True` | Can replace entirely |
| `allow_tenant_extend=False` | Read-only for tenants |

---

## Apps to Delete/Consolidate

### Apps to DELETE

| App | Records | Status | Action |
|-----|---------|--------|--------|
| `schema_builder` | 0 | Abandoned | **DELETE entirely** |
| `system_config` | 1 EntityBlueprint | Superseded | **DELETE, merge concepts** |
| `accounts_receivables` | 0 | Never used | **DELETE entirely** |

### Models to CONSOLIDATE

| Current Model | Current Location | New Location | Notes |
|---------------|------------------|--------------|-------|
| `TenantList` | `workflows` | `TenantConfig` | Store as config_type='custom_list' |
| `TenantFieldChoiceOverride` | `schema_builder` | `TenantConfig` | Store as config_type='choice_override' |
| `FieldOptionList` | `schema_builder` | `SystemChoiceList` | Promote to system-level |
| `EntityBlueprint` | `system_config` | `SystemFieldSchema` | Simplified model |
| `BlueprintVersion` | `system_config` | Version field on schema | No separate table |

---

## New Data Models

### apps/core/models.py

```python
from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class SystemChoiceList(models.Model):
    """
    Centralized choice/option lists for the entire system.
    Changes propagate to all tenants unless overridden.
    
    Examples: protein_type, order_status, contact_type, grade
    """
    class Tier(models.TextChoices):
        SYSTEM_CORE = 'system_core', 'System Core (Superuser only)'
        SYSTEM = 'system', 'System (System Admins)'
    
    # Identity
    name = models.CharField(max_length=100, help_text="Display name")
    slug = models.SlugField(unique=True, help_text="API identifier (e.g., protein_type)")
    description = models.TextField(blank=True)
    
    # Access Control
    tier = models.CharField(max_length=20, choices=Tier.choices, default=Tier.SYSTEM)
    is_locked = models.BooleanField(default=False, help_text="Prevent ALL modifications")
    
    # Tenant Customization Rules
    allow_tenant_extend = models.BooleanField(
        default=True, 
        help_text="Can tenants ADD items to this list?"
    )
    allow_tenant_override = models.BooleanField(
        default=False, 
        help_text="Can tenants REPLACE this list entirely?"
    )
    
    # Metadata
    icon = models.CharField(max_length=50, blank=True, help_text="Emoji or icon class")
    color = models.CharField(max_length=20, blank=True, help_text="Hex color for UI")
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, 
        related_name='created_choice_lists'
    )
    
    class Meta:
        ordering = ['name']
        verbose_name = 'System Choice List'
        verbose_name_plural = 'System Choice Lists'
    
    def __str__(self):
        return f"{self.name} ({self.slug})"
    
    @property
    def item_count(self):
        return self.items.filter(is_active=True).count()


class SystemChoiceItem(models.Model):
    """
    Individual items within a SystemChoiceList.
    Ordered, with optional metadata for UI customization.
    """
    choice_list = models.ForeignKey(
        SystemChoiceList, on_delete=models.CASCADE, related_name='items'
    )
    
    # Core Fields
    value = models.CharField(max_length=100, help_text="Stored value (e.g., 'beef')")
    label = models.CharField(max_length=200, help_text="Display label (e.g., 'Beef')")
    
    # Ordering & State
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False, help_text="Pre-selected option")
    
    # Optional Metadata
    description = models.CharField(max_length=500, blank=True)
    icon = models.CharField(max_length=50, blank=True)
    color = models.CharField(max_length=20, blank=True)
    metadata = models.JSONField(default=dict, blank=True, help_text="Extra data")
    
    class Meta:
        ordering = ['order', 'label']
        unique_together = [['choice_list', 'value']]
        verbose_name = 'Choice Item'
        verbose_name_plural = 'Choice Items'
    
    def __str__(self):
        return f"{self.label} ({self.value})"


class SystemFieldSchema(models.Model):
    """
    Defines base fields for each entity type.
    Tenants can ADD custom fields but cannot remove system fields.
    """
    entity_type = models.CharField(
        max_length=50, unique=True,
        help_text="Entity identifier (e.g., 'supplier', 'customer')"
    )
    display_name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    
    # Schema Definition (JSON array of field definitions)
    base_fields = models.JSONField(
        default=list,
        help_text="Array of field definitions with key, label, type, required, etc."
    )
    
    # Versioning
    version = models.PositiveIntegerField(default=1)
    is_published = models.BooleanField(default=False)
    published_at = models.DateTimeField(null=True, blank=True)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        verbose_name = 'System Field Schema'
        verbose_name_plural = 'System Field Schemas'
    
    def __str__(self):
        return f"{self.display_name} v{self.version}"


class TenantConfig(TenantAwareModel):
    """
    Stores tenant-specific configuration and overrides.
    Unified model for all types of tenant customization.
    """
    class ConfigType(models.TextChoices):
        CHOICE_OVERRIDE = 'choice_override', 'Choice List Override'
        CUSTOM_FIELDS = 'custom_fields', 'Custom Fields'
        CUSTOM_LIST = 'custom_list', 'Custom List (tenant-only)'
        LAYOUT = 'layout', 'UI Layout'
        PREFERENCES = 'preferences', 'Preferences'
    
    # Identity
    config_type = models.CharField(max_length=30, choices=ConfigType.choices)
    config_key = models.CharField(
        max_length=100,
        help_text="Key like 'protein_type' or 'supplier_fields'"
    )
    name = models.CharField(max_length=200, blank=True, help_text="Display name")
    
    # Configuration Data
    config_data = models.JSONField(
        default=dict,
        help_text="Configuration payload (items, mode, fields, etc.)"
    )
    
    # State
    is_active = models.BooleanField(default=True)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='created_tenant_configs'
    )
    
    class Meta:
        unique_together = [['tenant', 'config_type', 'config_key']]
        verbose_name = 'Tenant Configuration'
        verbose_name_plural = 'Tenant Configurations'
    
    def __str__(self):
        return f"{self.tenant.name}: {self.config_type}/{self.config_key}"
```

### apps/core/services/config_resolver.py

```python
from django.core.cache import cache
from typing import List, Dict, Any, Optional
from ..models import SystemChoiceList, TenantConfig


class ConfigResolver:
    """
    Resolves effective configuration by merging:
    1. System defaults (SystemChoiceList, SystemFieldSchema)
    2. Tenant overrides (TenantConfig)
    
    Results are cached for performance.
    """
    
    CACHE_TTL = 300  # 5 minutes
    
    @classmethod
    def get_choices(
        cls, 
        choice_slug: str, 
        tenant: 'Tenant',
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get effective choice list for a tenant.
        
        Returns: [{'value': 'beef', 'label': 'Beef', ...}, ...]
        """
        cache_key = f"choices:{choice_slug}:{tenant.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        
        # 1. Get system choices
        try:
            system_list = SystemChoiceList.objects.get(slug=choice_slug)
            items_qs = system_list.items.all()
            if not include_inactive:
                items_qs = items_qs.filter(is_active=True)
            base_choices = list(items_qs.values(
                'value', 'label', 'order', 'icon', 'color', 'is_default', 'metadata'
            ))
        except SystemChoiceList.DoesNotExist:
            base_choices = []
            system_list = None
        
        # 2. Check tenant override
        override = TenantConfig.objects.filter(
            tenant=tenant,
            config_type='choice_override',
            config_key=choice_slug,
            is_active=True
        ).first()
        
        if not override or not system_list:
            result = base_choices
        else:
            mode = override.config_data.get('mode', 'extend')
            tenant_items = override.config_data.get('items', [])
            
            if mode == 'replace' and system_list.allow_tenant_override:
                result = tenant_items
            elif mode == 'extend' and system_list.allow_tenant_extend:
                result = base_choices + tenant_items
            elif mode == 'prepend' and system_list.allow_tenant_extend:
                result = tenant_items + base_choices
            elif mode == 'filter':
                # Remove specified values
                filter_values = set(override.config_data.get('exclude', []))
                result = [c for c in base_choices if c['value'] not in filter_values]
            else:
                result = base_choices
        
        cache.set(cache_key, result, cls.CACHE_TTL)
        return result
    
    @classmethod
    def get_entity_fields(
        cls, 
        entity_type: str, 
        tenant: 'Tenant'
    ) -> List[Dict[str, Any]]:
        """
        Get effective field schema for an entity type.
        Base fields + tenant custom fields.
        """
        cache_key = f"fields:{entity_type}:{tenant.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return cached
        
        # 1. Get system base fields
        try:
            from ..models import SystemFieldSchema
            schema = SystemFieldSchema.objects.get(
                entity_type=entity_type, 
                is_published=True
            )
            base_fields = schema.base_fields or []
        except SystemFieldSchema.DoesNotExist:
            base_fields = []
        
        # 2. Get tenant custom fields
        custom = TenantConfig.objects.filter(
            tenant=tenant,
            config_type='custom_fields',
            config_key=entity_type,
            is_active=True
        ).first()
        
        if custom:
            custom_fields = custom.config_data.get('fields', [])
            # Mark custom fields
            for field in custom_fields:
                field['is_custom'] = True
            result = base_fields + custom_fields
        else:
            result = base_fields
        
        cache.set(cache_key, result, cls.CACHE_TTL)
        return result
    
    @classmethod
    def invalidate_cache(cls, choice_slug: str = None, tenant_id: str = None):
        """Invalidate config cache. Call after any config change."""
        if choice_slug and tenant_id:
            cache.delete(f"choices:{choice_slug}:{tenant_id}")
        elif choice_slug:
            # Invalidate for all tenants (system-level change)
            cache.delete_pattern(f"choices:{choice_slug}:*")
        elif tenant_id:
            # Invalidate all for this tenant
            cache.delete_pattern(f"choices:*:{tenant_id}")
            cache.delete_pattern(f"fields:*:{tenant_id}")
```

---

## API Design

### System Config Endpoints (System Admins)

```
BASE: /api/v1/config/

# Choice Lists
GET    /choices/                     # List all system choice lists
POST   /choices/                     # Create new list (System Admin)
GET    /choices/{slug}/              # Get list with items
PATCH  /choices/{slug}/              # Update list metadata
DELETE /choices/{slug}/              # Delete list (if not locked)

# Choice Items (nested)
POST   /choices/{slug}/items/        # Add item to list
PATCH  /choices/{slug}/items/{id}/   # Update item
DELETE /choices/{slug}/items/{id}/   # Delete item
POST   /choices/{slug}/reorder/      # Bulk reorder items

# Entity Schemas
GET    /schemas/                     # List all entity schemas
GET    /schemas/{entity_type}/       # Get schema
PATCH  /schemas/{entity_type}/       # Update schema (draft)
POST   /schemas/{entity_type}/publish/  # Publish schema

# Bulk Operations
POST   /choices/import/              # Import from JSON/CSV
GET    /choices/export/              # Export all to JSON
```

### Tenant Config Endpoints (Tenant Admins)

```
BASE: /api/v1/tenant/config/

# Effective Config (resolved, read-only)
GET    /effective/choices/{slug}/    # Get effective choices for this tenant
GET    /effective/fields/{entity}/   # Get effective fields for this tenant

# Tenant Overrides
GET    /overrides/                   # List this tenant's overrides
POST   /overrides/                   # Create override
GET    /overrides/{id}/              # Get override
PATCH  /overrides/{id}/              # Update override
DELETE /overrides/{id}/              # Delete override

# Custom Lists (tenant-only, no system base)
GET    /lists/                       # List tenant's custom lists
POST   /lists/                       # Create custom list
# ... standard CRUD
```

### Permission Classes

```python
from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsSystemAdmin(BasePermission):
    """System Admins or Superusers can access system config."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        return request.user.groups.filter(name='Global System Admins').exists()


class IsSystemCore(BasePermission):
    """Only Superusers can access system core."""
    
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.is_superuser


class IsTenantAdmin(BasePermission):
    """Tenant Owner or Admin for the current tenant."""
    
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        
        tenant = getattr(request, 'tenant', None)
        if not tenant:
            return False
        
        from apps.tenants.models import TenantUser
        return TenantUser.objects.filter(
            user=request.user,
            tenant=tenant,
            role__in=['owner', 'admin']
        ).exists()
```

---

## Admin UI Strategy

### Django Admin Structure

```
📦 SYSTEM CORE (collapsed, superuser only)
├── Content Types
├── Permissions  
├── Groups
├── Tokens
└── Sessions

⚙️ SYSTEM CONFIGURATION
├── Choice Lists          ← SystemChoiceList + inline items
├── Entity Schemas        ← SystemFieldSchema
└── System Settings       ← Feature flags (future)

🏢 TENANT MANAGEMENT
├── Tenants
├── Tenant Users
├── Tenant Domains
└── Tenant Invitations

🎨 TENANT CONFIGURATION (filtered to user's tenant)
├── Custom Lists
├── Choice Overrides
├── Custom Fields
└── Layout Preferences

📋 FORMS & WORKFLOWS
├── Forms                 ← TenantForm
├── Form Submissions
├── Workflows
└── Workflow Logs
```

### Django Admin Features

1. **SystemChoiceListAdmin**
   - Inline editing of items (TabularInline)
   - Drag-drop reordering via Sortable.js
   - Import/Export buttons
   - Preview panel showing choices
   - Permission checks for tier

2. **TenantConfigAdmin**
   - Filtered to current tenant
   - Type-specific forms (choice_override vs custom_list)
   - Live preview of effective config
   - Audit log display

### React Admin Studio

```
/admin-studio/
├── /config                    # ConfigDashboard
│   ├── /choices               # ChoiceListIndex
│   │   └── /:slug             # ChoiceListEditor
│   ├── /schemas               # SchemaIndex
│   │   └── /:entityType       # SchemaEditor (existing, enhanced)
│   └── /tenant                # TenantConfigEditor
├── /forms                     # Form builder (existing)
└── /workflows                 # Workflow designer (existing)
```

---

## Integration Points

### 1. Form Builder Integration

```typescript
// When rendering a field with choice_list config
const options = await configService.getEffectiveChoices(
  field.choice_list,  // e.g., 'protein_type'
  tenant.id
);
```

### 2. FormSubmissionModal Integration

```typescript
// Replace current choicesService usage
import { configService } from '@/services/configService';

const loadFieldOptions = async (field: FieldConfig) => {
  if (field.choice_list) {
    return configService.getChoices(field.choice_list);
  }
  if (field.entity_reference) {
    return entityOptionsService.getOptions(field.entity_reference);
  }
  return field.options || [];
};
```

### 3. Cockpit Integration

The Cockpit Command Center (FORMS_FLOWS_ENHANCEMENT_PLAN.md) will:
- Use ConfigResolver for all dropdown widgets
- Show "System Config" quick link for admins
- Display tenant customization status

### 4. Entity Persistence Integration

The EntityPersistenceService (just merged in PR #2196) will:
- Validate against SystemFieldSchema
- Store custom field data in `custom_data` JSONField
- Respect tenant-specific field definitions

---

## Implementation Phases

### Phase 1: Foundation (Days 1-4)

- [ ] **1.1** Create new models in `apps/core/models/`
  - `SystemChoiceList`
  - `SystemChoiceItem`
  - `SystemFieldSchema`
  - `TenantConfig`
- [ ] **1.2** Create migrations
- [ ] **1.3** Create `ConfigResolver` service
- [ ] **1.4** Create `seed_system_choices` management command
- [ ] **1.5** Seed initial data:
  - `protein_type`: Beef, Pork, Chicken, Turkey, Lamb, Seafood, Other
  - `fresh_or_frozen`: Fresh, Frozen, Either
  - `order_status`: Draft, Pending, Confirmed, In Transit, Delivered, Cancelled
  - `invoice_status`: Draft, Sent, Paid, Overdue, Cancelled
  - `contact_type`: Sales, Purchasing, Billing, Shipping, General
  - `payment_method`: Wire, Check, ACH, Credit Card
  - `grade`: Prime, Choice, Select, Standard
  - `pack_style`: Bulk, Case Ready, Vacuum Packed
- [ ] **1.6** Create API ViewSets with permissions

### Phase 2: Django Admin UI (Days 5-8)

- [ ] **2.1** Create `SystemChoiceListAdmin` with inline items
- [ ] **2.2** Create custom `change_form.html` with:
  - Alpine.js for reactivity
  - Sortable.js for drag-drop
  - Live preview panel
- [ ] **2.3** Add import/export functionality
- [ ] **2.4** Create `TenantConfigAdmin` (filtered by tenant)
- [ ] **2.5** Add tier-based permission checks
- [ ] **2.6** Style improvements (icons, colors, better layout)

### Phase 3: Delete Old Apps (Day 9)

- [ ] **3.1** Export any needed data (backup)
- [ ] **3.2** Remove `schema_builder` from INSTALLED_APPS
- [ ] **3.3** Remove `system_config` from INSTALLED_APPS
- [ ] **3.4** Remove `accounts_receivables` from INSTALLED_APPS
- [ ] **3.5** Delete app folders
- [ ] **3.6** Remove related URLs, imports
- [ ] **3.7** Clean up frontend references
- [ ] **3.8** Run migrations to drop tables

### Phase 4: React Admin Studio (Days 10-14)

- [ ] **4.1** Create `ConfigDashboard` page
- [ ] **4.2** Create `ChoiceListEditor` component
  - List view with search/filter
  - Edit view with inline item management
  - Drag-drop reordering
  - Import/export buttons
- [ ] **4.3** Enhance `SchemaEditor` for new model
- [ ] **4.4** Create `TenantConfigEditor`
  - Override mode selector
  - Preview of effective config
- [ ] **4.5** Add navigation and routing
- [ ] **4.6** Add keyboard shortcuts

### Phase 5: Integration (Days 15-17)

- [ ] **5.1** Create `configService.ts` in frontend
- [ ] **5.2** Update `FormSubmissionModal` to use ConfigResolver
- [ ] **5.3** Update `choicesService` to use new API (backward compat)
- [ ] **5.4** Update form builder to reference choice lists
- [ ] **5.5** Test all dropdown fields across app
- [ ] **5.6** Update EntityPersistenceService for custom fields

### Phase 6: Testing & Polish (Days 18-21)

- [ ] **6.1** Unit tests for ConfigResolver
- [ ] **6.2** Permission tests (tier enforcement)
- [ ] **6.3** API integration tests
- [ ] **6.4** End-to-end tests
- [ ] **6.5** Performance testing (caching)
- [ ] **6.6** Documentation update
- [ ] **6.7** Migration runbook for production

---

## Migration Runbook

### Pre-Migration (Production)

```bash
# 1. Full database backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql

# 2. Export any existing data
python manage.py dumpdata core.Protein --output=proteins_backup.json
python manage.py dumpdata workflows.TenantList --output=tenant_lists_backup.json
```

### Migration Steps

```bash
# 3. Apply new migrations
python manage.py migrate core

# 4. Seed system choices (idempotent)
python manage.py seed_system_choices

# 5. Remove old apps (after verifying new system works)
# Edit settings/base.py: remove schema_builder, system_config, accounts_receivables
python manage.py migrate schema_builder zero --fake
python manage.py migrate system_config zero --fake
python manage.py migrate accounts_receivables zero --fake

# 6. Verify
python manage.py check
python manage.py showmigrations
```

### Rollback Plan

```bash
# If issues occur:
# 1. Restore INSTALLED_APPS
# 2. Restore database from backup
pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME backup_YYYYMMDD.sql
```

---

## Success Criteria

### Functional Requirements

| Requirement | Acceptance Test |
|-------------|-----------------|
| System Admins can CRUD choice lists | Create "test_list", add items, verify in DB |
| Superusers can access system core | Login as superuser, see collapsed section |
| Tenant Admins can create overrides | Create override, verify isolated to tenant |
| Changes propagate correctly | Edit system list, verify all tenants see change |
| Tenant overrides are isolated | Edit tenant config, verify other tenants unaffected |
| Form builder uses new system | Create form, select choice list, verify options load |
| Caching works | Make request, verify cache hit on second request |

### Non-Functional Requirements

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Admin UI response time | < 2 seconds | Lighthouse audit |
| API response time | < 200ms | Load testing |
| Cache hit rate | > 90% | Monitoring |
| Zero data loss | 100% | Pre/post record counts |
| Backward compatibility | No broken forms | E2E tests |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking existing forms | Medium | High | Feature flag, gradual rollout |
| Data loss during deletion | Low | High | Full backup before any deletion |
| Permission confusion | Medium | Medium | Clear UI labels, documentation |
| Performance regression | Low | Medium | Caching layer, load testing |
| Scope creep | High | Medium | Strict phase boundaries |
| Frontend/backend mismatch | Medium | Medium | API contract tests |

---

## Related Documents

| Document | Relationship |
|----------|--------------|
| `DATA_ENTITY_RESTRUCTURING_PLAN.md` | Parent plan - app cleanup |
| `FORMS_FLOWS_ENHANCEMENT_PLAN.md` | Consumer - Cockpit uses config |
| `GLOBAL_CONFIG_ARCHITECTURE.md` | Reference - existing architecture |
| `ROADMAP.md` | Context - overall project direction |

---

## Appendix A: System Choice Lists Reference

| Slug | Name | Items | Tenant Rules |
|------|------|-------|--------------|
| `protein_type` | Protein Types | Beef, Pork, Chicken, Turkey, Lamb, Seafood, Other | extend=✓, override=✗ |
| `fresh_or_frozen` | Fresh/Frozen | Fresh, Frozen, Either | extend=✗, override=✗ |
| `order_status` | Order Status | Draft, Pending, Confirmed, In Transit, Delivered, Cancelled | extend=✓, override=✗ |
| `invoice_status` | Invoice Status | Draft, Sent, Paid, Overdue, Cancelled | extend=✓, override=✗ |
| `contact_type` | Contact Type | Sales, Purchasing, Billing, Shipping, General | extend=✓, override=✓ |
| `payment_method` | Payment Method | Wire, Check, ACH, Credit Card | extend=✓, override=✓ |
| `grade` | USDA Grade | Prime, Choice, Select, Standard | extend=✓, override=✗ |
| `pack_style` | Pack Style | Bulk, Case Ready, Vacuum Packed | extend=✓, override=✓ |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-31 | Copilot | Initial comprehensive plan |

---

*Last Updated: 2026-01-31*
