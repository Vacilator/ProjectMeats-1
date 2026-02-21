# Node Configuration System Overhaul

**Version:** 2.0.0  
**Created:** 2026-02-17 21:13 UTC  
**Updated:** 2026-02-17 21:13 UTC  
**Status:** 🚀 IN PROGRESS  
**Priority:** 🔴 CRITICAL  
**Scope:** Complete Node Configuration Overhaul (4 Phases, ~16-22 days)

---

## 🎯 Problem Statement

The current node configuration system has critical issues preventing proper workflow editor functionality:

1. **Entity Loading**: Business entities (Supplier, Customer, Product, etc.) don't display in configuration dropdowns
2. **Form Process Grouping**: Lacks true visual containment - needs React Flow sub-flows pattern for child nodes
3. **No Cascading Fields**: Entity selection doesn't automatically populate and cascade fields to child nodes
4. **Static Configurations**: Configuration options are hardcoded instead of being context-aware and dynamic

**Impact:** Without working node configurations, the workflow editor is essentially **non-functional** for creating real workflows.

---

## ✅ User Requirements (Confirmed 2026-02-17)

### Form Process Node Requirements
- [x] **Visual container** with child nodes rendered inside (React Flow sub-flows pattern)
- [x] **Step ordering** (1, 2, 3...) for explicit execution sequence
- [x] **Drag-into behavior** to easily add child nodes to the process
- [x] **Step management UI** to reorder, add, and configure steps
- [x] **Configuration modes:**
  - Create new form process
  - Reuse existing form process (auto-creates "[Name] Copy" if modified)
  - Allow skipping steps
  - Allow submitting without all steps completed
  - Advanced navigation settings (back, skip, auto-advance, confirm exit)
- [x] **No entity at Form Process level** - Form Process only encapsulates child nodes

### Form Single Step Node Requirements
- [x] **Entity selection first** - Choose business entity (Supplier, Customer, Product, etc.)
- [x] **Field picker** displays fields available from selected entity
- [x] **User selects** which entity fields to include in the form step
- [x] **Selected fields** become available as variables for downstream nodes

### Dynamic Configuration Requirements
- [x] **Context-aware** based on node type (different configs per node)
- [x] **Context-aware** based on position in workflow (parent/child relationships)
- [x] **Entity-filtered fields** - Only show fields from selected entity
- [x] **Upstream variables** - Variables from previous nodes available for mapping
- [x] **Validation rules** that adapt based on selected entity

---

## 📊 Progress Tracking

### Overall Progress: 0% Complete (0/4 phases)

| Phase | Status | Progress | Est. Days | Actual Days | Started | Completed |
|-------|--------|----------|-----------|-------------|---------|-----------|
| **A** - Fix Entity Loading | ⬜ NOT STARTED | 0% (0/3) | 2-3 | - | - | - |
| **B** - Form Process Overhaul | ⬜ NOT STARTED | 0% (0/5) | 5-7 | - | - | - |
| **C** - Cascading Field System | ⬜ NOT STARTED | 0% (0/4) | 4-5 | - | - | - |
| **D** - Dynamic Config Engine | ⬜ NOT STARTED | 0% (0/5) | 5-7 | - | - | - |

**Legend:** ⬜ Not Started | 🟡 In Progress | ✅ Complete | ❌ Blocked

---

## 📋 PHASE A: Fix Entity Loading (2-3 days)
**Priority:** 🔴 CRITICAL - Nothing works without this  
**Status:** ⬜ NOT STARTED  
**Progress:** 0% (0/3 sub-tasks)

### Why This Is Critical
Without entity loading, users cannot:
- Select which business entity (Customer, Product, etc.) a form step creates/updates
- See available fields for that entity
- Configure field mappings
- Create functional workflows

This is the **foundation** - all other phases depend on this working.

---

### A.1 Backend Verification (Backend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 0.5 day

#### Tasks
- [ ] Test `/api/v1/system/entities/` endpoint with curl/Postman
  - Verify 200 response with list of entities
  - Check tenant context is properly applied
  - Confirm entity metadata structure matches frontend expectations
- [ ] Test `/api/v1/system/entities/{id}/fields/` endpoint
  - Verify field metadata includes: name, label, type, required, choices
  - Check for proper error handling on invalid entity ID
