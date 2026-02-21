# React Flow - Lessons Learned & Best Practices
**Date**: 2026-02-09  
**Last Updated**: 2026-02-09  
**Status**: 📚 Reference Document  
**Version**: React Flow v12.10.0

---

## 🎯 Purpose

This document captures hard-won knowledge from developing the ProjectMeats Workflow Editor using React Flow. These lessons are the result of extensive debugging sessions, production incidents, and architectural decisions that may not be obvious from official documentation.

---

## 🚨 CRITICAL LESSONS (Read First!)

### 1. Parent-Child Node Ordering (CRITICAL)

**Problem**: Nodes completely vanish when dropped into container nodes (parent-child relationships).

**Root Cause**: React Flow v12+ requires parent nodes to appear BEFORE their children in the nodes array. This is enforced at the React Flow engine level, not just a best practice.

**Error Message**:
```
Parent node not found. Parent nodes must be in front of children
```

**❌ WRONG - Causes Node Vanishing**:
```typescript
// Appending child to end of array
const updatedNodes = nodes.concat(newChildNode);
setNodes(updatedNodes);
```

**✅ CORRECT - Insert Child After Parent**:
```typescript
// Find parent index and insert child immediately after
const parentIndex = nodes.findIndex(n => n.id === containerId);
const updatedNodes = [
  ...nodes.slice(0, parentIndex + 1),  // Parent first
  newChildNode,                         // Then child
  ...nodes.slice(parentIndex + 1),      // Then rest
];
setNodes(updatedNodes);
```

**Key Takeaway**: ALWAYS use array insertion at `parentIndex + 1`, NEVER use `.concat()` or `.push()` for child nodes.

**Files Affected**: 
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (Lines 2744-2761)
- Any component that creates parent-child relationships

**Related PRs**: #2765, #2768, #2770

---

### 2. Single setNodes() Call Pattern (CRITICAL)

**Problem**: Even with perfect array ordering, nodes still vanish. Multiple `setNodes()` calls in quick succession create race conditions.

**Root Cause**: React batches async state updates, but React Flow processes nodes BEFORE React's batching completes. This creates a timing window where parent nodes aren't "ready" when children are processed.

**❌ WRONG - Multiple Calls Create Race Condition**:
```typescript
// Step 1: Add child with correct ordering
setNodes(updatedNodes);

// Step 2: Apply layout
setNodes(layoutResult.nodes);

// Step 3: Update container dimensions
setNodes(dimensionUpdates);

// ❌ React Flow error: "Parent node not found"
// Even though ordering was perfect in each call!
```

**✅ CORRECT - Single Batched Call**:
```typescript
// Calculate all updates FIRST
const nodesWithChild = insertChildAtParentIndex(nodes, newChild, parentId);
const layoutedNodes = calculateLayout(nodesWithChild);
const finalNodes = applyDimensions(layoutedNodes, containerId, dimensions);

// SINGLE setNodes call with all updates
setNodes(finalNodes);
```

**Key Takeaway**: 
- NEVER call `setNodes()` multiple times in the same function
- Calculate ALL updates using `.map()`, then call `setNodes()` ONCE
- Use functional composition to combine updates

**Debugging Discovery**:
1. Added extensive logging to trace ordering at each step
2. Logs showed PERFECT ordering through all steps
3. Error occurred AFTER all our updates → Must be async issue
4. Discovered three `setNodes()` calls → Batched into one → FIXED

**Files Affected**:
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (Lines 2784-2799)
- `frontend/src/components/FlowEditor/utils/containerLayout.ts` (Lines 175-178)

**Related PRs**: #2770 (The Fix), #2768 (Debug Logging)

---

### 3. Array Order Preservation in Updates

**Problem**: Using `.map()` to update nodes can inadvertently reorder the array if not careful.

**Solution**: ALWAYS use `.map()` for updates (preserves order), NEVER rebuild arrays from scratch unless you control ordering explicitly.

**✅ CORRECT - Order-Preserving Updates**:
```typescript
// Update specific node while preserving array order
const updatedNodes = nodes.map(node => 
  node.id === targetId 
    ? { ...node, data: { ...node.data, newField: value } }
    : node
);
setNodes(updatedNodes);
```

