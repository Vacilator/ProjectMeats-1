# MASTER EXECUTION PLAN 2026
## WorkForm System Overhaul - Unified Strategic Roadmap

**Version:** 1.0.0  
**Created:** 2026-02-14  
**Status:** Ready for Execution  
**Scope:** Full System Overhaul (Backend + Frontend + Data Architecture)

---

## Executive Summary

This plan orchestrates a comprehensive overhaul of the WorkForm (Workflow + FormBuilder) system, transforming it into an industry-leading solution. The plan is structured in 7 phases, designed to be executed sequentially to ensure foundational wiring is established before advanced UX features.

**Key Objectives:**
1. Wire existing disconnected components (Shadow State, Task Renderer)
2. Standardize naming conventions (FormProcess, FormStepSingle)
3. Implement dynamic choice engine and virtual schema
4. Fix keyboard shortcut focus traps
5. Build Zapier-style visual variable picker
6. Connect management dashboards to live execution data
7. Implement provider-agnostic email integration (Microsoft Outlook)

---

## Phase 0: Discovery & Audit

### 0.1 Repository Audit Results

#### Backend Overlap Analysis: `shared_apps/` vs `apps/system/`

| shared_apps/system_config/ | apps/system/ | Status | Action |
|---------------------------|--------------|--------|--------|
| `models.py` (basic config) | `models/system_choice.py` | **SUPERSEDED** | Archive after migration |
| `engine.py` (config engine) | `models/tenant_config.py` | **SUPERSEDED** | Archive after migration |
| `serializers.py` | `serializers.py`, `workform_serializers.py` | **SUPERSEDED** | Archive after migration |
| `views.py` | `views.py`, `workform_views.py` | **SUPERSEDED** | Archive after migration |

**Files to Archive:**
- [ ] `backend/shared_apps/system_config/models.py`
- [ ] `backend/shared_apps/system_config/engine.py`
- [ ] `backend/shared_apps/system_config/serializers.py`
- [ ] `backend/shared_apps/system_config/views.py`
- [ ] `backend/shared_apps/system_config/admin.py`

**Migration Required:** Extract any unique logic from `shared_apps/system_config/engine.py` into `apps/system/services/` before archiving.

#### Frontend Component Audit: `FlowEditor/`

| Component | Status | Issues |
|-----------|--------|--------|
| `UnifiedFlowEditor.tsx` | Active | 182KB - needs refactoring, keyboard focus traps |
| `useNodeShadowState.ts` | Active | **DISCONNECTED** - not wired to FormSubmissionModal |
| `TaskRenderer.tsx` | Active | **DISCONNECTED** - not used by FormSubmissionModal |
| `useWorkflowContext.ts` | Active | **DISCONNECTED** - not initialized in modal |
| `NodeConfigPanelWithShadow.tsx` | Active | **UNDERUTILIZED** - not replacing legacy panel |
| `FormMultiStepContainerNode.tsx` | Active | **RENAME TARGET** → FormProcessNode.tsx |
| `FormStepNode.tsx` | Active | **RENAME TARGET** → FormStepSingleNode.tsx |

---

### 0.2 Renaming Map

#### Database Models (Django)

| Current Name | New Name | Files Affected |
|--------------|----------|----------------|
| N/A (node type string) | `form_process` | `tenant_workform.py` (workflow_definition JSON) |
| N/A (node type string) | `form_step_single` | `tenant_workform.py` (workflow_definition JSON) |

**Note:** No database model rename needed - these are node type strings in JSON. Migration will update existing JSON data.

#### API Serializers

| File | Changes Required |
|------|------------------|
| `workform_serializers.py` | Update node type validation, add aliases for backward compatibility |
| `serializers.py` | No changes needed |

#### React Components

