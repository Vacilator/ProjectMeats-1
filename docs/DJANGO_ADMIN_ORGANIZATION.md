# Django Admin Organization Guide

**Last Updated**: February 4, 2026
**Status**: ✅ Production Ready

## Overview

The ProjectMeats Django Admin is organized into **three tiers** based on the principle that **changes flow downward** in visibility, impact, and application scope.

```
🔒 ROOT LEVEL (Superuser Only)
    ↓ affects
⚙️ SYSTEM LEVEL (Shared Templates & Config)
    ↓ affects
🏢 TENANT LEVEL (Business Data - Isolated)
```

## Three-Tier Architecture

### 🔒 ROOT LEVEL - Infrastructure & User Management

**Access**: Superusers only
**Scope**: Global, affects all tenants
**Purpose**: Core infrastructure and authentication

**Apps**:
- `auth` - Django User & Group models
- `authtoken` - API authentication tokens

**Impact**: Changes at this level affect **all tenants**. Use with extreme caution.

---

### ⚙️ SYSTEM LEVEL - Global Configuration & Templates

**Access**: Superusers + System Administrators
**Scope**: Shared across tenants
**Purpose**: Define templates, choice lists, and blueprints that tenants can use

**Apps**:
- `system` - SystemChoiceList, SystemFieldSchema, TenantConfig, Products
- `system_config` - System Blueprints (dynamic schema engine)
- `tenants` - Tenant management, invitations, domains
- `core` - Protein, UserPreferences

**Key Features**:
1. **SystemChoiceList**: Define dropdown options once, use across all tenants
   - Example: Payment terms (Net 30, Net 60, etc.)
   - Tenants can extend with custom values

2. **System Blueprints**: Define custom fields/forms that tenants can activate
   - Example: Add "Halal Certified" checkbox to Supplier model

3. **Tenant Management**: Create tenants, invite users, manage domains

**Impact**: Changes here are **inherited by all tenants** but don't modify tenant data.

---

### 🏢 TENANT LEVEL - Business Data (Isolated)