**✅ CORRECT - Merging Layout Changes**:
```typescript
// Merge layout positions back into original array (preserves order)
const finalNodes = nodes.map(node => {
  const layoutNode = layoutResult.nodes.find(ln => ln.id === node.id);
  return layoutNode ? { ...node, position: layoutNode.position } : node;
});
setNodes(finalNodes);
```

**❌ WRONG - Can Reorder Array**:
```typescript
// Rebuilding array from layout result loses original ordering
const updatedNodes = layoutResult.nodes; // ❌ May not match original order
setNodes(updatedNodes);
```

**Key Takeaway**: Treat the nodes array order as sacred. Use `.map()` for updates, use insertion at specific indices for new nodes.

**Files Affected**:
- `frontend/src/components/FlowEditor/utils/containerLayout.ts` (Lines 175-178)

---

### 4. React Flow v12 API Changes

**Migration Note**: React Flow v11 → v12 introduced breaking changes in parent-child API.

**Changes**:
- ✅ v12: Use `parentId` property (string)
- ❌ v11: Used `parentNode` property (deprecated)

**✅ CORRECT - v12 Pattern**:
```typescript
const childNode: Node = {
  id: 'child-1',
  type: 'formStep',
  parentId: 'container-1',  // ✅ v12 API
  data: { ... },
  position: { x: 0, y: 0 }, // Relative to parent
};
```

**❌ WRONG - v11 Pattern (Deprecated)**:
```typescript
const childNode: Node = {
  id: 'child-1',
  type: 'formStep',
  parentNode: 'container-1',  // ❌ Deprecated in v12
  data: { ... },
  position: { x: 0, y: 0 },
};
```

**Key Takeaway**: Always use `parentId` in React Flow v12+. Check React Flow version when debugging legacy code.

---

### 5. useReactFlow Hook Destructuring (v12)

**Problem**: Attempting to call `reactFlowInstance.setCenter()` results in `ReferenceError: setCenter is not defined`.

**Root Cause**: In React Flow v12, `useReactFlow()` returns an object where some methods like `setCenter` need to be explicitly destructured, while others like `fitView`, `zoomIn`, etc. can be called on the instance object.

**❌ WRONG - Calling setCenter on Instance**:
```typescript
const reactFlowInstance = useReactFlow();
// Later...
reactFlowInstance.setCenter(x, y, { duration: 800, zoom: 1.2 }); // ❌ Error: setCenter is not defined
```

**✅ CORRECT - Destructure setCenter**:
```typescript
const { setCenter, ...reactFlowInstance } = useReactFlow();
// Later...
setCenter(x, y, { duration: 800, zoom: 1.2 }); // ✅ Works correctly
```

**Alternative Pattern - Destructure All Methods**:
```typescript
const { setCenter, fitView, zoomIn, zoomOut, screenToFlowPosition } = useReactFlow();
```

**Methods that work on instance**:
- `fitView()`
- `zoomIn()`
- `zoomOut()`
- `zoomTo()`
- `setViewport()`
- `getViewport()`
- `screenToFlowPosition()`

**Methods that require destructuring**:
- `setCenter()`

**Key Takeaway**: When using viewport control methods from `useReactFlow()`, check the official documentation to see if the method should be destructured or called on the instance. If you get "is not defined" errors, try destructuring the method.

**Files Affected**: 
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx` (Line 1645)

**Related Issues**: Bug report from 2026-02-21 - "setCenter is not defined" error in validation navigation

---

## 📋 Best Practices

### Node Management

#### Creating Child Nodes
```typescript
const createChildNode = (
  nodes: Node[],
  parentId: string,
  nodeType: string,
  data: any
): Node[] => {
  // 1. Find parent index
  const parentIndex = nodes.findIndex(n => n.id === parentId);
  if (parentIndex === -1) {
    console.error('Parent node not found:', parentId);
    return nodes;
  }

  // 2. Create child node
  const newNode: Node = {
    id: `${nodeType}-${Date.now()}`,
    type: nodeType,
    parentId: parentId,  // ✅ React Flow v12
    data: data,
    position: { x: 100, y: 100 }, // Relative to parent
    extent: 'parent',  // Optional: constrain to parent bounds
  };

  // 3. Insert at parentIndex + 1
  return [
    ...nodes.slice(0, parentIndex + 1),
    newNode,
    ...nodes.slice(parentIndex + 1),
  ];
};
```

#### Updating Nodes with Layout
```typescript
const updateNodesWithLayout = (
  nodes: Node[],
  layoutChanges: Partial<Node>[],
  dimensionUpdates: Record<string, Partial<Node>>
): Node[] => {
  // Single pass: merge all updates
  return nodes.map(node => {
    const layoutChange = layoutChanges.find(lc => lc.id === node.id);
    const dimensionChange = dimensionUpdates[node.id];
    
    return {
      ...node,
      ...(layoutChange || {}),
      ...(dimensionChange || {}),
    };
  });
};

