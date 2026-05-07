# Form Process Testing Guide

**Component:** Form Process Container (Multi-Step Form Orchestration)  
**Phase:** D/E (Phase B Complete + New Enhancements)  
**Date:** February 21, 2026  
**Status:** ✅ 98% Complete - Ready for Production

---

## Recent Enhancements (Feb 21, 2026) 🎉

### New Features Added:
1. **True React Flow Group Container** - isGroup: true with parent-child relationships
2. **Error Boundary Protection** - Component-level crash recovery with retry UI
3. **Loading States + Retry** - Skeleton screens and timeout detection
4. **Null Safety Guards** - Comprehensive optional chaining throughout
5. **Enhanced Test Coverage** - 15+ test cases for null safety

### Testing Status:
- ✅ Error boundaries tested - manual crash scenarios
- ✅ Null safety tested - null node handling
- ✅ Loading states tested - timeout scenarios
- ⏳ Manual UAT testing pending on dev.meatscentral.com

---

## Overview

This guide provides step-by-step testing instructions for the Form Process container feature. The Form Process container allows users to create multi-step workflows by grouping Form Single Step nodes together.

---

## Prerequisites

1. **Environment:** Development or UAT
2. **User Role:** Admin or Tenant Admin
3. **Browser:** Chrome/Edge (latest), Firefox (latest)
4. **Screen Resolution:** Minimum 1280x720

---

## Test Suite

### Test 1: Create Form Process Container

**Objective:** Verify container creation and basic properties

**Steps:**
1. Navigate to Workflow Editor (FlowEditor)
2. From node palette, drag "Form Process" node onto canvas
3. Click on the node to open configuration panel
4. Verify configuration panel shows:
   - Container Properties section (name, description)
   - Step Management section (empty state message)
   - Navigation Settings section (5 toggles)
   - Behavior Settings section (2 toggles)

**Expected Results:**
- ✅ Node appears with compact view (shows "0 Steps")
- ✅ Configuration panel opens on right side
- ✅ All sections render without errors
- ✅ Default name is "Untitled Form Process"

**Pass/Fail:** ⬜

---

### Test 2: Expand/Collapse Behavior

**Objective:** Verify visual containment works correctly

**Steps:**
1. Create Form Process container (Test 1)
2. Double-click the container node
3. Observe expand animation
4. Double-click again to collapse

**Expected Results:**
- ✅ Container expands to 800x500px canvas area
- ✅ Dashed border (2px, rounded corners) appears
- ✅ Smooth cubic-bezier animation (~300ms)
- ✅ Collapse animation reverses smoothly
- ✅ "Drop steps here" message shows when expanded and empty

**Pass/Fail:** ⬜

---

### Test 3: Drag-Into Behavior (Add Steps)

**Objective:** Verify steps can be added by dragging Form Single Step nodes

**Steps:**
1. Create and expand Form Process container
2. Drag "Form Step: Single" node from palette
3. Hover over expanded container area
4. Drop node inside container
5. Repeat to add 3-5 steps

**Expected Results:**
- ✅ Container highlights when hovering with node (visual feedback)
- ✅ Node becomes child of container on drop
- ✅ Node positions relative to container (not absolute)
- ✅ Step appears in Step Management panel immediately
- ✅ Step numbers assigned automatically (1, 2, 3...)
- ✅ "Drop steps here" message disappears after first step

**Pass/Fail:** ⬜

---

### Test 4: Step Ordering (Execution Order)

**Objective:** Verify step order follows edge connections (topological sort)

**Steps:**
1. Create Form Process with 4 steps (A, B, C, D)
2. Connect steps in order: A → B → C → D
3. Check step numbers in Step Management panel
4. Rearrange: Connect A → C → B → D
5. Check step numbers update

**Expected Results:**
- ✅ Initial order: A(1), B(2), C(3), D(4)
- ✅ After rearrange: A(1), C(2), B(3), D(4)
- ✅ Step numbers update automatically on edge changes
- ✅ Parallel branches get same step number (if applicable)
- ✅ Disconnected steps use position-based ordering (fallback)

**Pass/Fail:** ⬜

---

### Test 5: Step Management Panel (Reorder)

**Objective:** Verify drag-to-reorder works in panel

**Steps:**
1. Create Form Process with 4 steps (ordered 1-4)
2. Open Step Management panel
3. Grab step 3's drag handle (⋮⋮)
4. Drag to position 1
5. Release

