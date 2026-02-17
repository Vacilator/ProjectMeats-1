# Multi-Step Container Quick Reference

**Full Plan**: [MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md](./MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md)  
**Status**: ⏳ Ready for Execution  
**Last Updated**: 2026-02-08

---

## 🎯 Quick Stats

- **Duration**: 2-3 days (16-24 hours)
- **Phases**: 8 phases, 45 tasks
- **Priority**: HIGH
- **Progress**: 0% complete

---

## 📋 Phase Checklist

### ✅ Phase 1: Foundation (2-3 hours)
- [ ] 1.1 Replace `findContainerAtPosition()` with `getIntersectingNodes()`
- [ ] 1.2 Add visual feedback (green border on hover)
- [ ] 1.3 Auto-expand collapsed containers on drag
- [ ] 1.4 Fix `onDrop` to set `parentNode` relationship
- [ ] 1.5 Add debug logging

**Test**: Nodes drop into containers successfully

---

### ✅ Phase 2: Architecture (2-3 hours)
- [ ] 2.1 Remove `data.childNodes` array
- [ ] 2.2 Update `updateContainerStats()` to query via `parentNode`
- [ ] 2.3 Refactor `MiniReactFlow` to render from main state
- [ ] 2.4 Update `FormMultiStepContainerNode` to pass container ID
- [ ] 2.5 Ensure deletion works
- [ ] 2.6 Handle drag out of container

**Test**: Container uses React Flow native parent-child system

---

### ✅ Phase 3: Layout Engine (3-4 hours)
- [ ] 3.1 Create `autoLayoutContainerNodes()` function
- [ ] 3.2 Implement horizontal layout (250px spacing)
- [ ] 3.3 Add `order` metadata to steps
- [ ] 3.4 Implement vertical layout for actions
- [ ] 3.5 Handle multiple actions per step
- [ ] 3.6 Trigger on drop/reorder/delete
- [ ] 3.7 Add smooth transitions (optional)

**Test**: Nodes auto-arrange horizontally and vertically

---

### ✅ Phase 4: Auto-Connection (2-3 hours)
- [ ] 4.1 Create `autoConnectSequentialSteps()` function
- [ ] 4.2 Query and sort form steps left-to-right
- [ ] 4.3 Remove old auto-edges
- [ ] 4.4 Create sequential edges (mark with `data.auto = true`)
- [ ] 4.5 Connect actions to parent steps
- [ ] 4.6 Preserve manual branching
- [ ] 4.7 Trigger on drop/reorder/delete

**Test**: Form steps auto-connect sequentially

---

### ✅ Phase 5: Reordering (3-4 hours)
- [ ] 5.1 Enhance `onNodeDragStop` for intra-container reordering
- [ ] 5.2 Calculate insertion point by x-position
- [ ] 5.3 Update node order metadata
- [ ] 5.4 Trigger re-layout
- [ ] 5.5 Trigger re-connection
- [ ] 5.6 Add insertion indicator (optional)
- [ ] 5.7 Add undo/redo support

**Test**: Drag nodes between steps to reorder

---

### ✅ Phase 6: Scope Isolation (2-3 hours)
- [ ] 6.1 Implement `validateConnection()` function
- [ ] 6.2 Block child → external connections
- [ ] 6.3 Block external → child connections
- [ ] 6.4 Allow sibling connections
- [ ] 6.5 Add container I/O handles
- [ ] 6.6 Implement "Enter Container" mode
- [ ] 6.7 Add container state management

**Test**: Container acts as isolated scope

---

### ✅ Phase 7: Persistence (4-5 hours)
- [ ] 7.1 Verify `TenantWorkForm` model
- [ ] 7.2 Verify `TenantForm` model
- [ ] 7.3 Add container-to-workform mapping
- [ ] 7.4 Add step-to-form mapping
- [ ] 7.5 Implement `saveContainer()` handler
- [ ] 7.6 Extract form step definitions
- [ ] 7.7 Extract action node definitions
- [ ] 7.8 POST form steps to API
- [ ] 7.9 POST workflow to API
- [ ] 7.10 Implement `loadContainer()` handler