// Usage: ONE setNodes call
const updatedNodes = updateNodesWithLayout(nodes, layout, dimensions);
setNodes(updatedNodes);
```

#### Deleting Child Nodes
```typescript
const deleteNodeAndChildren = (
  nodes: Node[],
  nodeId: string
): Node[] => {
  // Find all descendants recursively
  const findDescendants = (id: string): string[] => {
    const children = nodes.filter(n => n.parentId === id).map(n => n.id);
    return [
      ...children,
      ...children.flatMap(childId => findDescendants(childId))
    ];
  };

  const toDelete = new Set([nodeId, ...findDescendants(nodeId)]);
  return nodes.filter(n => !toDelete.has(n.id));
};
```

### Container Nodes

#### Multi-Step Container Pattern
```typescript
// Container node must have NO parentId
const containerNode: Node = {
  id: 'container-1',
  type: 'formMultiStepContainer',
  // parentId: undefined,  // ✅ Top-level node
  data: {
    title: 'My Container',
    containerType: 'multi-step',
  },
  position: { x: 100, y: 100 },
  style: {
    width: 800,
    height: 400,
    padding: 20,
  },
};

// Child nodes reference container via parentId
const childNode: Node = {
  id: 'step-1',
  type: 'formStep',
  parentId: 'container-1',  // ✅ References container
  data: { title: 'Step 1' },
  position: { x: 50, y: 50 }, // Relative to container
};
```

#### Querying Child Nodes (React Flow v12)
```typescript
// Inside container component
const FormMultiStepContainerNode = ({ id }: NodeProps) => {
  const allNodes = useNodes();
  
  // Find children using parentId
  const childNodes = useMemo(() => {
    return allNodes.filter(node => node.parentId === id);
  }, [allNodes, id]);
  
  return (
    <div>
      <h3>Container: {childNodes.length} nodes</h3>
      {/* Render container UI */}
    </div>
  );
};
```

### Event Handling

#### Preventing Modal Auto-Open
```typescript
// ❌ WRONG - Opens modal on any node interaction
const onNodeClick = (event: React.MouseEvent, node: Node) => {
  openModal(node);  // ❌ Opens on select, drag, etc.
};

// ✅ CORRECT - Separate selection and edit events
const onNodeClick = (event: React.MouseEvent, node: Node) => {
  // Selection only
  console.log('[Selection] Node selected (no modal)', node.id);
};

const onNodeEdit = (node: Node) => {
  // Explicit edit action
  console.log('[Edit] Opening modal', node.id);
  openModal(node);
};