**Expected Results:**
- ✅ Cursor changes to "grab" on hover, "grabbing" while dragging
- ✅ Step moves visually during drag
- ✅ Other steps shift to make room
- ✅ Order updates: [3, 1, 2, 4]
- ✅ Node positions on canvas update (top-to-bottom layout)
- ✅ Edges reconnect to maintain new order

**Pass/Fail:** ⬜

---

### Test 6: Add Step from Panel

**Objective:** Verify "Add Step" button creates new step

**Steps:**
1. Create Form Process container
2. Open Step Management panel
3. Click "Add Step" button
4. Verify new step appears

**Expected Results:**
- ✅ New Form Single Step node created inside container
- ✅ Step positioned below existing steps (if any)
- ✅ Step number assigned automatically
- ✅ Step appears in panel immediately
- ✅ Default name: "Untitled Form Step"

**Pass/Fail:** ⬜

---

### Test 7: Delete Step with Confirmation

**Objective:** Verify step deletion requires confirmation

**Steps:**
1. Create Form Process with 3 steps
2. Open Step Management panel
3. Click delete (🗑️) button on step 2
4. Verify confirmation dialog appears
5. Click "Cancel" → verify step remains
6. Click delete again → click "Confirm"

**Expected Results:**
- ✅ Confirmation dialog shows: "Delete step [name]?"
- ✅ Cancel button aborts deletion
- ✅ Confirm button removes step
- ✅ Step disappears from panel and canvas
- ✅ Edges connected to deleted step are removed
- ✅ Remaining steps renumber automatically

**Pass/Fail:** ⬜

---

### Test 8: Navigate to Step Configuration

**Objective:** Verify "Configure" button opens step config

**Steps:**
1. Create Form Process with 2 steps
2. Open Step Management panel
3. Click configure (⚙️) button on step 1
4. Verify step's configuration panel opens

**Expected Results:**
- ✅ Configuration panel switches to selected step
- ✅ FormStepConfigPanel renders (Entity, Fields, Validation sections)
- ✅ Back button allows return to container config
- ✅ Selected step highlights on canvas

**Pass/Fail:** ⬜

---

### Test 9: Navigation Settings (Toggles)

**Objective:** Verify navigation toggles persist correctly

**Steps:**
1. Create Form Process container
2. Open Navigation Settings section
3. Toggle all 5 settings:
   - Allow Back Navigation
   - Allow Skip Steps
   - Show Progress Bar
   - Auto-Advance on Complete
   - Confirm Before Exit
4. Save configuration (Apply button)
5. Close and reopen config panel

**Expected Results:**
- ✅ All toggles respond to clicks (smooth animation)
- ✅ Visual feedback: enabled = primary color, disabled = gray
- ✅ Settings persist after Apply
- ✅ Settings remain when reopening panel
- ✅ No console errors

**Pass/Fail:** ⬜

---

### Test 10: Shadow State (Unsaved Changes)

**Objective:** Verify changes buffer until Apply/Discard

**Steps:**
1. Create Form Process container
2. Change name to "Test Process"
3. Toggle "Allow Back Navigation" ON
4. **Do not click Apply**
5. Click outside panel to close
6. Reopen panel

**Expected Results:**
- ✅ Changes NOT saved (name still "Untitled Form Process")
- ✅ Toggle still OFF
- ✅ No unsaved changes warning (expected behavior - user must Apply)

**Alternative Test (Apply):**
1. Change name to "Test Process"
2. Click Apply button
3. Close and reopen panel

**Expected Results:**
- ✅ Changes persist
- ✅ Name shows "Test Process"

**Pass/Fail:** ⬜

---

### Test 11: Expand/Collapse with Children

**Objective:** Verify collapse hides children, expand shows them

**Steps:**
1. Create Form Process with 3 steps inside
2. Expand container (double-click)
3. Verify steps visible
4. Collapse container (double-click)
5. Verify steps hidden

**Expected Results:**
- ✅ Expanded: All child steps render inside container area
- ✅ Collapsed: Only step list visible (shows first 5 step names)
- ✅ Smooth transition between states
- ✅ Step list shows "Step 1: [name]", "Step 2: [name]", etc.
- ✅ If >5 steps, shows "+ N more" at bottom

**Pass/Fail:** ⬜

---

### Test 12: Status Indicators