- [ ] Review `entity_introspection.py` tenant_apps list
  - Ensure all tenant_apps are included (suppliers, customers, products, etc.)
  - Add missing apps if needed
- [ ] Verify authentication/permissions
  - Ensure endpoints require authentication
  - Check tenant isolation is enforced

**Files:**
- `backend/apps/system/services/entity_introspection.py`
- `backend/apps/system/views.py`

**Acceptance Criteria:**
- ✅ API returns 8+ business entities (suppliers, customers, products, etc.)
- ✅ Each entity has: id, label, label_plural, field_count
- ✅ Fields endpoint returns correct metadata for each entity
- ✅ Tenant isolation is enforced (users only see their tenant's data)

---

### A.2 Frontend Entity Loading (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Debug `useEntityList()` React Query hook
  - Add console.log to verify API is being called
  - Check network tab for request/response
  - Verify staleTime and gcTime settings
- [ ] Add comprehensive error handling
  - Show loading spinner while fetching
  - Display user-friendly error message on failure
  - Provide retry button
- [ ] Implement fallback to `COMMON_ENTITY_TYPES`
  - If API fails, use hardcoded entity list
  - Log warning to console
  - Show indicator that offline mode is active
- [ ] Test in FormStepConfigPanel
  - Verify dropdown populates with entities
  - Check selecting entity triggers field loading
  - Ensure UI updates correctly on loading/error states

**Files:**
- `frontend/src/services/schemaService.ts`
- `frontend/src/components/FlowEditor/ConfigPanel/FormStepConfigPanel.tsx`

**Acceptance Criteria:**
- ✅ Entity dropdown shows all available entities
- ✅ Loading state displays spinner/skeleton
- ✅ Error state shows clear message with retry option
- ✅ Fallback entities load if API unavailable

---

### A.3 Entity Field Loading (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 0.5-1 day

#### Tasks
- [ ] Debug `useEntityFields()` React Query hook
  - Verify hook is called when entity is selected
  - Check enabled condition is correct
  - Confirm field data structure matches expectations
- [ ] Enhance field metadata display
  - Add field type icons (📝 text, 🔢 number, 📅 date, etc.)
  - Show required indicator (*)
  - Display help text/description
  - Show choices for select fields
- [ ] Add field filtering and search
  - Filter by field type (text, number, date, etc.)
  - Search by field name
  - Sort alphabetically
- [ ] Test field loading flow
  - Select entity → verify fields load
  - Change entity → verify fields update
  - Handle entity with no fields gracefully

**Files:**
- `frontend/src/services/schemaService.ts`
- `frontend/src/components/FlowEditor/ConfigPanel/EntityFieldPicker.tsx`
- `frontend/src/components/FlowEditor/ConfigPanel/FormStepConfigPanel.tsx`

**Acceptance Criteria:**
- ✅ Fields load automatically when entity is selected
- ✅ Field metadata displays correctly (type, required, help text)
- ✅ Field icons match field types
- ✅ User can filter and search fields

---

### Phase A Acceptance Criteria (All Sub-tasks)
- ✅ Entity API endpoints verified and working
- ✅ Entity dropdown populates correctly in all config panels
- ✅ Fields load and display when entity is selected
- ✅ Error handling provides clear feedback
- ✅ Fallback mechanism works if API unavailable

---

## 📋 PHASE B: Form Process Container Overhaul (5-7 days)
**Priority:** 🔴 HIGH  
**Status:** ⬜ NOT STARTED  
**Progress:** 0% (0/5 sub-tasks)  
**Reference Examples:**
- https://reactflow.dev/examples/grouping/parent-child-relation
- https://reactflow.dev/examples/grouping/sub-flows

### Why This Matters
Form Process nodes need to be true **visual containers** where child nodes render inside the parent, creating a clear hierarchical structure for multi-step forms.

Current implementation uses `parentId` but lacks visual containment and step management.

---

### B.1 Visual Container Implementation (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 2-3 days

#### Tasks
- [ ] Study React Flow sub-flows example
  - Understand parent-child positioning
  - Learn container sizing and bounds
  - Review expand/collapse patterns
- [ ] Implement visual containment
  - Child nodes render inside expanded Form Process
  - Container has dashed border to show bounds
  - Child nodes use relative positioning to parent
  - Container auto-resizes based on children
- [ ] Add expand/collapse animation
  - Smooth transition when expanding/collapsing
  - Preserve child node positions during collapse
  - Animate container size changes
- [ ] Visual boundary indicators
  - Dashed border when expanded
  - Semi-transparent background
  - Drop zone highlight when dragging over

**Files:**
- `frontend/src/components/FlowEditor/nodes/FormProcessNode.tsx` (MAJOR UPDATE)
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Child nodes are visually contained inside parent
- ✅ Container boundary is clearly visible
- ✅ Smooth expand/collapse animation
- ✅ Container auto-resizes with children

---

### B.2 Step Ordering System (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Add `stepIndex` property to child node data
  - Store as integer (1, 2, 3...)
  - Auto-increment when adding new child
  - Preserve on reorder
- [ ] Display step numbers on Form Single Steps
  - Show in header (e.g., "Step 1: Customer Info")
  - Badge with step number
  - Visual connection lines between steps
- [ ] Implement execution order logic
  - Workflow engine follows stepIndex order
  - Validate no duplicate step numbers
  - Handle gaps in sequence
- [ ] Reorder functionality
  - Drag within container to reorder
  - Update stepIndex on drop
  - Re-render step numbers

**Files:**
- `frontend/src/components/FlowEditor/nodes/FormStepSingleNode.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/nodes/FormProcessNode.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Step numbers display on child nodes
- ✅ Steps can be reordered via drag
- ✅ Execution follows stepIndex order
- ✅ Step numbers update after reorder

---

### B.3 Drag-Into Behavior (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1-2 days

#### Tasks
- [ ] Detect drop target when dragging over Form Process
  - Use React Flow `onNodeDragOver` event
  - Check if dropped node is over container bounds
  - Distinguish between dragging into vs dragging past
- [ ] Visual feedback for drop zones
  - Highlight container border when valid drop target
  - Show insertion point indicator
  - Animate container to show it can accept drop
- [ ] Handle drop event
  - Set `parentId` to Form Process node ID
  - Assign next available `stepIndex`
  - Position relative to parent container
  - Snap to grid inside container
- [ ] Validation rules
  - Only allow compatible node types (Form Single Step, Condition, Wait)
  - Prevent infinite nesting (no container inside container)
  - Show error if invalid drop

**Files:**
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/nodes/FormProcessNode.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Container highlights when dragging compatible node over it
- ✅ Dropped node becomes child with correct parentId
- ✅ Step number auto-assigned
- ✅ Invalid drops are prevented with clear feedback

---

### B.4 Step Management UI (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1-2 days

#### Tasks
- [ ] Create StepManagerPanel component
  - Sidebar panel or modal
  - Lists all child nodes in stepIndex order
  - Shows step number, name, and type
- [ ] Drag to reorder steps
  - Drag handle on each step row
  - Visual placeholder during drag
  - Update stepIndex on drop
- [ ] Quick actions
  - Add new step button (opens node palette)
  - Edit step (opens config panel)
  - Delete step (with confirmation)
  - Duplicate step
- [ ] Step status indicators
  - Configured vs not configured
  - Required fields missing
  - Validation errors
- [ ] Inline editing
  - Edit step name inline
  - Toggle step required/optional
  - Set step visibility conditions

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/StepManagerPanel.tsx` (NEW)
- `frontend/src/components/FlowEditor/Modals/FormProcessModal.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Step Manager shows all child nodes
- ✅ Steps can be reordered via drag
- ✅ Quick actions work correctly
- ✅ Step status is clearly visible

---

### B.5 Form Process Configuration (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Mode selector: Create New vs Use Existing
  - Radio buttons or tabs
  - Different form fields for each mode
- [ ] "Use Existing" mode
  - Dropdown of existing form processes
  - Load selected form process structure
  - If user modifies: auto-rename to "[Original Name] Copy"
- [ ] "Create New" mode
  - Name input (required)
  - Description textarea
- [ ] Advanced settings section
  - Allow skipping steps (toggle)
  - Allow partial submission (toggle)
  - Show progress indicator (toggle)
  - Allow back navigation (toggle)
  - Auto-advance on completion (toggle)
  - Require confirmation on exit (toggle)
- [ ] Settings explanations
  - Help text for each toggle
  - Examples of use cases
  - Warning for risky settings

**Files:**
- `frontend/src/components/FlowEditor/Modals/FormProcessModal.tsx` (MAJOR UPDATE)
- `frontend/src/components/FlowEditor/ConfigPanel/FormProcessConfigPanel.tsx` (NEW)

**Acceptance Criteria:**
- ✅ User can create new or reuse existing form process
- ✅ Modified existing process creates "[Name] Copy"
- ✅ All advanced settings are configurable
- ✅ Settings have clear help text

---

### Phase B Acceptance Criteria (All Sub-tasks)
- ✅ Form Process is a true visual container
- ✅ Child nodes render inside parent bounds
- ✅ Step ordering system works correctly
- ✅ Drag-into behavior is intuitive
- ✅ Step management UI is functional
- ✅ Configuration options are complete

---

## 📋 PHASE C: Cascading Field System (4-5 days)
**Priority:** 🔴 HIGH  
**Status:** ⬜ NOT STARTED  
**Progress:** 0% (0/4 sub-tasks)

### Why This Matters
When a user selects a business entity (e.g., "Customer"), the system should automatically:
1. Fetch all fields for that entity
2. Let user pick which fields to include in the form
3. Make those fields available as variables for downstream nodes
4. Enable field mapping from form to actions (Create Record, Update Record, etc.)

This creates the **data flow** through the workflow.

---

### C.1 Entity-to-Fields Cascade (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Auto-fetch fields when entity selected
  - Trigger `useEntityFields()` on entity change
  - Show loading state during fetch
  - Handle errors gracefully
- [ ] Populate field picker with entity fields
  - Display in sortable list
  - Group by field type (text, number, date, etc.)
  - Show field metadata (type icon, required, help text)
- [ ] Field filtering
  - Filter by field type dropdown
  - Search by field name
  - "Required fields only" toggle
- [ ] Field preview
  - Show how field will render in form
  - Display validation rules
  - Show default value

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/FormStepConfigPanel.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/ConfigPanel/EntityFieldPicker.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Fields auto-load when entity is selected
- ✅ User can filter and search fields
- ✅ Field metadata is clearly displayed

---

### C.2 Field Selection UI (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1-2 days

#### Tasks
- [ ] Create FieldSelectionPanel component
  - Checkbox list of available entity fields
  - Selected fields highlighted
  - Drag handle for reordering
- [ ] Drag to reorder selected fields
  - Visual drag placeholder
  - Update order in node data
  - Affects form render order
- [ ] Field properties editor
  - Override field label
  - Toggle required/optional
  - Set default value
  - Add validation rules
  - Set conditional visibility
- [ ] Quick actions
  - "Select All" button
  - "Clear All" button
  - "Select Required Only" button
  - Field count indicator
- [ ] Field preview
  - Show how field will appear in form
  - Update in real-time as properties change

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/FieldSelectionPanel.tsx` (NEW)
- `frontend/src/components/FlowEditor/ConfigPanel/FormStepConfigPanel.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/ConfigPanel/FieldConfigurationPanel.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ User can select which entity fields to include
- ✅ Fields can be reordered via drag
- ✅ Field properties are editable
- ✅ Quick actions work correctly

---

### C.3 Upstream Variable Propagation (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1-2 days

#### Tasks
- [ ] Build graph traversal function
  - Find all upstream nodes from current node
  - Extract output fields from each Form Single Step
  - Include variables from previous actions
  - Handle branching paths (multiple upstream nodes)
- [ ] Create useUpstreamVariables hook
  - Takes current node ID
  - Returns available variables from upstream
  - Groups by source node
  - Includes type information
- [ ] Enhance VariablePicker component
  - Show upstream variables grouped by node
  - Format as `{{nodeId.fieldName}}`
  - Type icons for each variable
  - Search/filter functionality
  - Click to insert into text field
- [ ] Type-aware suggestions
  - Only suggest compatible types for field mapping
  - String, number, date, boolean, etc.
  - Show incompatible types but with warning

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/VariablePicker.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/hooks/useUpstreamVariables.ts` (NEW)
- `frontend/src/components/FlowEditor/utils/graphTraversal.ts` (NEW)

**Acceptance Criteria:**
- ✅ Upstream variables are correctly identified
- ✅ Variables are available in VariablePicker
- ✅ Type information is accurate
- ✅ User can easily insert variables

---

### C.4 Field Mapping for Actions (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Enhance FieldMappingPanel component
  - Visual drag-and-drop field mapping
  - Source field (left) → Target field (right)
  - Type compatibility indicators
  - Transformation options (uppercase, lowercase, format date, etc.)
- [ ] Auto-suggest field mappings
  - Match by field name similarity
  - Match by field type
  - Show confidence score
  - "Apply All Suggested" button
- [ ] Update Create Record config
  - Map form fields to entity fields
  - Show required entity fields clearly
  - Validate all required fields are mapped
  - Support default values for unmapped fields
- [ ] Update Update Record config
  - Similar to Create Record
  - Show which entity is being updated
  - Support partial updates
- [ ] Update Send Email config
  - Map form fields to email subject/body
  - Support variable substitution in templates
  - Preview email with sample data

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/FieldMappingPanel.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/ConfigPanel/CreateRecordConfigPanel.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/ConfigPanel/OutlookEmailConfigPanel.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Field mapping is visual and intuitive
- ✅ Auto-suggestions work correctly
- ✅ Required fields are clearly indicated
- ✅ Type mismatches show warnings

---

### Phase C Acceptance Criteria (All Sub-tasks)
- ✅ Entity selection cascades to field list
- ✅ User can select and configure fields
- ✅ Fields become available as upstream variables
- ✅ Field mapping works for all action nodes
- ✅ Type safety is enforced

---

## 📋 PHASE D: Dynamic Configuration Engine (5-7 days)
**Priority:** 🟡 MEDIUM  
**Status:** ⬜ NOT STARTED  
**Progress:** 0% (0/5 sub-tasks)

### Why This Matters
Node configurations should be **intelligent** and **context-aware**:
- Show different options based on node type
- Adapt based on workflow position (parent/child, upstream nodes)
- Conditionally show/hide fields based on other selections
- Validate inputs based on context

This makes configuration **intuitive** and reduces errors.

---

### D.1 Node Type Configuration Registry (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 2 days

#### Tasks
- [ ] Create config schema system
  - Define JSON schema for each node type
  - Specify sections, fields, validation rules
  - Support conditional field logic
- [ ] Build config registry
  - Map node type → config schema
  - Support inheritance (base config + node-specific)
  - Version schemas for backward compatibility
- [ ] Implement conditional fields
  - Show/hide based on other field values
  - Enable/disable based on conditions
  - Dynamic options loaded from context
- [ ] Create config field components
  - Text input, number input, select, checkbox, toggle
  - Date picker, color picker, file upload
  - Multi-select, tag input, rich text
  - Custom components for complex configs

**Files:**
- `frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts` (NEW)
- `frontend/src/components/FlowEditor/config/configFieldTypes.ts` (NEW)
- `frontend/src/components/FlowEditor/config/configRegistry.ts` (NEW)

**Acceptance Criteria:**
- ✅ Config schemas are defined for all node types
- ✅ Conditional field logic works correctly
- ✅ Custom field components render properly

---

### D.2 Context-Aware Configuration Panel (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1-2 days

#### Tasks
- [ ] Detect node context
  - Is node standalone or inside Form Process?
  - What is node's position in workflow (first, middle, end)?
  - What upstream nodes exist?
  - What downstream nodes exist?
- [ ] Adapt configuration options
  - Show "Parent Process" info if inside Form Process
  - Hide options that don't apply to current context
  - Show warnings for invalid combinations
- [ ] Section visibility
  - Collapse irrelevant sections
  - Highlight important sections for current state
  - Show context-specific help text
- [ ] Dynamic option loading
  - Load dropdown options from API based on context
  - Filter options based on permissions
  - Show recently used options first

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/DynamicConfigPanel.tsx` (NEW)
- `frontend/src/components/FlowEditor/ConfigPanel/NodeConfigPanelWithShadow.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/hooks/useNodeContext.ts` (NEW)

**Acceptance Criteria:**
- ✅ Node context is correctly detected
- ✅ Configuration adapts to context
- ✅ Irrelevant options are hidden
- ✅ Dynamic options load correctly

---

### D.3 Conditional Configuration Fields (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Implement condition system
  - When field A = X, show field B
  - When field A = Y, hide field B, show field C
  - Support AND/OR logic
  - Support nested conditions
- [ ] Real-time UI updates
  - React immediately to field changes
  - Smooth show/hide animations
  - Preserve hidden field values
- [ ] Condition validation
  - Prevent circular dependencies
  - Validate condition syntax
  - Show warnings for complex conditions
- [ ] Debug mode
  - Show which conditions are active
  - Display condition evaluation results
  - Help troubleshoot config issues

**Files:**
- `frontend/src/components/FlowEditor/config/conditionalLogic.ts` (NEW)
- `frontend/src/components/FlowEditor/ConfigPanel/DynamicConfigPanel.tsx` (UPDATE)

**Acceptance Criteria:**
- ✅ Conditional fields show/hide correctly
- ✅ UI updates are smooth and immediate
- ✅ Conditions are validated
- ✅ Debug mode helps troubleshooting

---

### D.4 Validation Rules Engine (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1-2 days

#### Tasks
- [ ] Built-in validation rules
  - Required field validation
  - Type validation (number, email, URL, date, etc.)
  - Range validation (min/max)
  - Pattern validation (regex)
  - Length validation (min/max length)
- [ ] Custom validation rules
  - Entity-specific rules from backend
  - Business logic validation
  - Cross-field validation (field A > field B)
  - Async validation (check if value exists in DB)
- [ ] Validation UI
  - Show errors inline below field
  - Error summary at top of config panel
  - Visual indicators (red border, error icon)
  - Helpful error messages with suggestions
- [ ] Validation timing
  - Validate on blur (after user leaves field)
  - Validate on submit
  - Optional: validate on change (for critical fields)
- [ ] Error recovery
  - Clear errors when user corrects input
  - Show success indicator after correction
  - Prevent save until all errors resolved

**Files:**
- `frontend/src/components/FlowEditor/ConfigPanel/ValidationRuleBuilder.tsx` (UPDATE)
- `frontend/src/components/FlowEditor/config/validationEngine.ts` (NEW)
- `frontend/src/components/FlowEditor/config/validationRules.ts` (NEW)

**Acceptance Criteria:**
- ✅ Required fields are validated
- ✅ Type validation works correctly
- ✅ Custom validation rules can be added
- ✅ Errors are displayed clearly
- ✅ User can easily correct errors

---

### D.5 Configuration Presets (Frontend)
**Status:** ⬜ NOT STARTED  
**Estimated:** 1 day

#### Tasks
- [ ] Save current config as preset
  - "Save as Preset" button
  - Name and description for preset
  - Store in backend or localStorage
  - Associate with node type
- [ ] Load preset
  - "Load Preset" dropdown in config panel
  - Preview preset before applying
  - Apply preset to current node
  - Merge with existing config or replace
- [ ] Preset management
  - List all presets for node type
  - Edit preset (update existing)
  - Delete preset (with confirmation)
  - Share preset with team (export/import JSON)
- [ ] Default presets
  - System-provided presets for common use cases
  - "New Customer Form" preset
  - "Sales Order Entry" preset
  - "Email Notification" preset
- [ ] Preset versioning
  - Track preset version
  - Migrate old presets to new schema
  - Show warning if preset is outdated

**Files:**
- `frontend/src/components/FlowEditor/config/configPresets.ts` (NEW)
- `frontend/src/services/workflowConfigService.ts` (NEW)
- `frontend/src/components/FlowEditor/ConfigPanel/PresetSelector.tsx` (NEW)

**Acceptance Criteria:**
- ✅ User can save config as preset
- ✅ Presets can be loaded and applied
- ✅ Preset management works correctly
- ✅ Default presets are available

---

### Phase D Acceptance Criteria (All Sub-tasks)
- ✅ Config schemas are defined for all node types
- ✅ Context-aware configuration works correctly
- ✅ Conditional fields show/hide as expected
- ✅ Validation rules are enforced
- ✅ Configuration presets are usable

---

## 🎯 Success Metrics

### Functional Metrics
- [ ] Entity dropdown loads successfully in 100% of cases
- [ ] Form Process contains child nodes visually
- [ ] Step ordering is clear and editable
- [ ] Drag-into behavior is intuitive (95%+ success rate)
- [ ] Field cascading works for all entity types
- [ ] Variable picker shows all upstream variables
- [ ] Field mapping is accurate (zero mapping errors)
- [ ] Dynamic configs adapt to all contexts correctly

### User Experience Metrics
- [ ] Time to configure a Form Single Step: < 2 minutes
- [ ] Time to create a 3-step Form Process: < 5 minutes
- [ ] User can find needed configuration option in < 30 seconds
- [ ] Zero configuration errors in production workflows

### Technical Metrics
- [ ] Entity API response time: < 200ms
- [ ] Field API response time: < 300ms
- [ ] Config panel render time: < 100ms
- [ ] No console errors during configuration
- [ ] Full test coverage for critical paths

---

## 🚀 Getting Started

### Prerequisites
- Master Execution Plan 2026 completed (✅ 100%)
- Golden Pipeline restored and functional (✅ Verified)
- Sprint 1 (Visual Excellence) completed (✅ PR #2905 merged)
- Development branch up-to-date

### Phase A Kickoff
```bash
# Create feature branch
git checkout development
git pull upstream development
git checkout -b feature/node-config-phase-a-entity-loading

# Verify entity API endpoint
curl -H "Authorization: Token YOUR_TOKEN" \
  http://localhost:8000/api/v1/system/entities/

# If entities don't load, start backend debugging
cd backend
python manage.py shell
>>> from apps.system.services.entity_introspection import get_entity_models
>>> entities = get_entity_models()
>>> print(len(entities))  # Should be 8+

# Frontend debugging
cd frontend
npm run dev
# Open browser console, check for API errors
```

---

## 📝 Implementation Notes

### React Flow Sub-Flows Pattern
Reference: https://reactflow.dev/examples/grouping/sub-flows

Key concepts:
- Parent node has `type: 'group'`
- Child nodes have `parentId` property set to parent node ID
- Child positions are relative to parent
- Parent container auto-resizes based on children
- Use `zIndex` to control layering

### Entity API Design
Endpoints:
- `GET /api/v1/system/entities/` - List all entities
- `GET /api/v1/system/entities/{id}/fields/` - Get fields for entity

Response structure:
```json
{
  "count": 8,
  "results": [
    {
      "id": "suppliers.supplier",
      "app": "suppliers",
      "model": "supplier",
      "label": "Supplier",
      "label_plural": "Suppliers",
      "description": "Supplier entity",
      "field_count": 12
    }
  ]
}
```

### Field Metadata Structure
```json
{
  "entity_id": "suppliers.supplier",
  "field_count": 12,
  "fields": [
    {
      "name": "company_name",
      "label": "Company Name",
      "field_type": "text",
      "is_required": true,
      "help_text": "Legal company name",
      "max_length": 200
    }
  ]
}
```

---

## 🐛 Known Issues & Risks

### Current Blockers
- [ ] Entity API may not be returning data (needs verification)
- [ ] React Query cache may be stale (needs invalidation)
- [ ] Tenant context may not be properly passed to API

### Potential Risks
- **Risk:** Sub-flows pattern is complex and may have edge cases
  - **Mitigation:** Start with simple parent-child, iterate
- **Risk:** Graph traversal for upstream variables may be slow
  - **Mitigation:** Cache results, use memoization
- **Risk:** Dynamic config schemas may become too complex
  - **Mitigation:** Start simple, add complexity only when needed
- **Risk:** Validation rules may conflict with each other
  - **Mitigation:** Clear precedence rules, validation engine

---

## 📚 Related Documentation

- Master Execution Plan: `docs/plans/MASTER_EXECUTION_PLAN_2026.md`
- Enhancement Roadmap: `docs/WORKFLOW_EDITOR_ENHANCEMENT_ROADMAP.md`
- Sprint 1 Report: PR #2905
- Golden Pipeline Docs: `docs/GOLDEN_PIPELINE_RESTORED.md`
- React Flow Docs: https://reactflow.dev/examples/grouping

---

## 📞 Support & Questions

For questions or issues during implementation:
1. Check this plan document first
2. Review React Flow examples
3. Check related PRs (#2891-2895, #2905)
4. Review Master Execution Plan for context

---

**Last Updated:** 2026-02-17 21:13 UTC  
**Next Review:** After Phase A completion  
**Maintained By:** Development Team