| Current File | New File | Exports to Update |
|--------------|----------|-------------------|
| `FormMultiStepContainerNode.tsx` | `FormProcessNode.tsx` | `FormProcessNode` |
| `FormStepNode.tsx` | `FormStepSingleNode.tsx` | `FormStepSingleNode` |
| `FormMultiStepContainerModal.tsx` | `FormProcessModal.tsx` | `FormProcessModal` |
| `nodes/index.ts` | Update exports | All node exports |
| `nodeTypes.ts` | Update registry | `formProcess`, `formStepSingle` |

#### Node Type Registry Updates (`nodeTypes.ts`)

```typescript
// BEFORE
formMultiStepContainer: { id: 'formMultiStepContainer', name: 'Multi-Step Form Container', ... }
formStep: { id: 'formStep', name: 'Form Step', ... }

// AFTER
formProcess: { id: 'formProcess', name: 'Form Process', description: 'Container of multiple Form Steps', ... }
formStepSingle: { id: 'formStepSingle', name: 'Form Step', description: 'Single form step', ... }
```

---

### 0.3 Integration Wire-Up Specification

#### Target: Connect Shadow State to FormSubmissionModal

**Current State:**
- `useNodeShadowState.ts` exists but is only used in `UnifiedFlowEditor.tsx`
- `FormSubmissionModal.tsx` uses legacy linear stepper
- `TaskRenderer.tsx` exists but is not imported by FormSubmissionModal

**Required Changes:**

1. **FormSubmissionModal.tsx** (Lines ~150-300):
```typescript
// ADD: Import TaskRenderer and workflow context
import { TaskRenderer } from './TaskRenderer';
import { useWorkflowContext } from './hooks/useWorkflowContext';

// ADD: Initialize workflow context (inside component)
const workflowContext = useWorkflowContext(workflowNodes, currentNodeId);

// REPLACE: Legacy stepper with TaskRenderer
// OLD: <LegacyStepperComponent steps={steps} currentStep={currentStep} />
// NEW: <TaskRenderer node={currentNode} context={workflowContext} onComplete={handleStepComplete} />
```

2. **UnifiedFlowEditor.tsx** (Lines ~100, ~4200):
```typescript
// REPLACE: NodeConfigPanel with NodeConfigPanelWithShadow
// OLD: import { NodeConfigPanel } from './ConfigPanel';
// NEW: Already imported - ensure it's used in renderConfigPanel()
```

3. **SidePanel.tsx** (Lines ~50-100):
```typescript
// ADD: Shadow state dirty indicator
// ADD: Apply/Discard buttons when isDirty === true
```

---

### 0.4 Keyboard Shortcut Focus Trap Analysis

**Problem:** Delete/Backspace keys delete nodes even when user is typing in input fields.

**Root Cause:** `UnifiedFlowEditor.tsx` line 3676:
```typescript
if ((event.key === 'Delete' || event.key === 'Backspace') && 
    event.target === document.body) {  // <-- This check is insufficient
```

**Issue:** When focus is on the React Flow canvas but user clicks into a config panel input, `event.target` may still be `document.body` due to focus management.

**Fix Required:**
```typescript
// REPLACE with comprehensive check
const isTypingInInput = (event: KeyboardEvent): boolean => {
  const target = event.target as HTMLElement;
  const tagName = target.tagName.toLowerCase();
  const isEditable = target.isContentEditable;
  const isInput = ['input', 'textarea', 'select'].includes(tagName);
  const isInConfigPanel = target.closest('[data-config-panel]') !== null;
  return isInput || isEditable || isInConfigPanel;
};

if ((event.key === 'Delete' || event.key === 'Backspace') && !isTypingInInput(event)) {
  // ... delete logic
}
```

**Files Affected:**
- `UnifiedFlowEditor.tsx` - Main keyboard handler
- `BaseNode.tsx` - Title editing (already handles this correctly)

---

## Phase 1: Integration Fix (HIGH PRIORITY)

### Objective
Wire existing Shadow State and Task Renderer to the main FormSubmissionModal.