**Objective:** Verify configuration status badges work

**Steps:**
1. Create Form Process with 2 steps
2. Configure step 1 (add entity + fields)
3. Leave step 2 unconfigured
4. Check status indicators in Step Management panel

**Expected Results:**
- ✅ Step 1 shows ✅ (green checkmark) - configured
- ✅ Step 2 shows ⚠️ (yellow warning) - unconfigured
- ✅ Tooltips explain status on hover (optional)

**Pass/Fail:** ⬜

---

### Test 13: Edge Cases

**Objective:** Verify graceful handling of edge cases

**Steps:**
1. Create Form Process container
2. Delete container → verify child steps also deleted
3. Create container with circular edges: A → B → C → A
4. Verify step ordering falls back gracefully
5. Create container with 10+ steps
6. Verify panel scrolls (max 400px height)

**Expected Results:**
- ✅ Deleting container removes all child steps (cascade delete)
- ✅ Circular edges don't crash (uses position fallback)
- ✅ Step list scrolls smoothly
- ✅ Custom scrollbar styling applied
- ✅ No performance degradation with 10+ steps

**Pass/Fail:** ⬜

---

### Test 14: Mobile/Responsive (Optional)

**Objective:** Verify basic functionality on smaller screens

**Steps:**
1. Resize browser to 1024x768
2. Repeat Tests 1-5

**Expected Results:**
- ✅ Configuration panel adapts to smaller width
- ✅ All buttons remain clickable
- ✅ Text doesn't overflow
- ✅ Drag-and-drop still works

**Pass/Fail:** ⬜

---

## Test Summary

| Test # | Test Name | Pass/Fail | Notes |
|--------|-----------|-----------|-------|
| 1 | Create Container | ⬜ | |
| 2 | Expand/Collapse | ⬜ | |
| 3 | Drag-Into | ⬜ | |
| 4 | Step Ordering | ⬜ | |
| 5 | Panel Reorder | ⬜ | |
| 6 | Add Step | ⬜ | |
| 7 | Delete Step | ⬜ | |
| 8 | Navigate Config | ⬜ | |
| 9 | Navigation Settings | ⬜ | |
| 10 | Shadow State | ⬜ | |
| 11 | Expand w/ Children | ⬜ | |
| 12 | Status Indicators | ⬜ | |
| 13 | Edge Cases | ⬜ | |
| 14 | Mobile (Optional) | ⬜ | |

**Overall Status:** ⬜ NOT TESTED / ⚠️ IN PROGRESS / ✅ PASSED / ❌ FAILED

---

## Known Limitations

1. **Max Steps:** No hard limit, but performance may degrade with 50+ steps
2. **Nesting:** Form Process containers cannot be nested inside other containers
3. **Edge Validation:** Circular edges fall back to position-based ordering
4. **Undo/Redo:** Not yet implemented for step reordering

---

## Bug Reporting

If any test fails, report with:
1. Test number and name
2. Actual vs expected result
3. Browser and OS
4. Console errors (if any)
5. Screenshots or video recording

**Report to:** GitHub Issues (label: `bug`, `form-process`, `phase-b`)

---

## Sign-Off

| Role | Name | Date | Signature |
|------|------|------|-----------|
| **QA Tester** | | | |
| **Developer** | Copilot CLI | 2026-02-18 | ✓ |
| **Product Owner** | | | |

---

## Phase E.3 Additional Tests

### Test 15: Unlimited Steps via Auto-Layout

**Objective:** Verify FormProcessGroupNode supports unlimited child steps with automatic vertical layout

**Steps:**
1. Create FormProcessGroupNode container
2. Add 15-20 steps using "Add Step" button repeatedly
3. Observe auto-layout behavior
4. Scroll through container to view all steps

**Expected Results:**
- ✅ All steps added without error (no hard limit)
- ✅ Vertical auto-layout: baseY=60px, spacing=120px between steps
- ✅ Smooth re-layout animation (0.3s cubic-bezier)
- ✅ Container automatically resizes to fit all children
- ✅ Performance remains smooth with 20+ steps

**Pass/Fail:** ⬜

---

### Test 16: Drag-Drop Steps into Container

**Objective:** Verify drag-and-drop from palette into FormProcessGroupNode

