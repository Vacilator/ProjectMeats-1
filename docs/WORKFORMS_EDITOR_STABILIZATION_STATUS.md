# WorkForms Editor Stabilization - Implementation Status

**Date**: 2026-02-09  
**Branch**: `fix/workforms-editor-stabilization`  
**Status**: 🔄 IN PROGRESS

---

## ✅ COMPLETED FIXES

### 1. Container Drop Race Condition (CRITICAL)
**Problem**: Multi-step container nodes were disappearing after dropping form step nodes into them.

**Root Cause**: Race condition between `onDrop` and `onDragEnd` handlers:
- `onDrop` added child node and called `setNodes(finalNodes)`
- `onDragEnd` called `setNodes((nds) => ...)` with functional update
- Due to React's async state updates, `nds` in `onDragEnd` received OLD array without child
- `onDragEnd` returned old array, discarding the newly added child

**Solution**: 
- Added `dropSucceededRef` to track successful drops
- `onDragEnd` now skips `setNodes` call if drop succeeded
- Prevents state overwrite while maintaining cleanup functionality

**Files Changed**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

**Commit**: `29acb12e` - "fix: prevent onDragEnd from undoing container drop"

---

### 2. Backend/Frontend Field Name Mismatch (HIGH)
**Problem**: Frontend expected `form_definition` but backend model uses `flow_data`.

**Root Cause**: Inconsistent naming between backend model and frontend types.

**Solution**:
- Updated `TenantForm` interface to use `flow_data` (matches backend)
- Updated `EntityFormStepModal` to read from `flow_data.fields`
- Fixed TypeScript type definitions

**Files Changed**:
- `frontend/src/services/workformsApi.ts`
- `frontend/src/components/FlowEditor/Modals/EntityFormStepModal.tsx`

---

## ⚠️ CRITICAL GAPS IDENTIFIED

### 1. Missing TenantWorkForm API Endpoint (CRITICAL - BLOCKING)

**Problem**: Frontend tries to save workflows to `/tenant-workforms/` but endpoint doesn't exist.

**Evidence**:
```typescript
// frontend/src/components/FlowEditor/utils/workflowPersistence.ts:213-224
response = await axios.post(
  `${apiUrl}/tenant-workforms/`,  // ❌ ENDPOINT DOES NOT EXIST
  payload,
  { headers: getAuthHeaders() }
);
```

**Impact**: 
- ❌ Workflows cannot be saved
- ❌ Container parent-child relationships cannot be persisted
- ❌ Form references are lost on page reload
- ❌ Workflow versioning is non-functional

**Required Fix**: 
Create `TenantWorkFormViewSet` in `backend/tenant_apps/workflows/views.py`:

```python
class TenantWorkFormViewSet(TenantFilteredModelViewSet):
    """
    ViewSet for TenantWorkForm CRUD operations.
    Handles workflow definitions with container hierarchies.
    """
    queryset = TenantWorkForm.objects.all()
    serializer_class = TenantWorkFormSerializer
    permission_classes = [IsAuthenticated, CanEditWorkForm]
    
    def get_serializer_class(self):
        if self.action in ['create', 'update']:
            return TenantWorkFormCreateSerializer
        return TenantWorkFormSerializer
```

**Required Serializer**:
Create `TenantWorkFormSerializer` and `TenantWorkFormCreateSerializer` in `backend/tenant_apps/workflows/serializers.py`.

**Required Model**:
Check if `TenantWorkForm` model exists. If not, create it with:
- `workflow_definition` JSONField (stores nodes & edges)
- `form_references` JSONField (list of referenced TenantForm IDs)
- `version` IntegerField
- Standard tenant, user, and timestamp fields

**URL Pattern**:
Add to `backend/tenant_apps/workflows/urls.py`:
```python
router.register(r'tenant-workforms', views.TenantWorkFormViewSet, basename='tenant-workform')
```

---

### 2. Auto-Layout Triggers Too Frequently (HIGH)

**Problem**: Auto-layout runs on every drag movement, causing UI jitter.

**Current Behavior**: 
- `onNodeDragStop` might be triggering `autoLayoutContainerNodes`
- Layout recalculates even when node hasn't changed containers
- Performance degradation with many nodes

**Required Fix**:
```typescript
const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
  // ONLY trigger auto-layout if:
  // 1. Node was moved into/out of a container
  // 2. Node is a child and its relative position changed significantly
  // 3. Explicit reorder action occurred
  
  const wasInContainer = dragStartContainerRef.current;
  const isInContainer = node.parentId;
  
  if (wasInContainer !== isInContainer) {
    // Container change detected - trigger layout
    if (isInContainer) {
      const layoutResult = calculateContainerLayout(isInContainer, nodes, edges);
      setNodes(layoutResult.nodes);
    }
  }
  
  // Reset drag start state
  dragStartContainerRef.current = null;
}, [nodes, edges]);
```

**Files to Modify**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

---

### 3. Cascading Config Dropdowns Not Wired (HIGH)

**Problem**: Trigger type selection doesn't fetch forms, form selection doesn't fetch fields.

**Current State**:
- Dropdowns exist in UI but are hardcoded/static
- No API calls to `/api/tenant-forms/` on trigger type change
- No API calls to `/api/tenant-forms/{id}/fields/` on form selection

