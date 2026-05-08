# Admin Studio User Guide

**Version**: 1.0
**Last Updated**: 2026-02-03
**Audience**: System Administrators, Tenant Admins

---

## Overview

Admin Studio provides no-code configuration tools for managing system settings, choice lists, and form schemas. This guide covers the Django Admin interface enhancements and React Admin Studio components.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Django Admin: Choice Lists](#django-admin-choice-lists)
3. [Django Admin: Bulk Operations](#django-admin-bulk-operations)
4. [Django Admin: Import/Export](#django-admin-importexport)
5. [React Admin Studio](#react-admin-studio)
6. [Configuration System](#configuration-system)
7. [Permissions & Tiers](#permissions--tiers)
8. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Accessing Admin Studio

**Django Admin** (System Configuration):
```
https://your-domain.com/admin/
```

**React Admin Studio** (Visual Editors):
```
https://your-domain.com/admin-studio/
```

### User Roles

| Role | Django Admin | React Studio | Can Modify System Lists |
|------|--------------|--------------|-------------------------|
| Superuser | ✅ Full Access | ✅ Full Access | ✅ Yes |
| System Admin | ✅ Limited | ✅ Full Access | ❌ No |
| Tenant Admin | ❌ No Access | ✅ Extensible Lists Only | ❌ No |

---

## Django Admin: Choice Lists

### Navigating to Choice Lists

1. Log in to Django Admin
2. Find **⚙️ System Configuration** in the sidebar
3. Click **System choice lists**

### Understanding Choice Lists

Choice lists power dropdown fields throughout the application:

| List Slug | Used For | Extensible |
|-----------|----------|------------|
| `protein_type` | Product protein selection | ✅ Yes |
| `payment_terms` | Customer/Supplier payment terms | ✅ Yes |
| `po_status` | Purchase order statuses | ❌ No |
| `so_status` | Sales order statuses | ❌ No |
| `country_origin` | Product origin countries | ✅ Yes |

### Editing Choice Items

1. Click on a choice list to open it
2. Use the inline table to add/edit/remove items:
   - **Value**: Internal identifier (lowercase, underscores)
   - **Label**: Display text shown to users
   - **Order**: Sort position (lower = first)
   - **Active**: Toggle visibility
   - **Default**: Mark as pre-selected option

### Drag-Drop Reordering

1. Click **↕️ Enable Drag Reorder** button
2. Drag rows by the handle (≡) to reorder
3. Order values update automatically
4. Click **Save** to persist changes

### Tier Badges

- **🔒 System Only**: Cannot be modified by tenants
- **🏢 Extensible**: Tenants can add custom items

---

## Django Admin: Bulk Operations

Select multiple choice lists and use the **Action** dropdown:

### 📋 Duplicate Selected
Creates copies of selected lists with `_copy` suffix.

**Use Case**: Create a variant of an existing list for testing.

### 🗃️ Archive Selected
Deactivates all items in selected lists without deleting them.

**Use Case**: Temporarily hide a list's options from dropdowns.

### ✅ Unarchive Selected
Reactivates all items in selected lists.

**Use Case**: Restore previously archived lists.

### 🔀 Merge Selected
Combines multiple lists into the first selected one:
- Unique items from source lists are added to the target
- Duplicate values are skipped
- Source lists are deleted after merge

**Use Case**: Consolidate similar lists (e.g., merge regional protein types).

---

## Django Admin: Import/Export

### Export Options

From the choice list detail page:

| Button | Format | Contents |
|--------|--------|----------|
| 📤 Export JSON | `.json` | Full item data with metadata |
| 📊 Export CSV | `.csv` | Tabular data for spreadsheets |

### Import Options

| Button | Format | Notes |
|--------|--------|-------|
| 📥 Import JSON | `.json` | Paste or upload JSON array |
| 📋 Import CSV | `.csv` | Header: value,label,order,is_active,is_default |

### JSON Format Example

```json
[
  {
    "value": "beef",
    "label": "Beef",
    "order": 1,
    "is_active": true,
    "is_default": false
  },
  {
    "value": "pork",
    "label": "Pork",
    "order": 2,
    "is_active": true,
    "is_default": false
  }
]
```

### CSV Format Example

```csv
value,label,order,is_active,is_default
beef,Beef,1,true,false
pork,Pork,2,true,false
chicken,Chicken,3,true,true
```

### Bulk Export (Multiple Lists)

1. Select multiple lists from the list view
2. Choose **📤 Export selected as JSON** or **📊 Export selected as CSV**
3. Download contains all selected lists

---

## React Admin Studio

### Config Dashboard

Access at `/admin-studio/config/`

Features:
- View all choice lists with item counts
- Quick search and filter
- Visual tier indicators
- Direct edit links

### Choice List Editor

Interactive editor with:
- Inline editing (click to edit)
- Drag-drop reordering
- Add/remove items
- Real-time validation

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + S` | Save changes |
| `Escape` | Cancel editing |
| `Tab` | Move to next field |
| `Enter` | Confirm edit |

---

## Configuration System

### 3-Tier Resolution

Configurations cascade through three levels:

```
1. System (Default)     → Base settings for all tenants
2. Tenant (Override)    → Tenant-specific customizations
3. User (Future)        → Per-user preferences
```

### Config Keys

Common configuration keys:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `forms.auto_save_enabled` | boolean | `true` | Enable auto-save in forms |
| `forms.auto_save_delay_ms` | number | `500` | Auto-save debounce delay |
| `forms.validate_on_blur` | boolean | `true` | Validate fields on blur |
| `forms.show_progress_bar` | boolean | `true` | Show step progress |
| `ui.theme.primary_color` | string | `#667eea` | Brand primary color |
| `business.po.require_approval` | boolean | `true` | Require PO approval |

### Setting Tenant Configs

Via Django Admin:
1. Go to **System Configuration > Tenant configs**
2. Click **Add Tenant Config**
3. Enter key, value, and category
4. Save

Via API:
```bash
curl -X POST /api/v1/system/tenant-configs/ \
  -H "Authorization: Token YOUR_TOKEN" \
  -d '{"key": "forms.auto_save_enabled", "value": false, "category": "UI"}'
```

---

## Permissions & Tiers

### Choice List Permissions

| List Type | View | Add Items | Edit Items | Delete |
|-----------|------|-----------|------------|--------|
| System Only (`is_extensible=false`) | All | Superuser | Superuser | Superuser |
| Extensible (`is_extensible=true`) | All | Tenant Admin+ | Own Items | Superuser |

### System-Only Lists

These lists are locked to prevent accidental modification:
- `po_status` (Purchase Order statuses)
- `so_status` (Sales Order statuses)
- `invoice_status` (Invoice statuses)

To modify system-only lists, you must be a superuser.

### Tenant Extensions

Tenants can add items to extensible lists:
1. New items are marked with `tenant` field set
2. Tenant items only appear for that tenant
3. System items appear for all tenants

---

## Troubleshooting

### Common Issues

#### "Permission denied" when editing a list

**Cause**: The list is marked as non-extensible (system-only).

**Solution**:
- Contact a superuser to make changes
- Or mark the list as extensible (superuser only)

#### Changes not appearing in dropdowns

**Cause**: Browser or API cache.

**Solution**:
1. Clear browser cache
2. Hard refresh (`Ctrl+Shift+R`)
3. Or call `configService.clearCache()` in console

#### Import fails with "Invalid JSON"

**Cause**: Malformed JSON data.

**Solution**:
- Validate JSON at [jsonlint.com](https://jsonlint.com)
- Ensure it's an array: `[{...}, {...}]`
- Check for trailing commas

#### CSV import creates wrong values

**Cause**: Incorrect header row.

**Solution**:
- Header must be exactly: `value,label,order,is_active,is_default`
- Boolean values: `true` or `false` (lowercase)

### Cache Statistics

Check cache performance in browser console:

```javascript
import { getCacheStats } from '@/services/configService';
console.log(getCacheStats());

// Output:
// {
//   choiceListsCached: 14,
//   hits: 127,
//   misses: 3,
//   hitRate: "97.7%"
// }
```

### Getting Help

1. Check this documentation
2. Review error messages in browser console
3. Contact system administrator
4. File a bug report at `/feedback/`

---

## Appendix: API Reference

### Choice Lists API

```
GET    /api/v1/system/choice-lists/           # List all
GET    /api/v1/system/choice-lists/:slug/     # Get by slug
POST   /api/v1/system/choice-lists/           # Create (superuser)
PATCH  /api/v1/system/choice-lists/:slug/     # Update
DELETE /api/v1/system/choice-lists/:slug/     # Delete (superuser)
```

### Config Resolution API

```
GET    /api/v1/system/config/resolve/?key=forms.auto_save_enabled
```

Response:
```json
{
  "key": "forms.auto_save_enabled",
  "value": true,
  "source": "system"
}
```

### Tenant Configs API

```
GET    /api/v1/system/tenant-configs/         # List tenant configs
POST   /api/v1/system/tenant-configs/         # Create config
PATCH  /api/v1/system/tenant-configs/:id/     # Update config
DELETE /api/v1/system/tenant-configs/:id/     # Delete config
```

---

*Document maintained by the ProjectMeats Infrastructure Team.*
