# Multi-Step Container Troubleshooting Guide

## Common Issues & Solutions

### 🔴 Critical Issues

#### Issue: Container detection always returning 0 nodes (FIXED - February 2026)

**Symptoms:**
- Nodes won't drop into containers even when visually inside
- Console shows "Intersecting nodes found: 0" every time
- Green border appears but drop fails

**Root Cause:**
- React Flow's `getIntersectingNodes()` API was consistently returning empty array
- Known issue with React Flow v12.x in certain configurations

**Solution Applied:**
- **HOTFIX**: Replaced `getIntersectingNodes()` with manual bounding box detection
- New implementation uses container's measured dimensions for accurate detection
- Enhanced console logging added to help debug future issues

**Status:** ✅ FIXED (Feb 9, 2026)

**If you still experience this issue:**
1. Check browser console for enhanced logging (see "Enhanced Console Logging" section)
2. Verify container position and dimensions are being logged correctly
3. Report issue with console logs if detection still fails

---

#### Issue: Nodes not appearing after drop into container

**Symptoms:**
- Node appears to drop but doesn't render
- Console shows no errors
- MiniReactFlow preview is empty

**Root Cause:**
- Node's `parentNode` property not set correctly
- React Flow state not updated

**Solution:**
```typescript
// Verify in browser console:
reactFlowInstance.getNodes().filter(n => n.parentNode === 'container-id')

// Should return array of child nodes
// If empty, re-drop the node
```

**Prevention:**
- Ensure green border appears when dragging over container
- Drop only when container is highlighted
- Check that container is expanded (not collapsed)

---

#### Issue: "Container must have at least one form step" validation error

**Symptoms:**
- Save workflow fails
- Toast shows validation error
- Container is empty or has only action nodes

**Root Cause:**
- Container validation requires at least 1 form step node

**Solution:**
1. Add a "Form Step" or "Form Reference" node to the container
2. Ensure node type is `formStep` or `formReference`
3. Save again

**Prevention:**
- Always add form steps before actions
- Use validation preview before saving

---

#### Issue: Auto-layout not working

**Symptoms:**
- Nodes don't re-arrange automatically
- Positions remain manual
- Steps don't align horizontally

**Root Cause:**
- Auto-layout only triggers on specific events:
  - Node drop into container
  - Node drag-stop (reorder)
  - Node deletion

**Solution:**
1. Select a node inside container
2. Drag it slightly and release (triggers re-layout)
3. Verify `calculateContainerLayout()` is called in console