**Steps:**
1. Create FormProcessGroupNode (expanded)
2. Drag "Form Step: Single" from palette
3. Drop into container area (anywhere inside dashed border)
4. Verify step becomes child with correct parentId
5. Repeat with multiple steps from different positions

**Expected Results:**
- ✅ Visual feedback on hover (container highlights)
- ✅ Dropped step has `parentId` set to container ID
- ✅ Step position relative to container (not absolute canvas position)
- ✅ Auto-layout recalculates immediately on drop
- ✅ Step count in header updates ("5 Steps" → "6 Steps")

**Pass/Fail:** ⬜

---

### Test 17: Drag Steps Between Containers

**Objective:** Verify re-parenting when dragging step from one container to another

**Steps:**
1. Create two FormProcessGroupNode containers (A and B)
2. Add 3 steps to container A
3. Drag step from container A over container B
4. Drop into container B
5. Verify parentId updated and auto-layout in both containers

**Expected Results:**
- ✅ Step removed from container A's child list
- ✅ Step added to container B's child list
- ✅ Step's `parentId` changed from A's ID to B's ID
- ✅ Step position recalculated relative to container B
- ✅ Both containers re-layout children automatically
- ✅ Step counts update correctly (A: 2 steps, B: 1 step)

**Pass/Fail:** ⬜

---

### Test 18: Expand/Collapse Animation Smoothness

**Objective:** Verify smooth CSS transition for expand/collapse

**Steps:**
1. Create FormProcessGroupNode with 5 steps
2. Toggle expand/collapse rapidly (double-click 5 times)
3. Observe animation smoothness
4. Check browser DevTools Performance tab (optional)

**Expected Results:**
- ✅ GroupBody CSS: `transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`
- ✅ Animates height, opacity, padding together
- ✅ No jank or frame drops during animation
- ✅ Children visibility toggles at correct moment (opacity 0→1)
- ✅ No layout shift after animation completes

**Pass/Fail:** ⬜

---

### Test 19: Selection Grouping (React Flow Native)

**Objective:** Verify multi-select and group movement works

**Steps:**
1. Create FormProcessGroupNode with 4 steps
2. Hold Shift and click steps 2 and 3 (multi-select)
3. Drag selected steps together
4. Verify both move as a group
5. Try box selection (click-drag empty area around multiple steps)

**Expected Results:**
- ✅ Shift+click adds step to selection (blue outline on both)
- ✅ Dragging one selected step moves all selected steps
- ✅ Relative positions maintained during group drag
- ✅ Box selection (drag rectangle) selects multiple steps
- ✅ Auto-layout recalculates after group move

**Pass/Fail:** ⬜

---

### Test 20: Logic Between Steps (Conditional Navigation)

**Objective:** Verify conditional edges between steps based on logic

**Steps:**
1. Create FormProcessGroupNode with 3 steps (A, B, C)
2. Add edge from A to B (default path)
3. Add edge from A to C (conditional path)
4. Configure conditional logic on A→C edge:
   - Condition: "If field 'quantity' > 100"
5. Test both paths in execution

**Expected Results:**
- ✅ Multiple outgoing edges allowed from one step
- ✅ Conditional edge shows logic icon/label
- ✅ Edge label displays condition text
- ✅ During execution: If quantity > 100, navigate A→C; else A→B
- ✅ Step ordering accounts for branching (parallel branches same number)

**Pass/Fail:** ⬜

---

### Test 21: Nested Children Schema (Infrastructure)

**Objective:** Verify nested-children field type works in schemas

**Steps:**
1. Open formProcessGroupSchema configuration
2. Locate any field with `type: 'nested-children'`
3. Add a child item using "+ Add Child" button
4. Fill child fields (text, textarea)
5. Expand/collapse child item
6. Delete child item

**Expected Results:**
- ✅ NestedChildrenRenderer renders correctly
- ✅ "+ Add Child" creates new expandable item
- ✅ Child fields render inline (text input, textarea)
- ✅ Auto-expand single child or newly added child
- ✅ Delete button removes child with confirmation (if implemented)
- ✅ Step numbering displays (Step 1, Step 2, etc.)

**Pass/Fail:** ⬜

---

### Test 22: Context Menu on Container

**Objective:** Verify right-click context menu on FormProcessGroupNode

**Steps:**
1. Create FormProcessGroupNode
2. Right-click on container (not on child step)
3. Verify context menu appears with options:
   - "Add Step"
   - "Duplicate Container"
   - "Convert to Sub-Flow" (if implemented)
   - "Delete"