### Tasks

- [ ] **1.1** Create shim for legacy forms without workflow_definition
  - If form has no `workflow_definition`, treat `steps` array as single-path linear graph
  - File: `frontend/src/components/FormSubmission/utils/legacyShim.ts`

- [ ] **1.2** Update FormSubmissionModal to use TaskRenderer
  - Import `TaskRenderer` component
  - Import `useWorkflowContext` hook
  - Replace legacy stepper with TaskRenderer
  - File: `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`

- [ ] **1.3** Initialize WorkflowContext in UnifiedFlowEditor
  - Ensure `useWorkflowContext` manages data flow between nodes using graph edges
  - File: `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

- [ ] **1.4** Replace NodeConfigPanel with NodeConfigPanelWithShadow
  - Enable unsaved change buffering
  - Add dirty state indicator to sidebar
  - File: `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

- [ ] **1.5** Update SidePanel with Apply/Discard buttons
  - Show buttons when `isDirty === true`
  - Connect to `commitShadow()` and `discardShadow()` functions
  - File: `frontend/src/components/FlowEditor/SidePanel.tsx`

### Acceptance Criteria
- [ ] Forms without workflow_definition continue to work
- [ ] TaskRenderer correctly routes nodes to appropriate renderers
- [ ] Shadow state changes show dirty indicator
- [ ] Apply button commits changes, Discard reverts

---

## Phase 2: Naming & Hygiene

### Objective
Rename nodes to "Form Process" and "Form Step Single", archive dead code.

### Tasks

- [ ] **2.1** Create Django data migration for JSON updates
  - Update `workflow_definition` JSON in `TenantWorkForm` table
  - Replace `formMultiStepContainer` → `formProcess`
  - Replace `formStep` → `formStepSingle`
  - Preserve all other node data
  - File: `backend/apps/system/migrations/XXXX_rename_node_types.py`

- [ ] **2.2** Rename React components
  - `FormMultiStepContainerNode.tsx` → `FormProcessNode.tsx`
  - `FormStepNode.tsx` → `FormStepSingleNode.tsx`
  - `FormMultiStepContainerModal.tsx` → `FormProcessModal.tsx`
  - Update all imports

- [ ] **2.3** Update nodeTypes.ts registry
  - Add new entries: `formProcess`, `formStepSingle`
  - Add backward-compatible aliases for old names
  - Update descriptions and labels