**Test**: Container saves and loads correctly

---

### ✅ Phase 8: UX Polish (3-4 hours)
- [ ] 8.1 Add "Enter Container" button
- [ ] 8.2 Implement container editing context
- [ ] 8.3 Enhance MiniReactFlow thumbnail
- [ ] 8.4 Add container validation
- [ ] 8.5 Add node count/type breakdown
- [ ] 8.6 Add duplication feature
- [ ] 8.7 Add template functionality
- [ ] 8.8 Enhance keyboard shortcuts
- [ ] 8.9 Add undo/redo support
- [ ] 8.10 Add accessibility attributes

**Test**: Production-ready UX with polish

---

## 🔧 Key Functions to Implement

### 1. findContainerAtPosition (Phase 1)
```typescript
// Replace manual bounding box with React Flow API
const targetContainers = reactFlowInstance.getIntersectingNodes({
  x: position.x,
  y: position.y,
  width: 50,
  height: 50
}).filter(n => n.type === 'formMultiStepContainer');
```

### 2. autoLayoutContainerNodes (Phase 3)
```typescript
function autoLayoutContainerNodes(containerId: string, nodes: Node[]): Node[] {
  const childNodes = nodes.filter(n => n.parentNode === containerId);
  const formSteps = childNodes.filter(n => n.type === 'formStep');
  const actions = childNodes.filter(n => n.type !== 'formStep');
  
  // Layout steps horizontally
  formSteps.forEach((step, index) => {
    step.position = {
      x: 50 + (index * 250),
      y: 80
    };
  });
  
  // Layout actions vertically
  // ... (see full plan)
  
  return nodes;
}
```

### 3. autoConnectSequentialSteps (Phase 4)
```typescript
function autoConnectSequentialSteps(
  containerId: string, 
  nodes: Node[], 
  edges: Edge[]
): Edge[] {
  const formSteps = nodes
    .filter(n => n.parentNode === containerId && n.type === 'formStep')
    .sort((a, b) => a.position.x - b.position.x);
  
  const newEdges = [];
  for (let i = 0; i < formSteps.length - 1; i++) {
    newEdges.push({
      id: `auto-${formSteps[i].id}-${formSteps[i + 1].id}`,
      source: formSteps[i].id,
      target: formSteps[i + 1].id,
      data: { auto: true }
    });
  }
  
  return [...nonAutoEdges, ...newEdges];
}
```

### 4. validateConnection (Phase 6)
```typescript
function validateConnection(source: Node, target: Node): boolean {
  // Block child → external
  if (source.parentNode && !target.parentNode) return false;
  
  // Block external → child
  if (!source.parentNode && target.parentNode) return false;
  
  // Block cross-container
  if (source.parentNode !== target.parentNode) return false;
  
  return true; // Allow siblings and external-to-external
}
```

---

## 🎯 Testing Checklist (Critical)

### Phase 1 Tests
- [ ] Drag over container → green border
- [ ] Drop in container → node appears inside
- [ ] Console shows "✅ Position IS INSIDE container-xyz"
- [ ] Node has `parentNode` property

### Phase 2 Tests
- [ ] Container stats correct (no `childNodes` array)
- [ ] MiniReactFlow shows child nodes
- [ ] Add/delete updates stats
- [ ] Drag out removes parent

### Phase 3 Tests
- [ ] 3 steps → x: 50, 300, 550
- [ ] Actions stack below steps (y + 150)
- [ ] No overlapping nodes

### Phase 4 Tests
- [ ] 3 steps → 2 edges (1→2, 2→3)
- [ ] Auto-edges have `data.auto = true`
- [ ] Manual edges preserved

### Phase 5 Tests
- [ ] Drag step 2 to position 1 → reorders
- [ ] Edges update automatically

### Phase 6 Tests
- [ ] Child → external → BLOCKED
- [ ] Sibling → sibling → ALLOWED

### Phase 7 Tests
- [ ] Save creates TenantForm records
- [ ] Load reconstructs container

### Phase 8 Tests
- [ ] "Enter Container" button works
- [ ] All keyboard shortcuts work