**Required Fix**:
1. Add `useEffect` hooks in `NodeConfigPanel.tsx` to watch for trigger type changes
2. Call `workformsApi.getTenantForms()` filtered by trigger type
3. Add another `useEffect` to watch for form selection
4. Call `workformsApi.getTenantFormFields(formId)` to populate field dropdown
5. Add loading states and error handling

**Example Implementation**:
```typescript
// In NodeConfigPanel.tsx
useEffect(() => {
  if (nodeData.triggerType === 'form_submitted') {
    setLoadingForms(true);
    workformsApi.getTenantForms({ status: 'active' })
      .then(forms => setAvailableForms(forms))
      .catch(err => setError('Failed to load forms'))
      .finally(() => setLoadingForms(false));
  }
}, [nodeData.triggerType]);

useEffect(() => {
  if (nodeData.selectedFormId) {
    setLoadingFields(true);
    workformsApi.getTenantFormFields(nodeData.selectedFormId)
      .then(fields => setAvailableFields(fields))
      .catch(err => setError('Failed to load fields'))
      .finally(() => setLoadingFields(false));
  }
}, [nodeData.selectedFormId]);
```

**Files to Modify**:
- `frontend/src/components/FlowEditor/ConfigPanel/NodeConfigPanel.tsx`

---

### 4. Wizard Mode Auto-Template Missing (MEDIUM)

**Problem**: Wizard mode shows blank canvas instead of auto-loading template.

**Required Fix**:
```typescript
// In UnifiedFlowEditorInner component
useEffect(() => {
  if (editorMode === 'wizard' && nodes.length === 0) {
    // Auto-load "Simple Contact Form" template
    const template = getWorkflowTemplate('simple-contact-form');
    if (template) {
      setNodes(template.nodes);
      setEdges(template.edges);
      console.log('[Wizard] Auto-loaded Simple Contact Form template');
    }
  }
}, [editorMode, nodes.length]);
```

**Files to Modify**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`
- `frontend/src/components/FlowEditor/templates/workflowTemplates.ts` (create if missing)

---

## 🎯 RECOMMENDED IMPLEMENTATION ORDER

### Phase 1: Backend Foundation (4-6 hours)
1. ✅ Fix field name mismatch (`flow_data` vs `form_definition`)
2. ❌ **BLOCKED**: Create `TenantWorkForm` model if missing
3. ❌ **BLOCKED**: Create `TenantWorkFormSerializer`
4. ❌ **BLOCKED**: Create `TenantWorkFormViewSet`
5. ❌ **BLOCKED**: Add URL routes
6. ❌ **BLOCKED**: Write tests for serialization

**Status**: Cannot proceed without database access and migrations.

### Phase 2: Frontend Stability (2-3 hours)
1. ✅ Fix container drop race condition
2. ⏳ Fix auto-layout trigger logic
3. ⏳ Add drag start container tracking
4. ⏳ Test drag behavior

### Phase 3: Frontend Configuration (3-4 hours)
1. ⏳ Wire trigger type → form dropdown
2. ⏳ Wire form selection → field dropdown
3. ⏳ Add loading states
4. ⏳ Add error handling
5. ⏳ Test cascading behavior

### Phase 4: Polish (1-2 hours)
1. ⏳ Implement wizard mode auto-template
2. ⏳ Test mode switching
3. ⏳ Update documentation

---

## 🚧 BLOCKERS

### Critical Blocker: Missing Backend Infrastructure
**The TenantWorkForm system is not implemented**. The frontend assumes it exists, but:
- No model definition found
- No serializers exist
- No ViewSet registered
- No URL routes configured

**Without this infrastructure, workflows cannot be saved to the database**.

###Recommendation:
1. Check if `TenantWorkForm` model exists in migrations
2. If not, create the model and run migrations
3. Implement the serializer and viewset
4. Test with Postman/curl before frontend integration

---

## 📝 Testing Checklist

### Backend Tests (When Implemented)
- [ ] Create workflow with empty container
- [ ] Create workflow with container + children
- [ ] Update workflow preserving parent-child relationships
- [ ] Retrieve workflow and verify `parentId` values
- [ ] Delete workflow cascades to children

### Frontend Tests
- [x] Drop form step into container (no disappearing)
- [ ] Drag form step out of container
- [ ] Reorder steps within container
- [ ] Auto-layout triggers only on drop/reorder
- [ ] Trigger type changes load forms
- [ ] Form selection loads fields
- [ ] Wizard mode loads template on empty canvas

---

## 📚 Related Documentation
- `/docs/plans/MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md`
- `/docs/FORMS_FLOWS_ENHANCEMENT_PLAN.md`
- `/docs/COCKPIT_WORKFORMS_OVERHAUL_PLAN.md`

---

## 🏁 Next Steps

1. **Immediate**: Commit current fixes (field name, race condition)
2. **Next**: Investigate `TenantWorkForm` model existence
3. **Then**: Implement missing backend infrastructure (if needed)
4. **Finally**: Complete frontend stabilization (layout, config, wizard)

**Estimated Total Time Remaining**: 10-15 hours (assuming backend needs to be built from scratch)