- [ ] **2.4** Implement onNodesDelete ghost node logic
  - When FormProcess is deleted, decrement `usage_count` via API
  - Prevent orphaned container references
  - File: `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

- [ ] **2.5** Archive superseded shared_apps files
  - Move `backend/shared_apps/system_config/` to `backend/archived/`
  - Update any remaining imports
  - Document migration in CHANGELOG

- [ ] **2.6** Update all documentation
  - Update `docs/WORKFORMS_USER_GUIDE.md`
  - Update `docs/WORKFORMS_DEVELOPER_GUIDE.md`
  - Update inline code comments

### Acceptance Criteria
- [ ] All existing workflows load correctly after migration
- [ ] New workflows use new node type names
- [ ] Old node type names still work (backward compatibility)
- [ ] No console errors or warnings about missing components

---

## Phase 3: Data Architecture

### Objective
Implement Dynamic Choice Engine and Virtual Schema (tenant-level fields).

### Tasks

- [ ] **3.1** Seed default SystemChoiceLists for meat industry
  - `protein_types`: Beef, Pork, Poultry, Seafood, Lamb, Veal, Game, Plant-Based
  - `packaging_types`: Fresh, Frozen, Vacuum-Sealed, MAP, Cryovac, Bulk
  - `processing_grades`: Prime, Choice, Select, Standard, Commercial, Utility
  - `cut_types`: Primal, Subprimal, Retail, Ground, Portion
  - File: `backend/apps/system/management/commands/seed_choice_lists.py`

- [ ] **3.2** Create TenantChoiceOverride model
  - Allow tenants to add custom items to system lists
  - Support disabling system items per tenant
  - File: `backend/apps/system/models/tenant_choice_override.py`

- [ ] **3.3** Create TenantFieldDefinition model
  - Allow admins to add virtual fields to models (Customer, Product, Supplier)
  - Support field types: text, select, date, number, checkbox
  - File: `backend/apps/system/models/tenant_field_definition.py`

- [ ] **3.4** Add custom_data JSONField to TenantAwareModel
  - Base class for all tenant-aware models
  - Store virtual field values
  - File: `backend/tenant_apps/core/models.py` or appropriate base

- [ ] **3.5** Create API endpoints for choice management
  - `GET /api/system/choices/{slug}/` - Get list with tenant overrides
  - `POST /api/system/choices/{slug}/items/` - Add tenant item
  - `PATCH /api/system/choices/{slug}/items/{id}/` - Update tenant item
  - File: `backend/apps/system/views.py`

- [ ] **3.6** Create frontend ChoiceListEditor component
  - Admin UI to manage system and tenant choices
  - File: `frontend/src/components/Admin/ChoiceListEditor.tsx`

### Acceptance Criteria
- [ ] Default meat industry choices seeded and visible
- [ ] Tenants can add custom items without affecting system defaults
- [ ] Virtual fields appear in entity forms
- [ ] API returns merged system + tenant choices

---

## Phase 4: Editor UX

### Objective
Fix keyboard shortcuts and build Visual Variable Picker (Zapier-style).

### Tasks

- [ ] **4.1** Fix keyboard shortcut focus traps
  - Implement `isTypingInInput()` helper function
  - Update all keyboard handlers to use it
  - Add `data-config-panel` attribute to config panels
  - File: `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

- [ ] **4.2** Create VariablePicker component
  - Popover triggered by `{{` in text fields
  - Shows available variables from previous nodes
  - Groups by node with search
  - File: `frontend/src/components/FlowEditor/ConfigPanel/VariablePicker.tsx`

- [ ] **4.3** Create ExpressionInput component
  - Text input that renders variables as styled chips
  - Supports click-to-insert from VariablePicker
  - File: `frontend/src/components/FlowEditor/ConfigPanel/ExpressionInput.tsx`

- [ ] **4.4** Refactor FieldMappingPanel to use ExpressionInput
  - Replace plain text inputs with ExpressionInput
  - Show variable chips inline
  - File: `frontend/src/components/FlowEditor/ConfigPanel/FieldMappingPanel.tsx`

- [ ] **4.5** Build Node Debugger tab
  - Allow users to input mock JSON context
  - Execute single node's backend logic
  - Display result preview before saving
  - File: `frontend/src/components/FlowEditor/panels/NodeDebuggerPanel.tsx`

- [ ] **4.6** Add ContextBubble to TaskRenderer
  - Show available context variables during execution
  - Expandable panel showing inherited data
  - File: `frontend/src/components/FormSubmission/ContextBubble.tsx` (already exists, enhance)

### Acceptance Criteria
- [ ] Delete/Backspace don't delete nodes when typing in inputs
- [ ] `{{` triggers variable picker in supported fields
- [ ] Variables display as chips, not raw text
- [ ] Node debugger shows execution preview

---

## Phase 5: Dashboard Connectivity

### Objective
Connect Catalog, Tasks, and History pages to live WorkForm execution data.

### Tasks

- [ ] **5.1** Update Catalog.tsx with tabbed view
  - Tab 1: Workflows (TenantWorkForm)
  - Tab 2: Reusable Forms (TenantForm with is_template=true)
  - Add "Usage Count" column
  - File: `frontend/src/pages/WorkForms/Catalog.tsx`

