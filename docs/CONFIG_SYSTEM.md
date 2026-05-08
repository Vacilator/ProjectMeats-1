# Config System Documentation

**Status**: ✅ IMPLEMENTED
**Category**: Backend & Frontend
**Version**: v2.0
**Last Updated**: 2026-02-03

---

## Overview

ProjectMeats uses a **3-tier configuration system** that enables dynamic, customizable settings without code changes:

```
┌─────────────────────────────────────────────────────────────────┐
│                         TIER 1: SYSTEM                          │
│  Global defaults defined by platform (applies to all tenants)   │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (inherits)
┌─────────────────────────────────────────────────────────────────┐
│                         TIER 2: TENANT                          │
│  Tenant-specific overrides (customizations per organization)    │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (inherits)
┌─────────────────────────────────────────────────────────────────┐
│                         TIER 3: USER                            │
│  User-level preferences (personal settings) [Future]           │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend Components

### Models (`apps/system/models/`)

#### SystemChoiceList
Defines dropdown/select field options at the system level.

```python
from apps.system.models import SystemChoiceList

# Example: Get protein types list
protein_list = SystemChoiceList.objects.get(slug='protein_type')
```

| Field | Type | Description |
|-------|------|-------------|
| `slug` | CharField | Unique identifier (e.g., `protein_type`) |
| `name` | CharField | Human-readable name |
| `description` | TextField | Optional description |
| `is_extensible` | BooleanField | Can tenants add custom items? |
| `is_reorderable` | BooleanField | Can items be reordered? |
| `model_field_path` | CharField | Django field path (optional) |

#### SystemChoiceItem
Individual items within a choice list.

```python
from apps.system.models import SystemChoiceItem

# Get active items for a list
items = SystemChoiceItem.objects.filter(
    choice_list__slug='protein_type',
    is_active=True,
    tenant__isnull=True  # System items only
).order_by('order')
```

| Field | Type | Description |
|-------|------|-------------|
| `choice_list` | ForeignKey | Parent SystemChoiceList |
| `value` | CharField | Value stored in database |
| `label` | CharField | Display label |
| `order` | IntegerField | Sort order |
| `is_default` | BooleanField | Default selection |
| `is_active` | BooleanField | Visible in dropdowns |
| `tenant` | ForeignKey | NULL = system, non-NULL = tenant custom |
| `extra_data` | JSONField | Additional metadata |

#### SystemFieldSchema
Field-level configuration and validation rules.

```python
from apps.system.models import SystemFieldSchema

schema = SystemFieldSchema.objects.get(field_path='products.product.protein_type')
```

| Field | Type | Description |
|-------|------|-------------|
| `field_path` | CharField | Dot-notation path (e.g., `products.product.protein_type`) |
| `field_type` | CharField | Field type (TEXT, SELECT, NUMBER, etc.) |
| `label` | CharField | Display label |
| `help_text` | TextField | Help text for users |
| `placeholder` | CharField | Input placeholder |
| `is_required` | BooleanField | Required field |
| `is_readonly` | BooleanField | Read-only field |
| `is_hidden` | BooleanField | Hidden field |
| `default_value` | JSONField | Default value |
| `validation_rules` | JSONField | Validation rules |
| `choice_list` | ForeignKey | Associated choice list |

#### TenantConfig
Tenant-specific configuration overrides.

```python
from apps.system.models import TenantConfig

# Get tenant's theme color
config = TenantConfig.objects.get(
    tenant=tenant,
    key='ui.theme.primary_color'
)
```

| Field | Type | Description |
|-------|------|-------------|
| `tenant` | ForeignKey | Tenant this config belongs to |
| `key` | CharField | Config key (dot-notation) |
| `value` | JSONField | Config value |
| `category` | CharField | UI, BUSINESS, FEATURES, etc. |
| `description` | TextField | Human-readable description |
| `updated_by` | ForeignKey | User who last updated |

---

### ConfigResolver Service

The `ConfigResolver` provides cascading configuration lookup:

```python
from apps.system.services.config_resolver import ConfigResolver, get_config, get_choices

