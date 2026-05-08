# Quick Actions User Guide

## Overview

Quick Actions provides instant access to frequently-used forms and workflows directly from the top navbar. Tenant users can run custom forms in less than 3 clicks without navigating to the full Workflow Editor.

---

## Accessing Quick Actions

1. **Location**: Top navbar → Lightning bolt icon (⚡)
2. **Click** to open dropdown menu
3. **Expandable Sections**:
   - Custom Quick Actions (if configured)
   - **Forms** (always visible)

---

## Running Forms from Navbar

### Step-by-Step

1. Click **⚡ Quick Actions** in top navbar
2. Click **Forms** to expand submenu
3. Published forms appear with Play buttons (▶️)
4. Click **any form name** or Play button
5. FormRunnerModal opens pre-filled with tenant context
6. Fill out form fields
7. Click **Submit**
8. Success toast appears with execution ID

### Features

- **Up to 5 forms** shown directly in dropdown
- **"+X more" indicator** if more than 5 forms exist
- **"View All Workflows"** link for full workflow management
- **Automatic tenant context** (no manual selection needed)
- **Data inheritance** from upstream variables (if applicable)

---

## Empty State

If no published forms exist:
- Submenu shows: *"No published forms yet"*
- Admins can publish forms via Workflow Editor:
  1. Go to `/workflows`
  2. Edit any form/workflow
  3. Set **Status: Published**
  4. Save

---

## Published Forms Criteria

Forms appear in Quick Actions if:
- ✅ **Status**: `published` (not `draft` or `archived`)
- ✅ **Tenant**: Current tenant only
- ✅ **Type**: Form or FormProcessGroup node types
- ✅ **Permissions**: User has `view_workflow` permission

---

## Technical Details

### API Endpoint
```
GET /api/v1/workflows/forms/?published=true&tenant=true
```

### Form Submission
```
POST /api/v1/workflows/form-submissions/
{
  "form_id": "uuid",
  "data": {...},
  "tenant_id": "uuid"
}
```

### Context Integration
- Uses `QuickActionsContext` for state management
- Reuses existing `FormRunnerModal` component
- Automatic refresh on form publish/unpublish events

---

## Troubleshooting

### Forms Not Appearing

**Problem**: Click Forms → "No published forms yet"

**Solutions**:
1. Verify form status is `published` (not `draft`)
2. Check user has `view_workflow` permission
3. Confirm form belongs to current tenant
4. Hard-refresh browser (Ctrl/Cmd + Shift + R)

### Form Fails to Open

**Problem**: Click form → nothing happens or error toast

**Solutions**:
1. Check browser console for errors
2. Verify API endpoint: `/api/v1/workflows/form-submissions/`
3. Confirm user is authenticated (check localStorage.authToken)
4. Check backend logs for 404/500 errors

### Submission Hangs

**Problem**: Click Submit → loading spinner forever

**Solutions**:
1. Check backend API is running
2. Verify tenant isolation (form belongs to user's tenant)
3. Check for validation errors in form fields
4. Inspect Network tab for failed POST request

---

## Related Documentation

- **Workflow Editor**: `docs/WORKFORMS_USER_GUIDE.md`
- **Development**: `docs/WORKFORMS_DEVELOPER_GUIDE.md`
- **API Reference**: `docs/api/workflows.md`
- **SDLC Playbook**: (to be created)

---

**Last Updated**: 2026-02-21
**Feature Status**: ✅ Production Ready