- [ ] **5.2** Connect MyTasks.tsx to WorkflowExecution table
  - Fetch from `/api/workflows/executions/?status=in_progress&assigned_to=me`
  - Show "Resume" button for in-progress tasks
  - Display current step indicator
  - File: `frontend/src/pages/MyTasks/MyTasks.tsx`

- [ ] **5.3** Create WorkflowExecution model (if not exists)
  - Track execution state, current node, context data
  - Link to TenantWorkForm and User
  - File: `backend/tenant_apps/workflows/models.py`

- [ ] **5.4** Update History.tsx with audit log view
  - Show completed workflow runs
  - Expandable row with step-by-step audit trail
  - Filter by workflow, user, date range
  - File: `frontend/src/pages/WorkForms/History.tsx`

- [ ] **5.5** Create execution API endpoints
  - `GET /api/workflows/executions/` - List executions
  - `POST /api/workflows/executions/` - Start new execution
  - `PATCH /api/workflows/executions/{id}/` - Update execution state
  - `GET /api/workflows/executions/{id}/audit/` - Get audit trail
  - File: `backend/tenant_apps/workflows/views.py`

- [ ] **5.6** Add InProgress.tsx page improvements
  - Real-time status updates (polling or WebSocket)
  - Progress percentage based on node completion
  - File: `frontend/src/pages/WorkForms/InProgress.tsx`

### Acceptance Criteria
- [ ] Catalog shows both workflows and reusable forms
- [ ] MyTasks shows resumable in-progress workflows
- [ ] History shows completed runs with audit trail
- [ ] All pages fetch from live API (not mock data)

---

## Phase 6: Microsoft Outlook Integration

### Objective
Implement provider-agnostic email integration starting with Microsoft Outlook.

### Tasks

- [ ] **6.1** Create EmailProvider interface
  - Abstract base class for email providers
  - Methods: `send_email()`, `get_auth_url()`, `exchange_code()`, `refresh_token()`
  - File: `backend/apps/integrations/providers/base.py`

- [ ] **6.2** Create ExternalAuthProvider model
  - Store encrypted OAuth tokens per tenant
  - Support multiple provider types (microsoft, google, etc.)
  - Include token refresh logic
  - File: `backend/apps/integrations/models.py`

- [ ] **6.3** Implement MicrosoftGraphProvider
  - OAuth2 flow for Microsoft Graph API
  - Scopes: `Mail.Send`, `Mail.ReadWrite`, `User.Read`
  - File: `backend/apps/integrations/providers/microsoft.py`

- [ ] **6.4** Create OutlookEmailNode logic
  - Send emails via Graph API using authenticated context
  - Support templates with variable substitution
  - File: `backend/tenant_apps/workflows/nodes/outlook_email.py`

- [ ] **6.5** Create OAuth callback views
  - Handle Microsoft OAuth redirect
  - Store tokens securely
  - File: `backend/apps/integrations/views.py`

- [ ] **6.6** Create frontend OAuth connection UI
  - "Connect Microsoft Account" button in settings
  - Show connection status
  - File: `frontend/src/pages/Settings/IntegrationSettings.tsx`

- [ ] **6.7** Add OutlookEmailNode to flow editor
  - Node type in registry
  - Config panel for email composition
  - File: `frontend/src/components/FlowEditor/nodes/OutlookEmailNode.tsx`

### Acceptance Criteria
- [ ] Tenant admins can connect Microsoft account
- [ ] OutlookEmailNode available in flow editor
- [ ] Emails sent successfully via Graph API
- [ ] Token refresh works automatically
- [ ] Architecture supports future providers (Gmail, AWS SES)

---

## Implementation Order & Dependencies

```
Phase 0 (Discovery)
    │
    ▼
Phase 1 (Integration Fix) ──────────────────────┐
    │                                           │
    ▼                                           │
Phase 2 (Naming & Hygiene) ◄────────────────────┤
    │                                           │
    ├───────────────┬───────────────┐           │
    ▼               ▼               ▼           │
Phase 3         Phase 4         Phase 5         │
(Data)          (Editor UX)     (Dashboard)     │
    │               │               │           │
    └───────────────┴───────────────┘           │
                    │                           │
                    ▼                           │
              Phase 6 (Outlook) ◄───────────────┘
```