# Initialize with tenant context
resolver = ConfigResolver(tenant=request.tenant)

# Get config value with cascading resolution
theme_color = resolver.get('ui.theme.primary_color', default='#667eea')

# Get choices for a dropdown
protein_choices = resolver.get_choices('protein_type')
# Returns: [{'value': 'BEEF', 'label': 'Beef', 'is_default': True, ...}, ...]

# Get field schema
schema = resolver.get_field_schema('products.product.protein_type')

# Convenience functions
theme = get_config('ui.theme.primary_color', tenant=request.tenant)
proteins = get_choices('protein_type', tenant=request.tenant)
```

#### Resolution Priority

1. **Tenant-specific TenantConfig** (highest priority)
2. **SystemFieldSchema default**
3. **Code-defined default** (lowest priority)

#### Caching

- System-level configs: 5 minutes TTL
- Tenant-level configs: 1 minute TTL
- Cache invalidated on model save

---

### API Endpoints

All endpoints are under `/api/v1/system/`:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/choice-lists/` | GET | List all choice lists |
| `/choice-lists/{slug}/` | GET | Get choice list details |
| `/choice-lists/{slug}/items/` | GET | Get items for list |
| `/choice-lists/{slug}/items/` | POST | Add tenant custom item |
| `/choice-lists/{slug}/reorder/` | POST | Reorder items |
| `/choice-items/` | GET/POST | CRUD for choice items |
| `/choice-items/{id}/` | GET/PUT/DELETE | Single item operations |
| `/field-schemas/` | GET/POST | CRUD for field schemas |
| `/tenant-configs/` | GET/POST | CRUD for tenant configs |
| `/tenant-configs/by_category/` | GET | Configs grouped by category |
| `/config/resolve/` | GET | Resolve config value |
| `/config/choices/{slug}/` | GET | Get choices for slug |
| `/config/field-schema/{path}/` | GET | Get field schema |

---

## Frontend Components

### configService (`services/configService.ts`)

Main service for configuration access:

```typescript
import { configService } from '../services/configService';

// Get all choice lists
const lists = await configService.getChoiceLists();

// Get choices for a dropdown
const proteins = await configService.getChoiceOptions('protein_type');
// Returns: [{value: 'BEEF', label: 'Beef'}, ...]

// Resolve a config value
const resolved = await configService.resolveConfig<string>(
  'ui.theme.primary_color',
  '#667eea'
);
console.log(resolved.value);  // '#667eea' or tenant override

// Check feature flag
const aiEnabled = await configService.isFeatureEnabled('ai_assistant.enabled');

// Preload config data
await configService.preloadConfig();
```

### choicesService (`services/choicesService.ts`)

Wrapper service with fallback to legacy choices:

```typescript
import { choicesService } from '../services/choicesService';

// Get choices for a field (auto-resolves v2 or legacy)
const options = await choicesService.getChoicesForField('protein_type');

// Check if field uses static choices
if (choicesService.isStaticChoiceField('protein_type')) {
  // Load from config system
}

// Preload all choices
await choicesService.preloadChoices();
```

---

## Seeded Choice Lists

The following choice lists are seeded by `python manage.py seed_system_choices`:

| Slug | Name | Items |
|------|------|-------|
| `protein_type` | Protein Type | BEEF, PORK, POULTRY, SEAFOOD, LAMB, OTHER |
| `fresh_or_frozen` | Fresh or Frozen | FRESH, FROZEN |
| `package_type` | Package Type | COMBO_BIN, CASES, BAGS, BULK, VACUUM_SEALED, OTHER |
| `payment_terms` | Payment Terms | NET7, NET10, NET15, NET30, NET45, NET60, NET90, COD, PREPAID |
| `credit_limit` | Credit Limit | $0, $5K, $10K, $25K, $50K, $100K, UNLIMITED |
| `weight_unit` | Weight Unit | LBS, KG, OZ, G |
| `contact_type` | Contact Type | PRIMARY, SALES, ACCOUNTING, SHIPPING, RECEIVING, TECHNICAL, OTHER |
| `plant_type` | Plant Type | SLAUGHTER, PROCESSING, COLD_STORAGE, DISTRIBUTION, COMBINED |
| `certificate_type` | Certificate Type | USDA, FDA, ORGANIC, HALAL, KOSHER, NON_GMO, OTHER |
| `country_origin` | Country of Origin | USA, CAN, MEX, AUS, NZL, BRA, ARG, OTHER |
| `shipping_offered` | Shipping Offered | FOB, DELIVERED, PICKUP, FOB_AND_DELIVERED |
| `edible_inedible` | Edible/Inedible | EDIBLE, INEDIBLE |
| `po_status` | Purchase Order Status | DRAFT, PENDING, APPROVED, SENT, CONFIRMED, IN_TRANSIT, RECEIVED, INVOICED, PAID, CANCELLED |
| `so_status` | Sales Order Status | DRAFT, PENDING, APPROVED, CONFIRMED, PICKING, SHIPPED, DELIVERED, INVOICED, PAID, CANCELLED |

---

## Adding Custom Items (Tenant Admin)

Tenant admins can add custom items to extensible choice lists:

### Via API

```bash
POST /api/v1/system/choice-lists/protein_type/items/
{
  "value": "WAGYU",
  "label": "Wagyu Beef",
  "order": 10
}
```

### Via Admin Studio

1. Navigate to Admin Studio → Choice Lists
2. Select the list to customize
3. Click "Add Custom Item"
4. Enter value, label, and order
5. Save

Custom items are tenant-specific and don't affect other tenants.

---

## Permissions

| Role | System Items | Tenant Items | TenantConfig |
|------|--------------|--------------|--------------|
| Superuser | Full CRUD | Full CRUD | Full CRUD |
| Staff | Read-only | CRUD if extensible | Read-only |
| Tenant Admin | Read-only | CRUD if extensible | Full CRUD |
| Regular User | Read-only | Read-only | Read-only |

---

## Testing

Run the test suite:

```bash
# All config system tests
python manage.py test apps.system.tests --verbosity=2

# ConfigResolver tests only
python manage.py test apps.system.tests.ConfigResolverTest

# API tests only
python manage.py test apps.system.tests.ConfigResolverAPITest
```

---

## Migration Guide

### From Hardcoded Choices

Before (hardcoded):
```python
class ProteinType(models.TextChoices):
    BEEF = 'BEEF', 'Beef'
    PORK = 'PORK', 'Pork'
```

After (dynamic):
```python
from apps.system.services.config_resolver import get_choices

# In views/serializers
protein_choices = get_choices('protein_type', tenant=request.tenant)
```

### Frontend Migration

Before (static):
```typescript
const proteinOptions = [
  { value: 'BEEF', label: 'Beef' },
  { value: 'PORK', label: 'Pork' },
];
```

After (dynamic):
```typescript
import { choicesService } from '../services/choicesService';

const proteinOptions = await choicesService.getChoicesForField('protein_type');
```

---

## Best Practices

1. **Always use ConfigResolver** for dropdown values
2. **Cache appropriately** - config values are cached, avoid excessive API calls
3. **Use convenience functions** - `get_config()` and `get_choices()` for simple cases
4. **Check tenant context** - ensure `request.tenant` is available
5. **Test with multiple tenants** - verify tenant isolation works correctly
6. **Seed data in CI** - run `seed_system_choices` in test setup

---

## Related Documentation

- [REMAINING_WORK_OUTLINE.md](plans/REMAINING_WORK_OUTLINE.md) - Wave 1 status
- [API Reference](API_REFERENCE.md) - Full API documentation
- [Admin Studio Guide](ADMIN_STUDIO.md) - UI for config management

---

**Document Status**: ✅ COMPLETE
**Maintainer**: Development Team
**Last Review**: 2026-02-03