// In BaseNode component
const EditButton = ({ onClick }) => (
  <button 
    onClick={(e) => {
      e.stopPropagation();  // ✅ Prevent node selection
      e.preventDefault();   // ✅ Prevent default behavior
      onClick();
    }}
  >
    Edit
  </button>
);
```

### Layout & Auto-Layout

#### Auto-Layout Algorithm
```typescript
// Layout child nodes within container
const layoutContainer = (
  containerId: string,
  childNodes: Node[],
  containerType: 'multi-step' | 'group'
): Node[] => {
  if (containerType === 'multi-step') {
    // Horizontal arrangement with spacing
    return childNodes.map((node, index) => ({
      ...node,
      position: {
        x: index * 250 + 50,  // Spacing between steps
        y: 80,                // Vertical offset from top
      },
    }));
  } else {
    // Vertical stacking
    return childNodes.map((node, index) => ({
      ...node,
      position: {
        x: 50,
        y: index * 150 + 50,
      },
    }));
  }
};
```

#### Auto-Connect Sequential Nodes
```typescript
const createSequentialEdges = (childNodes: Node[]): Edge[] => {
  return childNodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${childNodes[index + 1].id}`,
    source: node.id,
    target: childNodes[index + 1].id,
    type: 'smoothstep',
    animated: true,
  }));
};
```

---

## 🐛 Debugging Strategies

### 1. Ordering Verification Logging

**When to Use**: Any time you modify the nodes array, especially for parent-child operations.

```typescript
const logNodeOrdering = (nodes: Node[], label: string) => {
  console.log(`🎯 ${label}`);
  nodes.forEach((node, idx) => {
    console.log(
      `  [${idx}] ${node.id}` +
      (node.parentId ? ` (child of ${node.parentId})` : ' (root)')
    );
  });
};

// Usage
const updatedNodes = insertChildNode(nodes, childNode, parentId);
logNodeOrdering(updatedNodes, 'After insertion');
```

### 2. Event Source Logging

**When to Use**: Debugging event handling issues (modal auto-open, click conflicts).

```typescript
const handleNodeClick = (event: React.MouseEvent, node: Node) => {
  console.log('[Selection] 🖱️ Node clicked', {
    nodeId: node.id,
    eventType: event.type,
    target: event.target,
  });
};

const handleEditButton = (event: React.MouseEvent) => {
  console.log('[Edit] ✏️ Edit button clicked');
  event.stopPropagation();
  event.preventDefault();
  // Open modal
};
```

### 3. React Flow Error Patterns

**Common Errors**:
```
❌ "Parent node not found. Parent nodes must be in front of children"
   → Check array ordering (parent before child)
   → Check for multiple setNodes() calls

❌ "Cannot read properties of undefined (reading 'position')"
   → Node doesn't exist when React Flow tries to render it
   → Check for race conditions in setNodes()

❌ "Extent requires a parent node"
   → Setting extent: 'parent' but parentId is missing/invalid
   → Verify parent node exists in array

❌ Node doesn't render but no error
   → Check node.type matches registered node types
   → Check nodeTypes prop on ReactFlow component
```

### 4. React Flow DevTools

**Enable React Flow DevTools**:
```typescript
import { ReactFlowProvider } from '@xyflow/react';

<ReactFlowProvider>
  <ReactFlow
    nodes={nodes}
    edges={edges}
    // ... other props
  />
</ReactFlowProvider>
```

**Useful Console Commands** (in browser DevTools):
```javascript
// Get all nodes
window.reactFlowInstance.getNodes()

// Get specific node
window.reactFlowInstance.getNode('node-id')

// Get all edges
window.reactFlowInstance.getEdges()

// Get viewport
window.reactFlowInstance.getViewport()
```

---

## 🎓 React Flow Concepts (Quick Reference)

### Terminology

**Node**: Visual element on the canvas. Can have custom rendering, handles, and data.

**Edge**: Connection between two nodes (source → target). Can be styled and customized.

**Handle**: Connection point on a node (also called "port"). Edges attach to handles.

**Viewport**: The visible canvas area. Has x, y (pan) and zoom properties.

**Parent-Child**: Hierarchical relationship where child nodes move with parent, use relative positioning.

**Extent**: Constrains node movement. `extent: 'parent'` keeps child inside parent bounds.

### Node Structure
```typescript
interface Node {
  id: string;                    // Unique identifier
  type?: string;                 // Maps to custom node component
  data: Record<string, any>;     // Custom data passed to component
  position: { x: number; y: number };  // Absolute or relative to parent
  parentId?: string;             // v12: Parent node reference
  extent?: 'parent' | [number, number, number, number];
  hidden?: boolean;              // Hide without removing
  selected?: boolean;            // Selection state
  draggable?: boolean;           // Can be dragged
  selectable?: boolean;          // Can be selected
  connectable?: boolean;         // Can connect edges
  deletable?: boolean;           // Can be deleted
  style?: React.CSSProperties;   // Inline styles
  className?: string;            // CSS class
  zIndex?: number;               // Stacking order
}
```

### Edge Structure
```typescript
interface Edge {
  id: string;                    // Unique identifier
  source: string;                // Source node ID
  target: string;                // Target node ID
  sourceHandle?: string;         // Specific source handle
  targetHandle?: string;         // Specific target handle
  type?: 'default' | 'smoothstep' | 'step' | 'straight';
  animated?: boolean;            // Animated flow effect
  label?: string | ReactNode;    // Edge label
  markerEnd?: { type: MarkerType; };  // Arrow marker
  style?: React.CSSProperties;
  data?: Record<string, any>;    // Custom data
}
```

### Handle Types
```typescript
// In custom node component
import { Handle, Position } from '@xyflow/react';

<Handle
  type="source"           // or "target"
  position={Position.Right}  // Top, Right, Bottom, Left
  id="handle-1"          // For multiple handles
  isConnectable={true}
/>
```

---

## 📊 Performance Optimization

### 1. Minimize setNodes Calls
```typescript
// ❌ BAD - Multiple re-renders
setNodes(addNode(nodes, node1));
setNodes(addNode(nodes, node2));
setNodes(addNode(nodes, node3));

// ✅ GOOD - Single re-render
const updatedNodes = [
  ...nodes,
  node1,
  node2,
  node3,
];
setNodes(updatedNodes);
```

### 2. Memoize Child Queries
```typescript
// In container component
const childNodes = useMemo(() => {
  return allNodes.filter(n => n.parentId === id);
}, [allNodes, id]);  // ✅ Only recompute when dependencies change
```

### 3. Use Node Extent for Constraints
```typescript
// Better performance than custom drag handlers
const childNode: Node = {
  id: 'child',
  parentId: 'parent',
  extent: 'parent',  // ✅ Built-in constraint
};
```

### 4. Disable Unnecessary Features
```typescript
<ReactFlow
  nodes={nodes}
  edges={edges}
  nodesDraggable={!readOnly}     // Disable dragging in read-only mode
  nodesConnectable={!readOnly}   // Disable connections
  elementsSelectable={!readOnly} // Disable selection
  zoomOnScroll={!readOnly}       // Disable zoom
  panOnDrag={!readOnly}          // Disable pan
/>
```

---

## 🔗 Related Resources

### Official Documentation
- [React Flow Docs](https://reactflow.dev)
- [React Flow Examples](https://reactflow.dev/examples)
- [API Reference](https://reactflow.dev/api-reference)
- [Sub-Flows Tutorial](https://reactflow.dev/learn/layouting/sub-flows)

### ProjectMeats Documentation
- [Design System](../DESIGN_SYSTEM.md)
- [Frontend Standards](../../.github/instructions/frontend.instructions.md)
- [Workflow Editor User Guide](./USER_GUIDE_WORKFLOW_EDITOR.md)

### Related PRs (Historical Reference)
- **#2770**: Container drop race condition fix (single setNodes call)
- **#2768**: Debug logging for node ordering issues
- **#2765**: Parent-child array ordering fix
- **#2764**: Node click modal behavior verification
- **#2759**: Container node count reactivity fix
- **#2753**: parentNode → parentId migration

---

## 🔄 Maintenance Notes

**Last Reviewed**: 2026-02-09  
**Next Review**: 2026-05-09 (Quarterly)

**Update Triggers**:
- React Flow major version upgrade
- New parent-child patterns discovered
- Performance issues identified
- New debugging techniques found

**Document Owner**: Infrastructure Team

---

## 📝 Session History (Feb 9, 2026)

### Issues Resolved Today
1. ✅ Nodes vanishing when dropped into containers
2. ✅ Container node count not updating
3. ✅ Modal auto-opening on node click
4. ✅ Race conditions in setNodes calls

### PRs Merged Today
- PR #2764: Enhanced logging for node click behavior
- PR #2765: Fixed parent-child array ordering
- PR #2768: Added extensive debug logging
- PR #2770: **CRITICAL** - Single setNodes call pattern

### Key Insights
- Multiple `setNodes()` calls = race conditions (even with perfect ordering)
- React Flow processes nodes before React's batching completes
- Array ordering is necessary but NOT sufficient
- Debugging logging was instrumental in finding root cause

### Time Investment
- Investigation: ~4 hours (extensive logging, testing)
- Implementation: ~1 hour (batching updates)
- Testing & Deployment: ~1 hour
- **Total**: ~6 hours for complete fix

**Lesson**: The obvious solution (array ordering) wasn't enough. Deep debugging with logging revealed the true async race condition issue.

---

**End of Document** - Last Updated: 2026-02-09 05:18 UTC