**Access**: Tenant Administrators (see only their tenant's data)
**Scope**: Single tenant (strict isolation via `tenant` ForeignKey)
**Purpose**: Manage day-to-day business operations

**Apps** (grouped by function):
- **Supply Chain**: `suppliers`, `carriers`, `plants`
- **Customer Relations**: `customers`, `contacts`, `inquiries`
- **Orders**: `purchase_orders`, `sales_orders`, `orders`, `fulfillments`
- **Products**: `products`
- **Accounting**: `invoices`, `locations`
- **Automation**: `workflows`
- **Tools**: `cockpit`, `ai_assistant`, `bug_reports`

**Data Isolation**:
- All models have `tenant` ForeignKey
- TenantFilteredAdmin automatically filters by `request.tenant`
- Tenant admins **cannot see** other tenants' data
- Superusers see all data across all tenants

**Impact**: Changes only affect the **specific tenant** making them.

---

## Visual Organization

### Admin Index Page

The custom admin index groups apps by tier with visual cues:

```
┌─────────────────────────────────────────┐
│ 🔒 ROOT LEVEL                           │
│ Infrastructure & User Management        │
│ ─────────────────────────────────────── │
│ • auth (Users, Groups)                  │
│ • authtoken (API Tokens)                │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ ⚙️ SYSTEM LEVEL                          │
│ Global Templates & Configuration        │
│ ─────────────────────────────────────── │
│ • system (Choice Lists, Products)       │
│ • system_config (Blueprints)            │
│ • tenants (Tenant Management)           │
│ • core (Core Models)                    │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ 🏢 TENANT LEVEL                          │
│ Business Data (Isolated by Tenant)      │
│ ─────────────────────────────────────── │
│ • suppliers, customers, carriers        │
│ • purchase_orders, sales_orders         │
│ • products, invoices, locations         │
│ • workflows, cockpit, contacts          │
│ • inquiries, fulfillments, plants       │
│ • ai_assistant, bug_reports             │
└─────────────────────────────────────────┘
```

### Color Coding

- **Root**: Orange gradient (🟠) - Warning: High impact
- **System**: Green gradient (🟢) - Caution: Affects all tenants
- **Tenant**: Blue gradient (🔵) - Safe: Isolated changes

---

## Permission Model

### Superuser (Root Access)
✅ Full access to all three tiers
✅ Can see all tenants' data
✅ Can manage infrastructure

### System Administrator
✅ Access to System Level (templates, configs)
✅ Cannot see tenant business data
❌ Cannot access Root Level

### Tenant Administrator
✅ Access to Tenant Level (only their tenant)
✅ Can manage their tenant's business data
❌ Cannot access System or Root levels
❌ Cannot see other tenants' data

### Tenant User (Staff)
✅ Read-only access to their tenant's data
❌ Cannot add, edit, or delete
❌ Cannot access admin at all (API only)

---

## Configuration Inheritance

### Example: Payment Terms

**1. System Level** (Superuser creates global template):
```python
SystemChoiceList.objects.create(
    slug='payment_terms',
    name='Payment Terms',
    is_extensible=True  # Tenants can add custom values
)

SystemChoiceItem.objects.create(
    choice_list=payment_terms,
    value='net_30',
    label='Net 30',
    tenant=None  # System-level (global)
)
```

**2. Tenant Level** (Tenant Admin extends with custom value):
```python
SystemChoiceItem.objects.create(
    choice_list=payment_terms,
    value='prepay_wire',
    label='Prepay Wire Transfer',
    tenant=my_tenant  # Tenant-specific override
)
```

**3. Application** (Frontend sees merged list):
```json
{
  "payment_terms": [
    {"value": "net_30", "label": "Net 30"},          // System
    {"value": "net_60", "label": "Net 60"},          // System
    {"value": "prepay_wire", "label": "Prepay Wire"} // Tenant custom
  ]
}
```

### Cascade Rules

1. **Root → System**: Infrastructure changes (e.g., Django version upgrade) affect all system configs
2. **System → Tenant**: Template changes (e.g., adding new choice to list) available to all tenants
3. **Tenant → Tenant**: Completely isolated. One tenant's custom value doesn't affect others

---

## Admin Site URLs

### Primary (Custom Three-Tier Admin)
```
https://meatscentral.com/admin/
```
Uses: `apps.core.admin_site.admin_site`

### Legacy (Default Django Admin)
```
https://meatscentral.com/admin-legacy/
```
Uses: `django.contrib.admin.site`

**Note**: Legacy admin is kept for backwards compatibility during transition. Will be deprecated after team is trained on new system.

---

## Custom Admin Site Implementation

### File: `backend/apps/core/admin_site.py`

```python
class MeatsCentralAdminSite(admin.AdminSite):
    """Custom admin with three-tier organization."""

    site_header = "🥩 Meats Central Administration"
    site_title = "Meats Central Admin"
    index_title = "System Dashboard"

    def get_app_list(self, request, app_label=None):
        """Group apps by tier and sort."""
        # ... tier organization logic ...
```

### Registering Models

**Old Pattern** (default admin):
```python
from django.contrib import admin

@admin.register(MyModel)
class MyModelAdmin(admin.ModelAdmin):
    pass
```

**New Pattern** (three-tier admin):
```python
from django.contrib import admin
from apps.core.admin_site import admin_site

class MyModelAdmin(admin.ModelAdmin):
    pass

# Register with custom admin site
admin_site.register(MyModel, MyModelAdmin)
```

---

## Multi-Tenancy Integration

### TenantFilteredAdmin Base Class

All tenant-level admins inherit from `TenantFilteredAdmin`:

```python
from apps.core.admin import TenantFilteredAdmin

class SupplierAdmin(TenantFilteredAdmin):
    list_display = ['name', 'contact_email', 'tenant']

    # Automatic tenant filtering - no code needed!
    # - get_queryset() filters by request.tenant
    # - save_model() sets tenant on creation
    # - permissions check tenant ownership
```

**Key Features**:
- `get_queryset()`: Filters by `tenant=request.tenant` (staff) or shows all (superuser)
- `save_model()`: Auto-assigns `obj.tenant = request.tenant` on creation
- `formfield_for_foreignkey()`: Restricts tenant dropdown to user's tenants only
- `has_*_permission()`: Checks tenant ownership before allowing actions

### Example: Supplier Admin

```python
@admin_site.register(Supplier)
class SupplierAdmin(TenantFilteredAdmin):
    list_display = ['name', 'ap_contact_name', 'tenant']
    search_fields = ['name', 'ap_contact_name']
    list_filter = ['tenant']  # Only shows if superuser

    # When staff user logs in:
    # 1. Only sees suppliers where tenant=their_tenant
    # 2. Can only create suppliers for their tenant
    # 3. Cannot edit/delete other tenants' suppliers
```

---

## Common Tasks

### Task 1: Add New System-Wide Choice List

**Tier**: System Level
**Access**: Superuser only

```python
# Create the list
choice_list = SystemChoiceList.objects.create(
    slug='shipping_methods',
    name='Shipping Methods',
    is_extensible=True,
    is_reorderable=True,
    model_field_path='carriers.Carrier.shipping_methods'
)

# Add default options
SystemChoiceItem.objects.create(
    choice_list=choice_list,
    value='ltl',
    label='LTL (Less Than Truckload)',
    order=1
)
```

**Impact**: Available to all tenants immediately.

---

### Task 2: Invite New Tenant Owner

**Tier**: System Level
**Access**: Superuser only

1. Go to `/admin/` → ⚙️ System Configuration → Tenants
2. Select tenant → Actions → "🚀 Onboard New Tenant Owner"
3. Enter owner details (name, email)
4. System creates invitation with role='owner'
5. Email sent automatically with signup link

**Impact**: New owner can log in and manage their tenant.

---

### Task 3: Add Custom Field to Supplier (via Blueprint)

**Tier**: System Level (define template), Tenant Level (activate)

**Step 1** (System Admin): Create Blueprint
```python
from shared_apps.system_config.models import FieldBlueprint

FieldBlueprint.objects.create(
    app_label='suppliers',
    model_name='Supplier',
    field_name='halal_certified',
    field_type='boolean',
    label='Halal Certified',
    help_text='Is this supplier halal certified?'
)
```

**Step 2** (Tenant Admin): Activate Blueprint
```python
from apps.system.models import TenantConfig

TenantConfig.objects.create(
    tenant=my_tenant,
    key='blueprints.suppliers.halal_certified',
    value=True
)
```

**Impact**: Field appears in Supplier forms for that tenant only.

---

### Task 4: Manage Tenant-Specific Products

**Tier**: Tenant Level
**Access**: Tenant Administrator

1. Go to `/admin/` → 🏢 Tenant Data → Products
2. Only sees products for their tenant
3. Add/Edit/Delete affects only their catalog

**Impact**: Isolated. Other tenants unchanged.

---

## Troubleshooting

### Issue: "I can't see any tenants in admin"

**Solution**: You're a tenant admin, not a superuser. Tenant admins can only manage their own tenant's data, not view the Tenants model itself.

### Issue: "I'm seeing data from all tenants"

**Solution**: You're logged in as a superuser. This is intentional. Staff users will only see their tenant's data.

### Issue: "Model is not showing in admin"

**Check**:
1. Is the model registered? `admin_site.register(MyModel, MyModelAdmin)`
2. Does your admin.py import admin_site? `from apps.core.admin_site import admin_site`
3. Does the app have verbose_name in apps.py?

### Issue: "Changes not saving in admin"

**For Tenant Models**: Ensure `TenantFilteredAdmin` is the base class, not plain `admin.ModelAdmin`.

---

## Migration Guide (for Existing Admins)

### Before (Default Admin)
```python
# Old way
from django.contrib import admin

@admin.register(MyModel)
class MyModelAdmin(admin.ModelAdmin):
    pass
```

### After (Three-Tier Admin)
```python
# New way
from django.contrib import admin
from apps.core.admin_site import admin_site

class MyModelAdmin(admin.ModelAdmin):
    pass

admin_site.register(MyModel, MyModelAdmin)
```

**Timeline**: Legacy admin (`/admin-legacy/`) will be available until Q2 2026.

---

## Future Enhancements

### Planned (Q2 2026)
- [ ] System-level audit log for all tier changes
- [ ] Tenant-specific custom admin dashboards
- [ ] Bulk tenant operations (e.g., apply blueprint to 10 tenants)
- [ ] Admin action history with rollback capability

### Under Consideration
- [ ] Real-time admin notifications (e.g., "New tenant created")
- [ ] Admin API for headless management
- [ ] Visual flow designer for system blueprints

---

## WorkForms Permission System (Phase 4.2)

### Overview

The WorkForms editor implements a granular **role-based permission system** that controls access to form creation, editing, and publishing capabilities.

### Permission Matrix

| **Role** | **Create** | **Edit Own** | **Edit All** | **Publish** | **Modes** | **Templates** |
|----------|------------|--------------|--------------|-------------|-----------|---------------|
| owner/admin | ✅ | ✅ | ✅ | ✅ | All (W/V/E) | System + Custom |
| manager | ✅ | ✅ | ❌ | ❌ | Visual + Wizard | Use only |
| user | ❌ | ❌ | ❌ | ❌ | View only | View only |
| readonly | ❌ | ❌ | ❌ | ❌ | View only | View only |

**Editor Modes**: W = Wizard, V = Visual, E = Expert

### Backend Implementation

**Location**: `backend/tenant_apps/workflows/permissions.py`

**Permission Classes**:
- `IsTenantAdminOrOwner` - For publish/delete/global templates
- `CanEditWorkForm` - Admins edit any, managers edit own
- `CanPublishWorkForm` - Owner/admin only

**API Endpoint**: `GET /api/v1/workflows/permissions/`

Returns permission metadata for frontend:
```json
{
  "can_create": true,
  "can_edit": true,
  "can_publish": true,
  "allowed_modes": ["wizard", "visual", "expert"],
  "allowed_node_categories": ["trigger", "form", "condition", ...],
  "role": "owner"
}
```

### Frontend Integration

**Hook**: `frontend/src/hooks/useWorkFormPermissions.ts`

```typescript
const { permissions, isLoading } = useWorkFormPermissions();

if (permissions.can_create) {
  // Show "Create New" button
}
```

**UI Enforcement**:
- Catalog: Create button disabled with Lock icon for unauthorized users
- Editor: Mode switcher shows locked modes with upgrade tooltip
- Node Palette: Filtered by `allowed_node_categories`

### Node Categories

- `trigger` - Entry points (Manual, Schedule, Webhook)
- `form` - Form steps and fields
- `condition` - If/Else logic
- `action` - Email, API calls, updates
- `wait` - Delays, approvals
- `document` - PDF generation
- `utility` - Transformations
- `terminal` - Success/failure ends

**Manager Restrictions**: Cannot access advanced `utility` nodes (custom code, API requests)

### Security

⚠️ **Frontend permissions are UX-only**. All enforcement on backend:
- DRF permission classes validate every API request
- Serializers add permission fields to responses
- ViewSets filter by tenant and ownership
- API returns 403 if unauthorized

### Upgrading User Roles

**Make user a manager**:
```python
from django.contrib.auth import get_user_model
User = get_user_model()

user = User.objects.get(email='user@example.com')
user.tenant_role = 'manager'
user.save()
```

**Make user tenant admin**:
```python
user.is_tenant_admin = True
user.save()
```

---

## Related Documentation

- **Multi-Tenancy**: `docs/ARCHITECTURE.md#multi-tenancy`
- **System Blueprints**: `shared_apps/system_config/README.md`
- **Tenant Management**: `docs/TENANT_MANAGEMENT.md`
- **Permissions**: `docs/PERMISSIONS.md`

---

## Questions?

**Contact**: Infrastructure Team
**Slack**: #admin-support
**Wiki**: https://wiki.meatscentral.com/admin