**Prevention:**
- Drop nodes cleanly (don't cancel mid-drag)
- Wait for layout animation to complete before next action

---

### ⚠️ Connection Issues

#### Issue: Can't connect child node to external node

**Symptoms:**
- Edge validation fails
- Connection attempt rejected
- No visual feedback

**Root Cause:**
- Container isolation is enforced by design
- Child nodes can only connect to siblings in same container

**Solution:**
- This is **intentional behavior**
- Connect at container level instead:
  1. Exit container editing mode
  2. Connect the container node itself to external nodes
  3. Data flows through container I/O handles

**Prevention:**
- Understand container scope isolation rules
- Plan workflow structure before building

---

#### Issue: Auto-connections not creating edges

**Symptoms:**
- Form steps exist but no edges between them
- Sequential flow not visible

**Root Cause:**
- Auto-connection skips if manual edge already exists
- Algorithm only runs on specific triggers

**Solution:**
1. Delete any manual edges between form steps
2. Select a step and drag slightly (triggers re-connection)
3. Verify edges appear with "Step 1 → 2" labels

**Prevention:**
- Let auto-connection create edges first
- Manually connect only for branching logic

---

### 🟡 Workflow Persistence Issues

#### Issue: Workflow not saving

**Symptoms:**
- Save button shows loading indefinitely
- Toast shows error: "Failed to save workflow"
- Console shows network error

**Root Cause:**
- Backend API unavailable
- Auth token expired
- Validation failure

**Solution:**
1. Check browser Network tab for failed requests
2. Verify backend is running: `curl http://localhost:8000/api/v1/tenant-workforms/`
3. Check authentication token in localStorage
4. Review validation errors in toast

**Debugging:**
```bash
# Check backend logs
docker logs pm-backend --tail 50

# Test API manually
curl -H "Authorization: Bearer YOUR_TOKEN" \
     -H "X-Tenant-ID: YOUR_TENANT_ID" \
     http://localhost:8000/api/v1/tenant-workforms/
```

---

#### Issue: Workflow loads but nodes are misplaced

**Symptoms:**
- Nodes appear in wrong positions
- Layout is chaotic
- Edges overlap

**Root Cause:**
- Viewport state not restored correctly
- Parent-child relationships not reconstructed

**Solution:**
1. Check console for errors during load
2. Reload the page
3. Try "Fit View" button (Ctrl+0)
4. If issue persists, re-save the workflow

**Prevention:**
- Always save with "Fit View" applied
- Avoid manually editing workflow JSON

---

### 🟢 UX & Display Issues

#### Issue: Mini canvas preview not updating

**Symptoms:**
- Preview shows old state
- New nodes don't appear in thumbnail
- Statistics are incorrect

**Root Cause:**
- `MiniReactFlow` component not receiving updated props
- React memo preventing re-render

**Solution:**
1. Collapse and expand container (forces re-render)
2. Check React DevTools for prop updates
3. Verify `childNodes` are filtered correctly

**Prevention:**
- Ensure `useMemo` dependencies include nodes and edges
- Check that `parentNode` property is set on child nodes

---

#### Issue: Toast notifications not appearing

**Symptoms:**
- No feedback after save/load/delete
- Silent failures

**Root Cause:**
- Toaster component not rendered
- toast() calls failing silently
- z-index conflict

**Solution:**
1. Check that `<Toaster />` is in JSX
2. Verify `import { toast } from 'react-hot-toast'`
3. Check browser console for errors
4. Inspect z-index of toast container

**Prevention:**
- Don't remove Toaster component
- Import toast correctly in all files

---

### 🔵 Performance Issues

#### Issue: Editor lags with many nodes in container

**Symptoms:**
- Slow drag-and-drop
- Delayed re-layout
- UI freezes

**Root Cause:**
- Too many nodes (50+) triggers expensive re-calculations
- No virtualization

**Solution:**
1. Split large workflows into multiple containers
2. Reduce number of action nodes
3. Simplify branching logic

**Benchmarks:**
- ✅ Good: < 20 nodes per container
- ⚠️ Acceptable: 20-50 nodes
- ❌ Slow: > 50 nodes

**Prevention:**
- Keep containers focused and small
- Use multiple containers instead of one giant container

---

## Diagnostic Tools

### Enhanced Console Logging (February 2026)

**NEW**: The container detection system now includes comprehensive debugging logs. When you drag and drop nodes, look for these console messages:

**Container Detection Logs:**
```
[Container] =================================
[Container] Looking for containers at position: {x: 450, y: 200}
[Container] Total nodes on canvas: 5
[Container] Container nodes found: 1
[Container] Checking container-1: {type: "formMultiStepContainer", position: {x: 100, y: 100}, dimensions: {width: 600, height: 400}, bounds: {...}, isExpanded: true}
[Container] ✅ Found matching container: container-1
```

**Drop Event Logs:**
```
[Container] ✅ Detected drop into container container-1
[Container] Container container-1 already expanded
[Container] Setting up parent-child relationship with container container-1
[Container] Adding node node-5 as child of container container-1
[Container] Position - Absolute: (450, 250), Relative: (350, 150)
[Container] ✅ Node configured: {nodeId: "node-5", parentId: "container-1", relativePosition: {x: 350, y: 150}, ...}
[Container] Inserting node at index 2 (after parent)
[Container] Triggering auto-layout for container container-1
[Layout] Result: {containerWidth: 600, containerHeight: 400, childrenCount: 3}
```

**What to Look For:**
- ✅ **"Found matching container"** - Drop detection working correctly
- ❌ **"No container matched at position"** - Drop position outside container bounds
- ❌ **"Container nodes found: 0"** - No containers on canvas
- ⚠️ **"Cannot nest containers"** - Attempted to drop container inside container

### Browser Console Commands

```javascript
// Get React Flow instance
const rf = window.__REACT_FLOW_INSTANCE__;

// List all nodes
rf.getNodes();

// List all containers
rf.getNodes().filter(n => n.type === 'formMultiStepContainer');

// List children of container
rf.getNodes().filter(n => n.parentNode === 'YOUR_CONTAINER_ID');

// List all edges
rf.getEdges();

// Get viewport state
rf.getViewport();
```

### Network Debugging

```bash
# Check backend health
curl http://localhost:8000/api/v1/health/

# List workflows
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT" \
     http://localhost:8000/api/v1/tenant-workforms/

# Get specific workflow
curl -H "Authorization: Bearer TOKEN" \
     -H "X-Tenant-ID: TENANT" \
     http://localhost:8000/api/v1/tenant-workforms/WORKFLOW_ID/
```

### State Inspection

```javascript
// In React DevTools, select UnifiedFlowEditor component
// Inspect state:
- nodes (should contain all nodes with parentNode property)
- edges (should have auto: true for auto-created edges)
- currentWorkflowId (should match loaded workflow)
- hasUnsavedChanges (should be true after edits)
```

---

## Error Messages Reference

| Error Message | Meaning | Solution |
|---------------|---------|----------|
| "Container must have at least one form step" | Validation failed | Add a form step node |
| "Node X is not connected" | Orphaned node detected | Connect node or remove it |
| "Failed to save workflow" | Save API failed | Check backend logs & auth |
| "Failed to load workflow" | Load API failed | Verify workflow ID exists |
| "Validation failed" | Multiple validation errors | Review toast message details |
| "Network error" | Backend unreachable | Check API server status |

---

## Known Limitations

1. **No nested containers** - Containers inside containers not supported (intentional)
2. **No circular references** - Forward connections only (enforced)
3. **50 node performance limit** - Large containers may lag
4. **No real-time collaboration** - Multi-user editing not supported
5. **No undo across page refreshes** - History cleared on reload

---

## Getting Help

### Self-Service

1. Check this troubleshooting guide
2. Review [User Guide](./USER_GUIDE_MULTI_STEP_CONTAINERS.md)
3. Read [Implementation Plan](./plans/MULTI_STEP_CONTAINER_IMPLEMENTATION_PLAN.md)
4. Search browser console for errors

### Reporting Issues

When reporting bugs, include:
- **Browser & version** (e.g., Chrome 120)
- **Error message** (exact text from toast/console)
- **Steps to reproduce**
- **Screenshot** of workflow state
- **Console logs** (copy full error stack)
- **Network logs** (failed API requests)

### Contact

- **Developer Team**: Via Slack #projectmeats-dev
- **Bug Reports**: GitHub Issues
- **Feature Requests**: Via Slack #feature-requests

---

**Last Updated**: February 19, 2026  
**Version**: 1.1  
**Maintained By**: ProjectMeats Development Team