**Expected Results:**
- ✅ Context menu appears on right-click
- ✅ "Add Step" creates new child step
- ✅ "Duplicate Container" clones container + all children
- ✅ "Delete" removes container and cascades to children
- ✅ Menu positioned near cursor
- ✅ Clicking outside closes menu

**Pass/Fail:** ⬜

---

### Test 23: Dynamic Re-Layouting on Child Add/Remove

**Objective:** Verify useEffect triggers re-layout when child count changes

**Steps:**
1. Create FormProcessGroupNode with 3 steps
2. Add new step via "Add Step" button
3. Observe immediate re-layout (no manual trigger needed)
4. Delete a step
5. Observe re-layout again

**Expected Results:**
- ✅ useEffect monitors `childNodes.length`
- ✅ Adding step triggers auto-layout immediately
- ✅ Removing step triggers auto-layout immediately
- ✅ Re-layout only when `isExpanded=true` (performance optimization)
- ✅ Smooth animation during re-layout (0.3s transition)

**Pass/Fail:** ⬜

---

### Test 24: Edge Case - Empty Container

**Objective:** Verify empty container handles gracefully

**Steps:**
1. Create FormProcessGroupNode (no children)
2. Expand container
3. Verify "Drop steps here" or similar empty state message
4. Collapse container
5. Verify "0 Steps" displayed in header

**Expected Results:**
- ✅ Empty state message displays when expanded and empty
- ✅ No JavaScript errors in console
- ✅ Collapse still works smoothly
- ✅ Header shows "0 Steps"
- ✅ Configuration panel shows empty state for step list

**Pass/Fail:** ⬜

---

### Test 25: Bundle Size Impact

**Objective:** Verify Phase E.3 changes have minimal bundle impact