**Critical Path:** Phase 0 → Phase 1 → Phase 2 → (Phase 3, 4, 5 parallel) → Phase 6

---

## Risk Mitigation

### High-Risk Items

1. **Database Migration (Phase 2.1)**
   - Risk: Data loss during JSON field updates
   - Mitigation: Create backup before migration, test on staging first

2. **Keyboard Shortcut Changes (Phase 4.1)**
   - Risk: Breaking existing keyboard navigation
   - Mitigation: Comprehensive testing matrix, user feedback period

3. **OAuth Token Storage (Phase 6.2)**
   - Risk: Security vulnerability if tokens exposed
   - Mitigation: Use Django's encrypted fields, never log tokens

### Rollback Plan

Each phase includes a rollback checkpoint:
- Phase 1: Revert to legacy stepper if TaskRenderer fails
- Phase 2: Keep backward-compatible aliases indefinitely
- Phase 3: Virtual fields are additive, no destructive changes
- Phase 4: Keyboard changes can be toggled via feature flag
- Phase 5: Dashboard changes are read-only, no data risk
- Phase 6: OAuth connection is opt-in per tenant

---

## Success Metrics

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| Form completion time | Unknown | -30% | 1, 4 |
| Config panel usability | 3/5 | 4.5/5 | 1, 4 |
| Node type consistency | 60% | 100% | 2 |
| Choice list customization | 0 | 100% | 3 |
| Dashboard data accuracy | Partial | 100% | 5 |
| Email integration | None | Full | 6 |

---

## Appendix A: File Change Summary

### Backend Files to Create
- `backend/apps/system/migrations/XXXX_rename_node_types.py`
- `backend/apps/system/models/tenant_choice_override.py`
- `backend/apps/system/models/tenant_field_definition.py`
- `backend/apps/system/management/commands/seed_choice_lists.py`
- `backend/apps/integrations/` (new app)
- `backend/tenant_apps/workflows/nodes/outlook_email.py`

### Backend Files to Modify
- `backend/apps/system/models/__init__.py`
- `backend/apps/system/serializers.py`
- `backend/apps/system/views.py`
- `backend/tenant_apps/workflows/models.py`
- `backend/tenant_apps/workflows/views.py`

### Frontend Files to Create
- `frontend/src/components/FormSubmission/utils/legacyShim.ts`
- `frontend/src/components/FlowEditor/ConfigPanel/VariablePicker.tsx`
- `frontend/src/components/FlowEditor/ConfigPanel/ExpressionInput.tsx`
- `frontend/src/components/FlowEditor/panels/NodeDebuggerPanel.tsx`
- `frontend/src/components/FlowEditor/nodes/FormProcessNode.tsx`
- `frontend/src/components/FlowEditor/nodes/FormStepSingleNode.tsx`
- `frontend/src/components/FlowEditor/nodes/OutlookEmailNode.tsx`
- `frontend/src/pages/Settings/IntegrationSettings.tsx`