---

## 🚨 Common Issues & Solutions

### Issue: "Nodes don't drop into container"
**Solution**: Check Phase 1.1 - verify `getIntersectingNodes()` API is being used

### Issue: "Nodes overlap after drop"
**Solution**: Check Phase 3 - ensure auto-layout is triggered

### Issue: "Edges don't update"
**Solution**: Check Phase 4.7 - ensure auto-connection called after layout

### Issue: "Can't reorder nodes"
**Solution**: Check Phase 5.1 - ensure `onNodeDragStop` detects intra-container drag

### Issue: "Child nodes connect to external"
**Solution**: Check Phase 6.2 - ensure `validateConnection()` is being called

---

## 📁 Files to Modify

**Primary Files**:
1. `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` - Core logic (80% of changes)
2. `frontend/src/components/FlowEditor/nodes/FormMultiStepContainerNode.tsx` - Container node UI
3. `frontend/src/components/FlowEditor/NestedContainer/MiniReactFlow.tsx` - Mini canvas

**Backend Files** (Phase 7 only):
- Verify: `backend/apps/system/models/tenant_form.py`
- Verify: `backend/apps/system/models/tenant_workform.py`

---

## ⏰ Time Estimates

| Phase | Estimated | Running Total |
|-------|-----------|---------------|
| Phase 1 | 2-3h | 2-3h |
| Phase 2 | 2-3h | 4-6h |
| Phase 3 | 3-4h | 7-10h |
| Phase 4 | 2-3h | 9-13h |
| Phase 5 | 3-4h | 12-17h |
| Phase 6 | 2-3h | 14-20h |
| Phase 7 | 4-5h | 18-25h |
| Phase 8 | 3-4h | 21-29h |
| **Total** | **21-29h** | **~3 days** |

---

## 🎓 Key Concepts

### Parent-Child Relationship (React Flow)
```typescript
// Child node
{
  id: 'step-1',
  parentNode: 'container-1', // ✅ Links to parent
  extent: 'parent',           // ✅ Constrained to parent bounds
  position: { x: 50, y: 80 }  // Relative to parent origin
}

// Query children
const children = nodes.filter(n => n.parentNode === 'container-1');
```

### Auto-Edge Marking
```typescript
// Auto-created edge (can be removed/recreated)
{
  id: 'auto-step1-step2',
  source: 'step-1',
  target: 'step-2',
  data: { auto: true } // ✅ Marked as auto-created
}

// Manual edge (preserved)
{
  id: 'manual-step2-action1',
  source: 'step-2',
  target: 'action-1'
  // No 'auto' flag = manual edge
}
```

### Layout Constants
```typescript
const START_X = 50;        // First step x-position
const STEP_SPACING = 250;  // Horizontal spacing between steps
const STEP_Y = 80;         // Y position of form steps
const ACTION_OFFSET_Y = 150; // Vertical offset for actions below steps
```

---

## 🔗 Quick Links

- **Full Plan**: [MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md](./MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md)
- **React Flow Docs**: https://reactflow.dev/learn
- **Progress Tracker**: [PROGRESS_TRACKER.md](./PROGRESS_TRACKER.md)
- **Forms Enhancement Plan**: [FORMS_FLOWS_ENHANCEMENT_PLAN.md](./FORMS_FLOWS_ENHANCEMENT_PLAN.md)

---

## 🚀 Getting Started

```bash
# 1. Create feature branch
git checkout -b feature/multi-step-container-fix

# 2. Verify prerequisites
# - Check TenantForm model exists
# - Check TenantWorkForm model exists
# - Check React Flow version

# 3. Start with Phase 1
# - Open UnifiedFlowEditor.tsx
# - Find findContainerAtPosition function
# - Replace with getIntersectingNodes API

# 4. Test after each phase
# - Run manual tests
# - Update progress in plan document
# - Commit changes

# 5. Submit PR after Phase 2
# - Get early feedback on architecture
# - Continue with remaining phases
```

---

**Ready to execute? Start with Phase 1, Task 1.1!**

_Last Updated: 2026-02-08_