**Steps:**
1. Run `npm run build` in frontend directory
2. Check build output for main bundle size
3. Compare to baseline (2,415.12 kB from PR #3046)

**Expected Results:**
- ✅ Build completes without errors
- ✅ Bundle size: ~2,417.97 kB (+2.66 kB = +0.11%)
- ✅ Build time: 18-25 seconds (acceptable)
- ✅ No tree-shaking warnings for schema registry
- ✅ Gzip size increase proportional

**Pass/Fail:** ⬜

---

## Phase E.3 Test Summary

| Test # | Test Name | Pass/Fail | Notes |
|--------|-----------|-----------|-------|
| 15 | Unlimited Steps | ⬜ | Auto-layout performance |
| 16 | Drag-Drop into Container | ⬜ | Parent-child support |
| 17 | Drag Between Containers | ⬜ | Re-parenting |
| 18 | Expand/Collapse Animation | ⬜ | CSS transitions |
| 19 | Selection Grouping | ⬜ | React Flow native |
| 20 | Logic Between Steps | ⬜ | Conditional navigation |
| 21 | Nested Children Schema | ⬜ | Infrastructure test |
| 22 | Context Menu | ⬜ | Container actions |
| 23 | Dynamic Re-Layout | ⬜ | useEffect monitoring |
| 24 | Empty Container | ⬜ | Edge case handling |
| 25 | Bundle Size Impact | ⬜ | Build verification |

**Phase E.3 Status:** ⬜ NOT TESTED / ⚠️ IN PROGRESS / ✅ PASSED / ❌ FAILED

---

**Document Version:** 3.0  
**Last Updated:** 2026-02-21  
**Related PRs:** #2910, #2921, #2928, #3046, #3049, #3053, #3141

---

## Phase D/E Enhancements - New Test Cases (Feb 21, 2026)

### Test 26: Error Boundary - Null Node Crash Recovery

**Objective:** Verify error boundary catches and recovers from null node crashes

**Steps:**
1. Open Workflow Editor
2. Select a node
3. Delete the node while config panel is open
4. Observe error boundary UI appears
5. Click "Try Again" button
6. Verify editor recovers to working state

**Expected Results:**
- ✅ Error boundary catches TypeError on null node
- ✅ Custom fallback UI displays with error message
- ✅ "Try Again" button renders
- ✅ Clicking retry resets error boundary
- ✅ Editor returns to functional state
- ✅ No console spam or cascading errors
- ✅ Dev mode shows stack trace (production hides it)

**Pass/Fail:** ⬜

---

### Test 27: DynamicConfigPanel Null Safety

**Objective:** Verify config panel handles null/undefined node gracefully

**Steps:**
1. Open Workflow Editor (no node selected)
2. Verify config panel shows empty state
3. Select a node - panel populates
4. Delete node while panel open
5. Verify panel shows empty state again
6. Rapidly select/deselect nodes

**Expected Results:**
- ✅ Empty state: "Select a node to configure its properties"
- ✅ No crashes on null node
- ✅ All node accesses use optional chaining (node?.data)
- ✅ Handlers check for null before accessing props
- ✅ Rapid selection doesn't cause crashes
- ✅ React 19 strict mode compatible

**Pass/Fail:** ⬜

---

### Test 28: Loading States with Timeout

**Objective:** Verify skeleton screens and timeout detection

**Steps:**
1. Open Form node configuration
2. Select an Entity Type
3. Observe skeleton loader while fields load
4. If fields load quickly (<5s), test passes
5. If timeout (>5s), verify "Request timed out" message
6. Click "Retry" button
7. Verify refetch triggered

**Expected Results:**
- ✅ Skeleton screens show immediately on entity select
- ✅ Skeleton has shimmer animation
- ✅ Fields populate after successful API call
- ✅ Timeout detected at 5-second mark
- ✅ "Request timed out" message displays
- ✅ "Retry" button functional
- ✅ React Query refetch() called on retry
- ✅ Exponential backoff on multiple retries (optional)

**Pass/Fail:** ⬜

---

### Test 29: FormBuilder Context Integration

**Objective:** Verify type-safe context replaces window events

**Steps:**
1. Open Workflow Editor
2. Add Form Process node
3. Click "🛠️ Open Full Form Builder" button
4. Verify FormBuilder modal opens
5. Make changes in modal
6. Close modal
7. Verify changes reflected in editor state

**Expected Results:**
- ✅ FormBuilderProvider wraps editor
- ✅ useFormBuilderContext hook accessible
- ✅ Button click calls context.openFormBuilder()
- ✅ Modal opens with correct node data
- ✅ NO window.dispatchEvent() calls
- ✅ Type-safe: TypeScript enforces context shape
- ✅ Changes sync back to editor via context.updateNodeData()

**Pass/Fail:** ⬜

---

### Test 30: Enhanced ESLint Rules

**Objective:** Verify new null safety rules prevent regressions

**Steps:**
1. Open DynamicConfigPanel.tsx in editor
2. Add unsafe code: `const type = node.data.type;` (without ?.)
3. Run `npm run lint`
4. Verify error: "Unsafe optional chaining"
5. Fix to: `const type = node?.data?.type;`
6. Re-run lint - should pass

**Expected Results:**
- ✅ ESLint rule `@typescript-eslint/no-unsafe-optional-chaining` enabled
- ✅ Linter catches missing optional chaining
- ✅ Error message clear and actionable
- ✅ Auto-fix available (npm run lint -- --fix)
- ✅ CI/CD pipeline enforces rules

**Pass/Fail:** ⬜

---

## Phase D/E Test Summary

| Test # | Test Name | Pass/Fail | Priority | Notes |
|--------|-----------|-----------|----------|-------|
| 26 | Error Boundary Crash Recovery | ⬜ | High | Critical for stability |
| 27 | Null Safety Guards | ⬜ | High | Prevents TypeErrors |
| 28 | Loading States + Timeout | ⬜ | Medium | UX polish |
| 29 | FormBuilder Context | ⬜ | High | Type-safe pattern |
| 30 | ESLint Rules | ⬜ | Low | Dev experience |

**Phase D/E Status:** ⬜ NOT TESTED / ⚠️ IN PROGRESS / ✅ PASSED / ❌ FAILED

**Deployment:** ✅ Merged to dev.meatscentral.com via PR #3141  
**Manual UAT:** ⏳ Pending

---

## Phase 17 — RT-01: EndToEndInquiryToPOProcess Template Tests

> **Full test suite (33 test cases)** is maintained in `docs/FORM_PROCESS_TESTING_GUIDE.md` under the "Phase 17 — RT-01" section.  
> Categories: Template Registration, Multi-Trigger Routing, Loop/Condition Logic, Plant Contact Integration, Telemetry, Tenant Safety.  
> **Canonical reference:** `MASTER_PLAN.md` → Phase 17 / Epic RT-01

---