### Frontend Files to Modify
- `frontend/src/components/FormSubmission/FormSubmissionModal.tsx`
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`
- `frontend/src/components/FlowEditor/SidePanel.tsx`
- `frontend/src/components/FlowEditor/nodes/index.ts`
- `frontend/src/components/FlowEditor/nodeTypes.ts`
- `frontend/src/components/FlowEditor/ConfigPanel/FieldMappingPanel.tsx`
- `frontend/src/pages/WorkForms/Catalog.tsx`
- `frontend/src/pages/WorkForms/History.tsx`
- `frontend/src/pages/MyTasks/MyTasks.tsx`

### Files to Archive
- `backend/shared_apps/system_config/*` → `backend/archived/shared_apps_system_config/`

---

## Appendix B: Django Migration Template (Phase 2.1)

```python
# backend/apps/system/migrations/XXXX_rename_node_types.py
from django.db import migrations
import json

def rename_node_types_forward(apps, schema_editor):
    """Rename formMultiStepContainer → formProcess, formStep → formStepSingle"""
    TenantWorkForm = apps.get_model('system', 'TenantWorkForm')
    
    for workform in TenantWorkForm.objects.all():
        if not workform.workflow_definition:
            continue
        
        definition = workform.workflow_definition
        nodes = definition.get('nodes', [])
        modified = False
        
        for node in nodes:
            if node.get('type') == 'formMultiStepContainer':
                node['type'] = 'formProcess'
                modified = True
            elif node.get('type') == 'formStep':
                node['type'] = 'formStepSingle'
                modified = True
        
        if modified:
            workform.workflow_definition = definition
            workform.save(update_fields=['workflow_definition'])

def rename_node_types_reverse(apps, schema_editor):
    """Reverse: formProcess → formMultiStepContainer, formStepSingle → formStep"""
    TenantWorkForm = apps.get_model('system', 'TenantWorkForm')
    
    for workform in TenantWorkForm.objects.all():
        if not workform.workflow_definition:
            continue
        
        definition = workform.workflow_definition
        nodes = definition.get('nodes', [])
        modified = False
        
        for node in nodes:
            if node.get('type') == 'formProcess':
                node['type'] = 'formMultiStepContainer'
                modified = True
            elif node.get('type') == 'formStepSingle':
                node['type'] = 'formStep'
                modified = True
        
        if modified:
            workform.workflow_definition = definition
            workform.save(update_fields=['workflow_definition'])

class Migration(migrations.Migration):
    dependencies = [
        ('system', 'XXXX_previous_migration'),  # Update this
    ]
    
    operations = [
        migrations.RunPython(
            rename_node_types_forward,
            rename_node_types_reverse,
        ),
    ]
```

---

## Appendix C: Keyboard Focus Fix (Phase 4.1)

```typescript
// frontend/src/components/FlowEditor/utils/keyboardUtils.ts

/**
 * Check if user is currently typing in an input element
 * Used to prevent keyboard shortcuts from interfering with text entry
 */
export const isTypingInInput = (event: KeyboardEvent): boolean => {
  const target = event.target as HTMLElement;
  
  // Check tag name
  const tagName = target.tagName.toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) {
    return true;
  }
  
  // Check contentEditable
  if (target.isContentEditable) {
    return true;
  }
  
  // Check if inside config panel
  if (target.closest('[data-config-panel]')) {
    return true;
  }
  
  // Check if inside modal
  if (target.closest('[data-modal]')) {
    return true;
  }
  
  // Check for Monaco editor
  if (target.closest('.monaco-editor')) {
    return true;
  }
  
  return false;
};

/**
 * Keys that should be blocked when typing
 */
export const TYPING_BLOCKED_KEYS = ['Delete', 'Backspace', 'Tab'];

/**
 * Safe keyboard handler wrapper
 */
export const createSafeKeyboardHandler = (
  handler: (event: KeyboardEvent) => void
) => {
  return (event: KeyboardEvent) => {
    // Allow typing in inputs
    if (TYPING_BLOCKED_KEYS.includes(event.key) && isTypingInInput(event)) {
      return; // Don't call handler, let browser handle it
    }
    
    handler(event);
  };
};
```

---

## Next Steps

1. **Review this plan** and confirm scope alignment
2. **Create feature branch** from `development`
3. **Begin Phase 1** with integration fixes
4. **Run tests** after each phase
5. **Create PR** to `development` when phase complete

**Estimated Timeline:** 4-6 weeks for full implementation (phases can run in parallel after Phase 2)
