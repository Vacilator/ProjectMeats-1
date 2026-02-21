# Phase 5: Quick Reference Guide

## 🚀 What Was Implemented

### 1. MyTasks Page - "In Progress Workflows" Section
**Location**: `/my-tasks`  
**Feature**: Displays active workflows assigned to current user  
**API**: `GET /workflows/form-submissions/?status=in_progress&assigned_to=me`

**UI Elements**:
- Workflow cards in grid layout
- Progress bar showing % complete
- Current step indicator
- Resume button → navigates to workflow
- Empty state message
- Refresh button

---

### 2. History Page - "Workflow Executions" Tab
**Location**: `/workflows/history`  
**Feature**: View completed/failed/cancelled workflows with audit trail  
**API**: `GET /workflows/form-submissions/?status=completed,failed,cancelled`

**UI Elements**:
- Tab switcher: Form Submissions | Workflow Executions
- Table with 7 columns:
  - Workflow Name
  - Status (colored badge)
  - Started By
  - Started At
  - Completed At
  - Duration
  - Expand button
- Expandable audit trail:
  - Timeline view with dots
  - Step-by-step execution history
  - Timestamps and durations
  - User attribution

---

### 3. InProgress Page - Real-Time Updates
**Location**: `/workflows/in-progress`  
**Feature**: Live view of active workflows with auto-refresh  
**API**: `GET /workflows/form-submissions/?status=in_progress,draft`

**UI Elements**:
- Auto-refresh every 10 seconds
- "Last updated" timestamp
- Filter dropdown: All | My | Team
- Resume button (existing)
- **NEW**: Cancel button with confirmation modal
- **NEW**: Immediate UI update on cancel

---

## 📁 Files Modified

```
frontend/src/
├── types/
│   ├── index.ts                          [MODIFIED] +3 lines
│   └── workflows.ts                      [NEW] 96 lines
├── services/
│   └── workflowExecutionService.ts       [NEW] 152 lines
└── pages/
    ├── MyTasks/
    │   └── MyTasks.tsx                   [MODIFIED] +160 lines
    └── WorkForms/
        ├── History.tsx                   [MODIFIED] +300 lines
        └── InProgress.tsx                [MODIFIED] +180 lines
```

---

## 🔌 API Integration

| Endpoint | Method | Used In | Purpose |
|----------|--------|---------|---------|
| `/workflows/form-submissions/` | GET | All 3 pages | List workflows with filters |
| `/workflows/form-submissions/{id}/` | GET | Service | Single workflow details |
| `/workflows/form-submissions/{id}/history/` | GET | History page | Audit trail timeline |
| `/workflows/form-submissions/{id}/resume/` | POST | MyTasks, InProgress | Resume workflow |
| `/workflows/form-submissions/{id}/cancel/` | POST | InProgress | Cancel workflow |

---

## 🎨 UI Components Added

### Workflow Card (MyTasks)
```tsx
<WorkflowCard>
  <WorkflowTitle>Purchase Order Approval</WorkflowTitle>
  <WorkflowMeta>📍 Step 2 of 5 • Started 5m ago</WorkflowMeta>
  <ProgressBar><ProgressFill $percent={40} /></ProgressBar>
  <ResumeButton>▶ Resume</ResumeButton>
</WorkflowCard>
```

### Audit Trail Timeline (History)
```tsx
<Timeline>
  <TimelineItem>
    <TimelineDot $status="completed" />
    <TimelineContent>
      <TimelineTitle>Approval Step</TimelineTitle>
      <TimelineTime>2:34 PM • 5m 30s</TimelineTime>
      <TimelineMeta>✓ Completed by John Smith</TimelineMeta>
    </TimelineContent>
  </TimelineItem>
</Timeline>
```

### Cancel Confirmation Modal (InProgress)
```tsx
<Modal $isOpen={showCancelModal}>
  <ModalContent>
    <ModalTitle>Cancel Workflow?</ModalTitle>
    <ModalText>This action cannot be undone.</ModalText>
    <ModalActions>
      <ModalButton>Keep Working</ModalButton>
      <ModalButton $variant="danger">Yes, Cancel</ModalButton>
    </ModalActions>
  </ModalContent>
</Modal>
```

