# ProjectMeats Data Entity Restructuring Plan

> ⚠️ **ARCHIVED**: This document is superseded by [Master Plan v3.1 - Wave 6](../plans/PROJECTMEATS_V2_MASTER_PLAN.md#wave-6-model-migrations)  
> **Archived Date**: 2026-02-01  
> **Reason**: Content consolidated into Master Plan v3.1

---

**Document Version**: 1.1  
**Created**: January 28, 2026  
**Status**: PLANNED (Not Yet Implemented)  
**Last Reviewed**: January 28, 2026

---

## Executive Summary

This document outlines a comprehensive restructuring of the ProjectMeats data entities, reducing from **19 apps** to **12 well-organized apps** with clear categorization and purpose.

**Key Changes**:
- Delete 3 unused apps (schema_builder, system_config, accounts_receivables)
- Rename 4 apps for clarity (core→system, cockpit→workspace, bug_reports→feedback, invoices→accounting)
- Move products from tenant_apps to system (as choice list like Proteins)
- Merge plants into locations
- Merge purchase_orders + sales_orders into orders

---

## Current State Analysis

### Apps Inventory (19 Total)

| Location | App | Models | Records | Status |
|----------|-----|--------|---------|--------|
| `apps/` | `core` | Protein, UserPreferences, Abstract bases | 5 proteins | ⚠️ RENAME to `system` |
| `apps/` | `schema_builder` | DataSchema, DataSchemaField, etc. | **0 records** | 🗑️ DELETE |
| `apps/` | `tenants` | Tenant, TenantUser, TenantInvitation, TenantDomain | 8 tenants, 4 users | ✅ KEEP (consolidate) |
| `shared_apps/` | `system_config` | EntityBlueprint, BlueprintVersion, WorkflowRun | 1 blueprint, 0 runs | 🗑️ DELETE |
| `tenant_apps/` | `accounts_receivables` | AccountsReceivable | **0 records** | 🗑️ MERGE into `accounting` |
| `tenant_apps/` | `ai_assistant` | ChatSession, ChatMessage, AIConfiguration | varies | ✅ KEEP |
| `tenant_apps/` | `bug_reports` | BugReport | varies | ⚠️ RENAME to `feedback` |
| `tenant_apps/` | `carriers` | Carrier | 14 | ✅ KEEP (under `logistics`) |
| `tenant_apps/` | `cockpit` | ActivityLog, ScheduledCall | 50 logs, 15 calls | ⚠️ RENAME to `workspace` |
| `tenant_apps/` | `contacts` | Contact | 68 | ✅ KEEP |
| `tenant_apps/` | `customers` | Customer | 11 | ✅ KEEP |
| `tenant_apps/` | `invoices` | Invoice, Claim, PaymentTransaction | 1 invoice, 15 claims | ⚠️ RENAME to `accounting` |
| `tenant_apps/` | `locations` | Location | 3 | ⚠️ MERGE with `plants` |
| `tenant_apps/` | `plants` | Plant | 9 | ⚠️ MERGE into `locations` |
| `tenant_apps/` | `products` | Product | 235 | ⚠️ MOVE to `system` (choice list like Proteins) |
| `tenant_apps/` | `purchase_orders` | PurchaseOrder, CarrierPurchaseOrder, ColdStorageEntry, PurchaseOrderHistory | 10 | ⚠️ MERGE into `orders` |
| `tenant_apps/` | `sales_orders` | SalesOrder | 1 | ⚠️ MERGE into `orders` |
| `tenant_apps/` | `suppliers` | Supplier | 11 | ✅ KEEP |
| `tenant_apps/` | `workflows` | TenantForm, TenantFormEntity, TenantFormField, TenantFormRule, TenantWorkflow, TenantWorkflowCondition, TenantWorkflowAction, FormSubmission, FormStepSubmission, WorkflowExecutionLog, TenantList | 1 form | ✅ KEEP (consolidate names) |

---

## Issues Identified

### 1. **Dead/Unused Apps** (Safe to Delete)
- **schema_builder**: 0 records, superseded by workflows app
- **system_config**: Only 1 EntityBlueprint, 0 WorkflowRuns - redundant with workflows
- **accounts_receivables**: 0 records, functionality belongs in invoices/accounting

### 2. **Naming Inconsistencies**
- **core** → Should be `system` (contains system-level config like Proteins)
- **cockpit** → Product no longer uses this term, should be `workspace`
- **bug_reports** → Better as `feedback` (could include feature requests)
- **invoices** → Should be `accounting` (contains invoices, claims, payments)

### 3. **Fragmented Domains**
- **purchase_orders + sales_orders** → Both are orders, should be unified
- **plants + locations** → Plants ARE locations (supplier facilities)
- **accounts_receivables + invoices** → Both are accounting concerns
- **Token (Django auth) + tenants** → Auth should be consolidated

### 4. **Overlapping Functionality**
- `system_config.EntityBlueprint` duplicates `workflows.TenantForm` purpose
- `schema_builder.DataSchema` never implemented, workflows handles this
- Address fields exist in Supplier, Customer, Plant AND Location

---

## Proposed New Structure (13 Apps)

### Tier 1: System Apps (`apps/`)

| New App | Source Apps | Models | Purpose |
|---------|-------------|--------|---------|
| **system** | `core` + `products` | Protein, Product, UserPreferences, Abstract bases, Choices | System-wide data, choice lists, base classes, enums |
| **tenants** | `tenants` | Tenant, TenantUser, TenantInvitation, TenantDomain | Multi-tenancy management |

### Tier 2: Tenant Business Apps (`tenant_apps/`)

| New App | Source Apps | Models | Purpose |
|---------|-------------|--------|---------|
| **contacts** | `contacts` | Contact | Unified contact management |
| **customers** | `customers` | Customer | Customer master data |
| **suppliers** | `suppliers` | Supplier | Supplier master data |
| **locations** | `locations` + `plants` | Location, Plant | All physical locations (plants as location type) |
| **logistics** | `carriers` | Carrier | Transportation/carrier management |
| **orders** | `purchase_orders` + `sales_orders` | PurchaseOrder, SalesOrder, CarrierPurchaseOrder, ColdStorageEntry, PurchaseOrderHistory | Unified order management |
| **accounting** | `invoices` + `accounts_receivables` | Invoice, Claim, PaymentTransaction, AccountsReceivable | All financial records |
| **workflows** | `workflows` | TenantForm, TenantWorkflow, FormSubmission, etc. | Forms, workflows, automation |
| **workspace** | `cockpit` | ActivityLog, ScheduledCall | Dashboard, activity, scheduling |
| **feedback** | `bug_reports` | BugReport, FeatureRequest (future) | User feedback and issue tracking |
| **ai_assistant** | `ai_assistant` | ChatSession, ChatMessage, AIConfiguration | AI/ML features |

### Apps to DELETE

| App | Reason | Migration Path |
|-----|--------|----------------|
| `schema_builder` | 0 records, never used | None needed |
| `system_config` | Redundant with workflows | Move EntityBlueprint to workflows if needed |
| `accounts_receivables` | 0 records, redundant | Merge model into accounting if needed |

---

## Admin Panel Reorganization

### Current Admin Groups (Chaotic)
```
ACCOUNTS_RECEIVABLES
AI_ASSISTANT
AUTHENTICATION AND AUTHORIZATION
AUTH TOKEN
BUG_REPORTS
CARRIERS
COCKPIT
CONTACTS
CORE
CUSTOMERS
INVOICES
LOCATIONS
PLANTS
PRODUCTS
PURCHASE_ORDERS
SALES_ORDERS
SCHEMA_BUILDER
SUPPLIERS
SYSTEM_CONFIG
TENANTS
WORKFLOWS
```

### Proposed Admin Groups (Organized)

```
📦 SYSTEM
  ├── Proteins
  ├── Products (Choice List)
  ├── User Preferences
  └── System Settings

👥 TENANTS & USERS
  ├── Tenants
  ├── Tenant Users
  ├── Tenant Invitations
  ├── Tenant Domains
  ├── Users
  ├── Groups
  └── Auth Tokens

🏢 MASTER DATA
  ├── Suppliers
  ├── Customers
  ├── Contacts
  └── Carriers

📍 LOCATIONS
  ├── Locations
  └── Plants (Processing Facilities)

📋 ORDERS
  ├── Purchase Orders
  ├── Sales Orders
  ├── Carrier Purchase Orders
  ├── Cold Storage Entries
  └── Order History

💰 ACCOUNTING
  ├── Invoices
  ├── Claims
  ├── Payment Transactions
  └── Accounts Receivable

⚙️ WORKFLOWS & FORMS
  ├── Forms
  ├── Form Submissions
  ├── Workflows
  ├── Workflow Execution Logs
  └── Lists

🖥️ WORKSPACE
  ├── Activity Logs
  └── Scheduled Calls

🤖 AI ASSISTANT
  ├── Chat Sessions
  ├── Chat Messages
  └── AI Configuration

📝 FEEDBACK
  └── Bug Reports
```

---

## Implementation Phases

### Phase 1: Safe Deletes (Low Risk)
**Estimated Effort: 2-4 hours**

1. Delete `schema_builder` app entirely
   - Verify 0 records: ✅ Confirmed
   - Remove from INSTALLED_APPS
   - Remove migrations
   - Remove admin registration
   - Remove any URL patterns

2. Delete `system_config` app
   - Check if EntityBlueprint (1 record) needs migration
   - Remove from INSTALLED_APPS
   - Remove migrations

3. Delete `accounts_receivables` app
   - Verify 0 records: ✅ Confirmed
   - Remove from INSTALLED_APPS

### Phase 2: Renames (Medium Risk)
**Estimated Effort: 4-8 hours**

1. Rename `core` → `system`
   - Update app name in apps.py
   - Update all imports
   - Update INSTALLED_APPS
   - Run migrations

2. Rename `cockpit` → `workspace`
   - Same process as above

3. Rename `bug_reports` → `feedback`
   - Same process as above

4. Rename `invoices` → `accounting`
   - Same process as above

### Phase 2.5: Move Products to System (Medium Risk)
**Estimated Effort: 2-4 hours**

1. Move `products` from `tenant_apps/` to `apps/system/`
   - Move Product model to system app
   - Remove tenant ForeignKey (make system-wide)
   - Deduplicate 235 records → ~32 unique products
   - Update all ForeignKey references
   - Delete `tenant_apps/products` app

### Phase 3: Model Merges (Higher Risk)
**Estimated Effort: 8-16 hours**

1. Merge `plants` into `locations`
   - Add `location_type` field to Location (warehouse, plant, office, etc.)
   - Migrate Plant data to Location
   - Update all ForeignKey references
   - Remove plants app

2. Merge `purchase_orders` + `sales_orders` into `orders`
   - Create unified orders app
   - Keep separate models but in same app
   - Update imports and references

### Phase 4: Admin Reorganization
**Estimated Effort: 2-4 hours**

1. Create admin site customization
2. Group models into logical categories
3. Add custom verbose_name_plural
4. Implement custom AdminSite subclass

### Phase 5: Future Enhancements
**Estimated Effort: TBD**

1. Add `TenantConfiguration` model
   - Theme colors
   - Dashboard widgets
   - Quick actions preferences
   - Report settings

2. Add `UserConfiguration` model
   - Personal dashboard layout
   - Notification preferences
   - UI preferences

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|------------|------------|
| Delete schema_builder | 🟢 Low | 0 records, no dependencies |
| Delete system_config | 🟢 Low | 1 record, backup first |
| Delete accounts_receivables | 🟢 Low | 0 records |
| Rename core → system | 🟡 Medium | Many imports to update |
| Rename cockpit → workspace | 🟢 Low | Isolated app |
| Merge plants → locations | 🟡 Medium | Data migration required |
| Merge orders | 🟡 Medium | Multiple model moves |

---

## Database Impact

### Tables to DROP
- `schema_builder_dataschema`
- `schema_builder_dataschemafield`
- `schema_builder_dataschemaversion`
- `schema_builder_fieldoptionlist`
- `schema_builder_dynamicentity`
- `system_config_entityblueprint`
- `system_config_blueprintversion`
- `system_config_workflowrun`
- `accounts_receivables_accountsreceivable`

### Tables to RENAME
- `core_*` → `system_*`
- `cockpit_*` → `workspace_*`
- `bug_reports_*` → `feedback_*`
- `invoices_*` → `accounting_*`

### Tables to MERGE/MOVE
- `products_product` → `system_product` (remove tenant FK, deduplicate)
- `plants_plant` → `locations_plant` (keep as separate model in locations app)

---

## 🔍 Dependency Analysis (January 28, 2026)

### Apps Safe to Delete

#### 1. `schema_builder` - ✅ SAFE TO DELETE
| Dependency | Files | Action |
|------------|-------|--------|
| INSTALLED_APPS | `settings/base.py` | Remove line |
| URLs | `urls.py` | Remove `path("api/v1/schema-builder/", ...)` |
| Permissions | `setup_permission_groups.py` | Remove from exclusion list |
| Migrations | Internal only | Drop tables |

**Records**: 0  
**Risk**: LOW  
**Blockers**: None

#### 2. `system_config` - ⚠️ REQUIRES FRONTEND MIGRATION
| Dependency | Files | Action |
|------------|-------|--------|
| INSTALLED_APPS | `settings/base.py` | Remove line |
| URLs | `urls.py` | Remove `path("admin/system-config/", ...)` |
| Permissions | `setup_permission_groups.py` | Remove from exclusion list |
| **Frontend admin-studio** | 10+ components | **BLOCKER - Must migrate first** |

**Frontend Dependencies** (must be migrated or removed):
```
src/apps/admin-studio/components/VersionHistory.tsx - 3 API calls
src/apps/admin-studio/components/SchemaEditorSimple.tsx - 2 API calls
src/apps/admin-studio/components/WorkflowCanvasWithLogic.tsx - 3 API calls
src/apps/admin-studio/components/WorkflowCanvasSimple.tsx - 2 API calls
src/apps/admin-studio/pages/Editor.tsx - 3 API calls
src/apps/admin-studio/pages/Dashboard.tsx - 1 API call
```

**Records**: 1 EntityBlueprint, 0 WorkflowRuns  
**Risk**: MEDIUM (frontend breakage)  
**Blockers**: admin-studio frontend must be updated first

#### 3. `accounts_receivables` - ✅ SAFE TO DELETE
| Dependency | Files | Action |
|------------|-------|--------|
| INSTALLED_APPS | `settings/base.py` | Remove line |
| URLs | `urls.py` | Remove path |
| Frontend | `apiService.ts` | Remove 5 unused API calls |
| Seed commands | `create_guest_tenant.py` | Remove import |
| Permissions | `setup_permission_groups.py` | Update accounting permissions |

**Records**: 0  
**Risk**: LOW  
**Blockers**: None

---

### Apps to Rename

#### 4. `core` → `system` - ⚠️ HIGH EFFORT
| Dependency Type | Count | Files Affected |
|-----------------|-------|----------------|
| Model imports | 30+ | All tenant_apps models.py |
| Admin imports | 15+ | All admin.py files |
| Abstract bases | 6 | TenantAwareModel, TimestampModel, StatusModel, AbstractContact, OwnedModel, TenantManager |
| Choice classes | 30+ | All models using TextChoices |
| Settings | 1 | `base.py` |
| URLs | 1 | `urls.py` |

**Import patterns to update**:
```python
# FROM:
from apps.core.models import TenantAwareModel, TimestampModel
from apps.core.admin import TenantFilteredAdmin

# TO:
from apps.system.models import TenantAwareModel, TimestampModel
from apps.system.admin import TenantFilteredAdmin
```

**Strategy**: Use `db_table = 'core_modelname'` in Meta to avoid table renames initially.

**Risk**: HIGH (many files)  
**Effort**: 4-8 hours

#### 5. `cockpit` → `workspace` - MEDIUM EFFORT
| Dependency | Files | Action |
|------------|-------|--------|
| Backend imports | `seed_all_modules.py` | Update import |
| Settings | `base.py` | Update INSTALLED_APPS |
| URLs | `urls.py` | Update path |
| Frontend | 4 components | Update API paths |

**Frontend files to update**:
```
src/components/Shared/ScheduleCallModal.tsx - /cockpit/scheduled-calls/
src/components/Shared/ActivityFeed.tsx - /cockpit/activity-logs/
src/components/FormSubmission/StepNotes.tsx - /api/cockpit/activity-logs/
```

**Risk**: MEDIUM  
**Effort**: 2-4 hours

#### 6. `bug_reports` → `feedback` - LOW EFFORT
| Dependency | Files | Action |
|------------|-------|--------|
| Settings | `base.py` | Update INSTALLED_APPS |
| URLs | `urls.py` | Update path |

**Risk**: LOW  
**Effort**: 1-2 hours

#### 7. `invoices` → `accounting` - MEDIUM EFFORT
| Dependency | Files | Action |
|------------|-------|--------|
| Backend imports | 5 files | Update imports |
| FK references | purchase_orders, sales_orders | Update string refs |
| Migration deps | 3 apps | May need fake migrations |
| Settings/URLs | 2 files | Update paths |
| Frontend | `apiService.ts` | Update paths |

**Migration dependencies** (other apps depend on invoices):
- `purchase_orders` depends on `invoices` migrations
- `sales_orders` depends on `invoices` migrations  

**Risk**: MEDIUM  
**Effort**: 2-4 hours

---

### Complex Model Moves

#### 8. `products` → Move to `apps/system` - ⚠️ HIGH COMPLEXITY

**Current State**:
- 235 records across 7 tenants (seeded data per tenant)
- Has `tenant` ForeignKey (must be removed)
- ~32 unique product definitions duplicated per tenant

**Dependencies**:
| Type | Details |
|------|---------|
| ForeignKey refs | PurchaseOrder.product, SalesOrder.product, Invoice.product, CarrierPurchaseOrder.product, ColdStorageEntry.product |
| M2M refs | Supplier.products, Customer.products |
| Migration deps | 6 other apps reference products migrations |
| Field Registry | `'product': ('products', 'Product')` mapping |
| Active data | 3 records (1 PO, 1 SO, 1 Invoice) reference products |

**Migration Steps**:
1. Create new `Product` model in `apps/system/` without tenant FK
2. Create data migration to deduplicate products (235 → ~32)
3. Create mapping table: old product IDs → new product IDs
4. Update all ForeignKey references to point to new model
5. Update FieldRegistry mapping: `'product': ('system', 'Product')`
6. Update frontend API paths
7. Delete old `tenant_apps/products` app

**Risk**: HIGH  
**Effort**: 8-16 hours

#### 9. `plants` → Merge into `locations` - MEDIUM COMPLEXITY

**Current State**:
- 9 plants, 3 locations
- Plants are supplier facilities
- Locations are generic pickup/delivery points

**Dependencies**:
| Type | Details |
|------|---------|
| ForeignKey refs | PurchaseOrder (2 FKs), SalesOrder, Supplier |
| Migration deps | 4 apps depend on plants migrations |

**Recommended Approach**: 
Keep Plant as separate model but move to locations app (NOT a true merge).

```python
# locations/models.py
class Location(TimestampModel):
    # existing fields
    
class Plant(TimestampModel):  # Move from plants app
    # existing fields
    location_type = 'plant'  # Add discriminator
```

**Risk**: MEDIUM  
**Effort**: 4-8 hours

#### 10. `purchase_orders` + `sales_orders` → `orders` - HIGH COMPLEXITY

**Dependencies**:
| Type | Details |
|------|---------|
| Cross-references | PO has FK to SO |
| Invoice refs | Invoice has FKs to both |
| Model count | 4 PO models + 1 SO model |
| Migration deps | Complex web |

**Recommended Approach**:
Keep models separate, just move to unified `orders` app.

**Risk**: HIGH  
**Effort**: 8-16 hours

---

## Questions Resolved

1. **Products as System Data**: ✅ CONFIRMED - Products should be system-wide choice data like Proteins, not tenant-specific. Will require deduplication.

2. **Carriers**: Keep as standalone `carriers` app (not `logistics`)

3. **Auth Token Consolidation**: Handle via admin grouping only, not code changes

---

## Implementation Phases (Recommended Order)

### Phase 1A: Safe Deletes (No Blockers) - 2-4 hours
- [ ] Delete `schema_builder` app
- [ ] Delete `accounts_receivables` app
- [ ] Update `setup_permission_groups.py`
- [ ] Update frontend `apiService.ts` (remove AR calls)

### Phase 1B: Requires Frontend First - 4-8 hours  
- [ ] Migrate admin-studio to use workflows API OR remove feature
- [ ] Delete `system_config` app

### Phase 2: Safe Renames - 4-6 hours
- [ ] Rename `bug_reports` → `feedback`
- [ ] Rename `cockpit` → `workspace`
- [ ] Update all frontend API paths

### Phase 3: Complex Renames - 8-12 hours
- [ ] Rename `invoices` → `accounting`
- [ ] Rename `core` → `system` (use db_table to preserve tables)
- [ ] Update 50+ import statements

### Phase 4: Model Moves - 16-24 hours
- [ ] Move `products` to `apps/system/` (dedupe, update FKs)
- [ ] Move `Plant` model to `locations` app
- [ ] Update FieldRegistry mappings

### Phase 5: Order Consolidation - 8-16 hours
- [ ] Create unified `orders` app
- [ ] Move PurchaseOrder models to orders
- [ ] Move SalesOrder model to orders
- [ ] Update all references

### Phase 6: Admin Reorganization - 2-4 hours
- [ ] Create custom AdminSite with grouped categories
- [ ] Update verbose_name on all models
- [ ] Implement emoji-prefixed groups

---

## Final Target Structure (12 Apps)

```
apps/
├── system/          # Was: core + products
│   ├── models.py    # Protein, Product, UserPreferences, Abstract bases
│   └── choices.py   # All TextChoices classes
├── tenants/         # Unchanged

tenant_apps/
├── contacts/        # Unchanged
├── customers/       # Unchanged  
├── suppliers/       # Unchanged
├── locations/       # Was: locations + plants
│   ├── models.py    # Location, Plant
├── logistics/       # Was: carriers (optional rename)
├── orders/          # Was: purchase_orders + sales_orders
│   ├── models.py    # PurchaseOrder, SalesOrder, CarrierPurchaseOrder, ColdStorageEntry, PurchaseOrderHistory
├── accounting/      # Was: invoices + accounts_receivables
│   ├── models.py    # Invoice, Claim, PaymentTransaction
├── workflows/       # Unchanged
├── workspace/       # Was: cockpit
│   ├── models.py    # ActivityLog, ScheduledCall
├── feedback/        # Was: bug_reports
├── ai_assistant/    # Unchanged
```

**Total: 12 apps (down from 19)**

---

## Admin Panel Target Structure

```
📦 SYSTEM
  ├── Proteins
  ├── Products (Choice List)
  ├── User Preferences
  └── System Settings

👥 TENANTS & USERS
  ├── Tenants
  ├── Tenant Users
  ├── Tenant Invitations
  ├── Tenant Domains
  ├── Users
  ├── Groups
  └── Auth Tokens

🏢 MASTER DATA
  ├── Suppliers
  ├── Customers
  ├── Contacts
  └── Carriers

📍 LOCATIONS
  ├── Locations
  └── Plants (Processing Facilities)

📋 ORDERS
  ├── Purchase Orders
  ├── Sales Orders
  ├── Carrier Purchase Orders
  ├── Cold Storage Entries
  └── Order History

💰 ACCOUNTING
  ├── Invoices
  ├── Claims
  └── Payment Transactions

⚙️ WORKFLOWS & FORMS
  ├── Forms
  ├── Form Submissions
  ├── Workflows
  ├── Workflow Execution Logs
  └── Lists

🖥️ WORKSPACE
  ├── Activity Logs
  └── Scheduled Calls

🤖 AI ASSISTANT
  ├── Chat Sessions
  ├── Chat Messages
  └── AI Configuration

📝 FEEDBACK
  └── Bug Reports
```

---

## Pre-Implementation Checklist

Before starting any phase:

- [ ] Create full database backup
- [ ] Create git branch: `refactor/data-entity-restructure`
- [ ] Document current record counts
- [ ] Notify team of planned changes
- [ ] Schedule maintenance window for Phase 4+

---

## Rollback Plan

Each phase should be independently rollbackable:

1. **Phase 1 (Deletes)**: Restore from backup + re-add to INSTALLED_APPS
2. **Phase 2 (Renames)**: Git revert + restore migrations
3. **Phase 3 (Complex Renames)**: Git revert + fake migrations
4. **Phase 4 (Model Moves)**: Restore from backup (most risky)

---

## Next Steps

1. [ ] Get stakeholder approval for timeline
2. [ ] Decide on admin-studio fate (migrate or remove)
3. [ ] Schedule implementation window
4. [ ] Execute Phase 1A first (lowest risk)

---

## 🆕 ADMIN BACKEND REVAMP (Added 2026-01-31)

> **See Full Plan**: `/root/.copilot/session-state/.../ADMIN_REVAMP_PLAN.md`

### Integration with This Plan

The Admin Backend Revamp extends this restructuring plan with a **3-tier permission hierarchy**:

```
SYSTEM CORE (Superuser only)
    │
    ▼
SYSTEM (System Admins - affects all tenants)
    │
    ▼
TENANT (Tenant Admins - affects their tenant only)
```

### New Unified Config System

**Replaces**:
- `schema_builder` app → `SystemChoiceList` + `SystemFieldSchema` in core
- `system_config` app → Merged into core ConfigResolver
- Scattered TextChoices → Centralized `SystemChoiceList`

**New Models** (in `apps/core/`):
- `SystemChoiceList` - System-wide dropdown options
- `SystemChoiceItem` - Items within choice lists
- `SystemFieldSchema` - Base field definitions per entity
- `TenantConfig` - Per-tenant overrides and customizations

### Root Tenant Pattern

UUID `00000000-0000-0000-0000-000000000000` serves as:
- Source of truth for system defaults
- Context for Global System Admins
- Parent for all choice list propagation

### Connection to FORMS_FLOWS_ENHANCEMENT_PLAN

The form builder and Cockpit will use `ConfigResolver` to:
1. Get effective choices (system + tenant overrides)
2. Get effective fields (base + custom)
3. Respect permission tiers

### Updated Phase Order

1. **Phase 1A**: Delete unused apps (schema_builder, system_config, accounts_receivables)
2. **Phase 1B**: Create new unified config models
3. **Phase 2**: Renames (core→system not needed now, keep as core)
4. **Phase 3**: Model moves (plants→locations)
5. **Phase 4**: Admin UI revamp (Django + React Admin Studio)
6. **Phase 5**: Integration with forms/cockpit

