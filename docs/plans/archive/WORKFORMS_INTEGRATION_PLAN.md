# WorkForms Integration Plan - Wiring the Disconnected Engine

**Date:** 2026-02-13  
**Status:** 🔴 Critical - Components exist but not integrated  
**Priority:** P0 - Blocking full Phase 1-6 functionality

---

## Executive Summary

**Problem:** All Phase 1-6 components were successfully created but NEVER INTEGRATED into the main application. They exist as orphaned files that are exported but never used.

**Impact:** Users cannot:
- Execute workflows with the new TaskRenderer
- Use context inheritance ({{nodeId.field}})
- Benefit from shadow state editing
- See ghost node cleanup
- Use field mapping with context bubbles

---

## Component Inventory: What Exists vs What's Wired

| Component | File | Status | Used By |
|-----------|------|--------|---------|
| useWorkflowContext | hooks/useWorkflowContext.ts | ✅ Created | ❌ Nothing |
| TaskRenderer | TaskRenderer.tsx | ✅ Created | ❌ Nothing |
| WorkflowExecutionModal | WorkflowExecutionModal.tsx | ✅ Created | ❌ Nothing |
| InteractionCardRegistry | InteractionCardRegistry.ts | ✅ Created | ❌ Nothing |
| DocumentUploadCard | cards/DocumentUploadCard.tsx | ✅ Created | ❌ Nothing |
| ApprovalDecisionCard | cards/ApprovalDecisionCard.tsx | ✅ Created | ❌ Nothing |
| AIVerificationCard | cards/AIVerificationCard.tsx | ✅ Created | ❌ Nothing |
| useNodeShadowState | hooks/useNodeShadowState.ts | ✅ Created | ✅ NodeConfigPanelWithShadow |
| NodeConfigPanelWithShadow | ConfigPanel/NodeConfigPanelWithShadow.tsx | ✅ Created | ✅ UnifiedFlowEditor |
| ContextBubble | ContextBubble.tsx | ✅ Created | ❌ Nothing |
| FieldWithContext | ConfigPanel/FieldWithContext.tsx | ✅ Created | ❌ Nothing |
| SharedTemplateDeleteModal | Modals/SharedTemplateDeleteModal.tsx | ✅ Created | ❌ Nothing |
| container_versioning.py | services/container_versioning.py | ✅ Created | ✅ workform_serializers.py |

**Score:** 13 created, 2 integrated (15% integration rate)

---

## Integration Tasks

### Task 1: Wire WorkflowExecutionModal to UnifiedFlowEditor (HIGH PRIORITY)

**Goal:** Add "Test Workflow" button that uses the new execution engine

**Files to Modify:**
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

**Changes:**
1. Import WorkflowExecutionModal
2. Add state: `const [isExecutionModalOpen, setIsExecutionModalOpen] = useState(false);`
3. Add "Test Workflow" button to toolbar:
   ```tsx
   <ToolbarButton onClick={() => setIsExecutionModalOpen(true)}>
     <Play size={16} />
     Test Workflow
   </ToolbarButton>
   ```
4. Render modal:
   ```tsx
   <WorkflowExecutionModal
     isOpen={isExecutionModalOpen}
     onClose={() => setIsExecutionModalOpen(false)}
     workflow={{
       id: currentWorkflowId,
       name: currentWorkflowName,
       nodes,
       edges,
     }}
   />
   ```

**Verification:**
- Click "Test Workflow" button → Modal opens
- Modal shows first node
- Can navigate through workflow using edges
- Context data flows between nodes

---

### Task 2: Add Ghost Node Deletion Handler (MEDIUM PRIORITY)

**Goal:** Clean up TenantForm records when container nodes are deleted