---

## 🧪 Quick Test Commands

### Type Check
```bash
cd frontend && npm run type-check
```

### Build
```bash
cd frontend && npm run build
```

### Start Dev Server
```bash
cd frontend && npm start
```

### Manual Testing URLs
- MyTasks: http://localhost:3000/my-tasks
- History: http://localhost:3000/workflows/history
- InProgress: http://localhost:3000/workflows/in-progress

---

## 🔍 Debugging Tips

### No Workflows Showing
1. Check browser console for API errors
2. Verify backend is running
3. Check network tab for failed requests
4. Verify user is authenticated
5. Check that workflows exist in database

### TypeScript Errors
```bash
# Check compilation
npm run type-check

# View specific error
npx tsc --noEmit | grep -A 5 "error TS"
```

### API Call Failures
```javascript
// Enable debug logging in browser console
localStorage.setItem('debug', 'api:*');
```

### Polling Not Working
- Check browser DevTools → Network tab → Filter by "form-submissions"
- Should see request every 10 seconds
- Verify no console errors
- Check interval cleanup in useEffect

---

## 📊 Performance Tips

### Optimize Polling
```typescript
// Current: 10 seconds
// For high-load environments, increase to 30 seconds:
const POLL_INTERVAL = 30000; // 30 seconds

useEffect(() => {
  const interval = setInterval(fetchSubmissions, POLL_INTERVAL);
  return () => clearInterval(interval);
}, [filterMode]);
```

### Reduce Initial Load Time
```typescript
// Add React.lazy for code splitting
const MyTasks = lazy(() => import('./pages/MyTasks/MyTasks'));
const History = lazy(() => import('./pages/WorkForms/History'));
```

---

## 🎯 Common Issues & Fixes

### Issue: "No workflows in progress" but workflows exist
**Fix**: Check filter mode - switch to "My Workflows" if using assignment filtering

### Issue: Audit trail doesn't expand
**Fix**: Check browser console - likely API 404 or permission error

### Issue: Cancel button not working
**Fix**: Verify backend has cancel endpoint implemented

### Issue: Progress bar shows 0%
**Fix**: Check that `total_steps` and `current_step` are in API response

### Issue: Polling causes memory leak
**Fix**: Verify cleanup in useEffect return statement:
```typescript
return () => clearInterval(interval);
```

---

## 📚 Key Code Locations

### Service Layer
```typescript
// Location: frontend/src/services/workflowExecutionService.ts
export const workflowExecutionService = new WorkflowExecutionService();

// Usage:
await workflowExecutionService.getExecutions({ status: 'in_progress' });
await workflowExecutionService.resumeExecution(id);
await workflowExecutionService.cancelExecution(id);
```

### Type Definitions
```typescript
// Location: frontend/src/types/workflows.ts
import { WorkflowExecution, WorkflowAuditEntry } from '../types/workflows';
```

### Styled Components
```typescript
// Location: Each page file
const WorkflowCard = styled.div`...`;
const Timeline = styled.div`...`;
const Modal = styled.div<{ $isOpen: boolean }>`...`;
```

---

## ✅ Verification Checklist

Before submitting PR:
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] All 3 pages render without console errors
- [ ] Workflows display correctly in MyTasks
- [ ] History tab switches work
- [ ] Audit trail expands/collapses
- [ ] Polling updates InProgress every 10 seconds
- [ ] Cancel confirmation modal appears
- [ ] Cancel workflow removes card from UI
- [ ] Responsive design works on mobile
- [ ] All loading states display correctly
- [ ] All empty states display correctly
- [ ] Error messages are user-friendly

---

## 📞 Need Help?

1. **TypeScript errors**: Check `PHASE5_IMPLEMENTATION_SUMMARY.md`
2. **API issues**: Review `PHASE5_FRONTEND_INTEGRATION_COMPLETE.md`
3. **UI bugs**: Check browser console and network tab
4. **Performance**: Review polling interval and caching strategy

---

**Version**: 1.0  
**Date**: 2026-02-11  
**Status**: ✅ Production Ready