**Files to Modify:**
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`
- `backend/apps/system/workform_views.py`

**Frontend Changes:**
1. Add onNodesDelete handler:
   ```tsx
   const handleNodesDelete = useCallback(async (deletedNodes) => {
     for (const node of deletedNodes) {
       if (node.type === 'formMultiStepContainer' && node.data.tenantFormId) {
         try {
           await workformsApi.decrementUsage(node.data.tenantFormId);
           notify.success('Container unlinked from library');
         } catch (error) {
           console.error('Failed to unlink container:', error);
         }
       }
     }
   }, []);
   ```
2. Add to ReactFlow props:
   ```tsx
   <ReactFlow
     onNodesDelete={handleNodesDelete}
     ...
   />
   ```

**Backend Changes:**
1. Add decrement_usage endpoint in TenantWorkFormViewSet:
   ```python
   @action(detail=True, methods=['post'])
   def decrement_usage(self, request, pk=None):
       """Decrement usage count and delete if orphaned."""
       form = self.get_object()
       form.usage_count = max(0, form.usage_count - 1)
       form.save()
       
       # Delete if orphaned
       if form.usage_count == 0 and not form.is_template:
           form.delete()
           return Response({'message': 'Form deleted (orphaned)'}, status=204)
       
       return Response({'usage_count': form.usage_count})
   ```

**Verification:**
- Delete container node → usage_count decrements
- Delete last usage → TenantForm deleted from database
- Check: No orphaned forms in database

---

### Task 3: Connect FieldMappingPanel to Context Bubbles (MEDIUM PRIORITY)

**Goal:** Allow visual selection of {{nodeId.field}} variables in field mapping

**Files to Modify:**
- `frontend/src/components/FlowEditor/ConfigPanel/FieldMappingPanel.tsx`

**Changes:**
1. Import FieldWithContext:
   ```tsx
   import { FieldWithContext } from './FieldWithContext';
   ```
2. Replace mapping input fields:
   ```tsx
   // OLD:
   <Input value={mapping.source} onChange={...} />
   
   // NEW:
   <FieldWithContext
     label="Source Field"
     value={mapping.source}
     onChange={(newValue) => handleMappingChange(mapping.id, 'source', newValue)}
     context={workflowContext}
     placeholder="Enter field name or use {{nodeId.field}}"
   />
   ```
3. Pass workflow context from parent:
   ```tsx
   const { context } = useWorkflowContext();
   ```

**Verification:**
- Click 📊 icon → Context bubble opens
- Shows fields from previous nodes
- Click field → Inserts {{nodeId.field}} template
- Template resolves in real-time preview

---

### Task 4: Add FormSubmissionModal → WorkflowExecutionModal Migration (LOW PRIORITY)

**Goal:** Eventually replace old FormSubmissionModal with new WorkflowExecutionModal

**Strategy:** Gradual migration, not immediate replacement

**Phase 1 (Immediate):**
- Keep both modals
- Use WorkflowExecutionModal for NEW workflows
- Keep FormSubmissionModal for LEGACY form submissions

**Phase 2 (Future):**
- Add feature flag: `USE_NEW_EXECUTION_ENGINE`
- Migrate user data
- Deprecate old modal

---

## Success Criteria

### Minimum Viable Integration (MVP)
- [ ] "Test Workflow" button exists and works
- [ ] WorkflowExecutionModal opens and shows nodes
- [ ] TaskRenderer renders form steps correctly
- [ ] Context data flows between nodes ({{nodeId.field}})
- [ ] Ghost node deletion works

### Full Integration
- [ ] All interaction cards work (Document, Approval, AI)
- [ ] Field mapping uses context bubbles
- [ ] Shadow state prevents data loss
- [ ] Automated testing for workflow execution
- [ ] Documentation updated

---

## Implementation Priority

**Week 1 (Critical Path):**
1. Task 1: Wire WorkflowExecutionModal (2-3 hours)
2. Task 2: Ghost Node Deletion (1-2 hours)
3. Verify end-to-end workflow execution (1 hour)

**Week 2 (Enhancement):**
4. Task 3: Context Bubbles in Field Mapping (2 hours)
5. Add "Execute from Node" context menu (1 hour)
6. Polish interaction cards (2 hours)

**Week 3 (Hardening):**
7. Add workflow execution state persistence
8. Add resume from checkpoint
9. Error handling and recovery
10. Performance optimization

---

## Testing Plan

### Manual Testing Checklist
- [ ] Create simple workflow (Step 1 → Step 2)
- [ ] Add {{step1.field}} reference in Step 2
- [ ] Click "Test Workflow"
- [ ] Verify modal opens
- [ ] Fill Step 1, click Next
- [ ] Verify Step 2 shows with {{step1.field}} resolved
- [ ] Delete container node
- [ ] Verify database cleanup

### Automated Testing
```typescript
describe('WorkflowExecutionModal Integration', () => {
  it('should execute workflow with context inheritance', async () => {
    const workflow = {
      nodes: [
        { id: 'step1', type: 'formStep', data: { fields: [{ name: 'name' }] } },
        { id: 'step2', type: 'formStep', data: { fields: [{ name: 'greeting', defaultValue: '{{step1.name}}' }] } },
      ],
      edges: [{ source: 'step1', target: 'step2' }],
    };
    
    render(<WorkflowExecutionModal workflow={workflow} />);
    
    // Fill step 1
    await userEvent.type(screen.getByLabelText('name'), 'John');
    await userEvent.click(screen.getByText('Next'));
    
    // Verify step 2 has resolved value
    expect(screen.getByLabelText('greeting')).toHaveValue('John');
  });
});
```

---

## Rollback Plan

If integration causes issues:

1. **Immediate Rollback:**
   - Remove "Test Workflow" button
   - Keep WorkflowExecutionModal code (for future)
   - No data loss (old modal still works)

2. **Partial Rollback:**
   - Disable specific features (e.g., interaction cards)
   - Keep basic workflow execution

3. **Feature Flag:**
   ```tsx
   const USE_NEW_EXECUTION = import.meta.env.VITE_USE_NEW_EXECUTION === 'true';
   ```

---

## Dependencies

### External Dependencies
- React Flow v11+ (already installed)
- React Query v4+ (already installed)
- Ant Design v5+ (already installed)

### Internal Dependencies
- Phase 1-6 components (all created)
- Backend endpoints (all exist)
- Database migrations (all applied)

---

## Documentation Updates Required

### User Documentation
- `docs/USER_GUIDE_WORKFLOWS.md` - Add "Testing Workflows" section
- `docs/USER_GUIDE_CONTEXT_INHERITANCE.md` - Explain {{nodeId.field}} syntax

### Developer Documentation
- `docs/ARCHITECTURE_WORKFORMS.md` - Document integration architecture
- `docs/API_WORKFORMS.md` - Document WorkflowExecutionModal API
- `README.md` - Update feature list

---

## Estimated Effort

| Task | Developer Hours | Testing Hours | Total |
|------|----------------|---------------|-------|
| Task 1: WorkflowExecutionModal | 2-3 | 1 | 3-4 |
| Task 2: Ghost Node Deletion | 1-2 | 0.5 | 1.5-2.5 |
| Task 3: Context Bubbles | 2 | 0.5 | 2.5 |
| Task 4: Migration Planning | 1 | 0 | 1 |
| **Total** | **6-8** | **2** | **8-10** |

---

## Success Metrics

### Quantitative
- 0 → 100% component integration rate
- <5s workflow execution start time
- >95% context resolution success rate
- 0 orphaned TenantForm records

### Qualitative
- Users can test workflows without deploying
- Context inheritance "just works"
- No confusion about which modal to use
- Database stays clean

---

## Next Actions

**Immediate (Next 24 hours):**
1. Create PR for Task 1 (WorkflowExecutionModal integration)
2. Test end-to-end workflow execution
3. Deploy to development environment

**Short-term (This week):**
4. Create PR for Task 2 (Ghost node deletion)
5. Add automated tests
6. Update documentation

**Long-term (Next sprint):**
7. Full FormSubmissionModal migration
8. Workflow execution state persistence
9. Advanced interaction cards

---

**Document Status:** 📋 ACTIVE - Implementation Required  
**Last Updated:** 2026-02-13  
**Owner:** Development Team  
**Reviewers:** Product, Engineering
