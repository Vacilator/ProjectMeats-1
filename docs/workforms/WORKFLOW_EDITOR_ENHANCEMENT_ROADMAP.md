# Workflow Editor Enhancement Roadmap

> NOTE: This is a reference roadmap document (not a canonical backlog).
> 
> Current priorities/status: `MASTER_PLAN.md` (canonical) and `.github/MASTER_PLAN.md` (PR log)

---

## 🎯 Purpose

This document outlines future enhancements for the ProjectMeats Workflow Editor based on React Flow best practices, case studies, and production experience. Use this as a reference for planning sprints and feature development.

---

## ✅ Current State (As of Feb 9, 2026)

### Implemented Features
- ✅ Visual workflow editor with drag-and-drop
- ✅ Custom node types (FormStep, FormField, CreateRecord, etc.)
- ✅ Container nodes (Multi-Step, Group, Document)
- ✅ Parent-child relationships with auto-layout
- ✅ Auto-connect sequential steps
- ✅ Node edit/delete controls (appear on hover)
- ✅ Node expand/collapse
- ✅ Title editing (inline)
- ✅ Connection validation
- ✅ Zoom/pan controls
- ✅ Undo/redo
- ✅ Workflow save/load
- ✅ Template system
- ✅ Real-time preview

### Known Working Patterns
- ✅ Single `setNodes()` call pattern (race condition fix)
- ✅ Parent-child array ordering (parent before child)
- ✅ React Flow v12 API (`parentId` instead of `parentNode`)
- ✅ Order-preserving updates with `.map()`
- ✅ Separate selection and edit events

### Recent Fixes (Feb 9, 2026)
- 🔧 Fixed container drop race condition (PR #2770)
- 🔧 Fixed node vanishing on drop (PR #2765, #2768)
- 🔧 Fixed modal auto-open behavior (PR #2764)
- 🔧 Fixed container node count reactivity (PR #2759)

### Major Achievements (Feb 17-18, 2026) ✨
**Phase E.1: FlowEditor Foundation Complete**

- ✅ **Shared Components Library** (PR #2939) - 40+ reusable styled components, single source of truth
- ✅ **Shared Hooks Library** (PR #2941) - 4 powerful hooks (Modal, Panel, Validation, NodeConfig)
- ✅ **FlowEditorContext** (PR #2944) - Centralized state management, eliminates 40+ props
- ✅ **Panel Migration POC** (PR #2945) - 2 panels migrated, 32% code reduction validated

**Impact**:
- 2,050 lines of reusable foundation created
- 292 lines eliminated from 2 panels
- Projected: 2,900+ lines reduction at full migration (21 panels)
- Developer velocity: +50% (less boilerplate)
- Maintenance cost: -60% (single source of truth)

**Next**: Phase E.2 - Migrate remaining 19 config panels

---

## 🚀 Enhancement Categories

### 1. Code Architecture & Refactoring (In Progress) 🔨
### 2. Visual Enhancements (UX/UI Polish)
### 3. Collaboration Features (Multi-User)
### 4. Advanced Layout & Organization
### 5. Performance & Scalability
### 6. Accessibility & Mobile
### 7. Developer Experience (DX)
### 8. Advanced Workflow Features
### 9. AI & Automation

---

## 1️⃣ Code Architecture & Refactoring

### 1.1 FlowEditor Foundation & Panel Migration
**Status**: 🟢 Phase E.1 Complete, Phase E.2 In Progress  
**Priority**: ⭐ Critical (Technical Debt Reduction)  
**Effort**: 5-7 days total (E.1: 2 days ✅ | E.2: 3-5 days)

**Phase E.1: Foundation** ✅ COMPLETE (Feb 17-18, 2026)

**Achievements**:
- ✅ Created shared styled components library (639 lines, 40+ components)
- ✅ Created shared hooks library (1,004 lines, 4 hooks)
- ✅ Created FlowEditorContext (386 lines, 14 state categories)
- ✅ Migrated 2 panels as proof of concept (292 lines eliminated, 32% reduction)
- ✅ All PRs merged: #2939, #2941, #2944, #2945

**Impact**:
- Single source of truth for panel styling
- Eliminated 292 lines in 2 panels (15% and 44% reductions)
- Foundation validated and ready for full migration

**Phase E.2: Full Panel Migration** 🚧 NEXT

**Goal**: Migrate remaining 19 config panels to shared components

**Panels to Migrate**:
- [ ] FormStepConfigPanel (high reduction expected)
- [ ] FormFieldConfigPanel (high reduction expected)
- [ ] DocumentConfigPanel
- [ ] SectionConfigPanel
- [ ] FormReferenceConfigPanel
- [ ] ContainerConfigPanel
- [ ] ApprovalConfigPanel
- [ ] AssignTaskConfigPanel
- [ ] NotificationConfigPanel
- [ ] WebhookConfigPanel
- [ ] UpdateRecordConfigPanel
- [ ] DeleteRecordConfigPanel
- [ ] SendEmailConfigPanel (already migrated: OutlookEmailConfigPanel)
- [ ] APICallConfigPanel
- [ ] ConditionalConfigPanel
- [ ] LoopConfigPanel
- [ ] DelayConfigPanel
- [ ] CalculateConfigPanel
- [ ] TransformConfigPanel

**Projected Impact**:
- Total lines before: ~8,400
- Total lines after: ~5,500
- Lines eliminated: **~2,900 (35% reduction)**
- Props eliminated: **~840 (40+ per panel × 21)**
- Maintenance effort: **-60%**

**Approach**:
1. Migrate in batches of 3-5 panels
2. Create PR per batch for easier review
3. Track cumulative metrics
4. Validate each batch before proceeding

**Phase E.3: FormProcess Multi-Step Containers** ✅ COMPLETE (Feb 19, 2026)

**Goal**: Implement full-featured multi-step form containers with parent-child support

**Achievements**:
- ✅ Created FormProcessGroupNode with labeled group pattern (PR #3046)
- ✅ Implemented vertical auto-layout (baseY=60px, spacing=120px)
- ✅ Added smooth expand/collapse animations (0.3s cubic-bezier)
- ✅ Dynamic re-layouting via useEffect monitoring child count
- ✅ Selection grouping (React Flow native multi-select)
- ✅ Fixed entity dropdown bug - tenant_apps namespace (PR #3049)
- ✅ Extended schema system with 'nested-children' field type (PR #3053)
- ✅ Created NestedChildrenRenderer (11KB, 350 lines)
- ✅ Integrated nested children into DynamicConfigPanel

**Technical Details**:
- FormProcessGroupNode uses `isGroup: true`, `parentId`, `extent: 'parent'`
- Single-tree pattern (no nested React Flow instances)
- Auto-layout algorithm: `y = baseY + (index × spacing)`
- CSS transitions for smooth animations
- Bundle size: 2,417.97 kB (+2.66 kB = +0.11%)
- Build time: 18.51s (acceptable)

**Impact**:
- Unlimited steps per container (tested 20+)
- Drag-drop from palette into containers
- Drag steps between containers (re-parenting)
- Context menu support (Add Step, Duplicate, Delete)
- Nested children infrastructure ready for future use

**Phase E.4: Sub-Flow Export & Reusability** 📋 PLANNED

**Goal**: Enable saving and reusing FormProcess containers as templates

- [ ] Implement sub-flow export function (JSON serialization)
- [ ] Create sub-flow import dialog/modal
- [ ] Add "Export as Template" to context menu
- [ ] Build template library/picker component
- [ ] Support versioning and metadata
- [ ] Enable cross-workflow template sharing

---

## 2️⃣ Visual Enhancements (UX/UI Polish)

### 1.1 Enhanced Edge Styling
**Status**: 🟡 Partially Implemented  
**Priority**: Medium  
**Effort**: 1-2 days

**Current State**: Basic edges with no visual hierarchy

**Enhancements**:
- [ ] Add arrow markers to show flow direction (markerEnd)
- [ ] Different edge styles for different logic types (conditional, loop, success, error)
- [ ] Animated edges for active workflow paths
- [ ] Edge labels with conditions/actions
- [ ] Custom edge colors based on relationship type
- [ ] Dashed edges for optional paths
- [ ] Edge hover effects with tooltip

**Implementation**:
```typescript
// In UnifiedFlowEditor.tsx
const defaultEdgeOptions = {
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 20,
    height: 20,
  },
  style: {
    strokeWidth: 2,
  },
};

// Custom edge types
const edgeTypes = {
  conditional: ConditionalEdge,  // Diamond marker
  error: ErrorEdge,              // Red with warning icon
  success: SuccessEdge,          // Green with checkmark
  loop: LoopEdge,                // Curved back arrow
};
```

**Inspiration**: Carto case study uses color-coded edges for different data pipeline stages.

---

### 1.2 Minimap Enhancement
**Status**: 🔴 Not Implemented  
**Priority**: Low  
**Effort**: 1 day

**Current State**: No minimap

**Enhancements**:
- [ ] Add minimap for large workflows (React Flow built-in component)
- [ ] Highlight current viewport
- [ ] Click to navigate
- [ ] Show node density heatmap
- [ ] Minimap toggle button

**Implementation**:
```typescript
import { MiniMap } from '@xyflow/react';

<ReactFlow ...>
  <MiniMap
    nodeColor={(node) => {
      switch (node.type) {
        case 'formStep': return '#667eea';
        case 'condition': return '#f59e0b';
        default: return '#64748b';
      }
    }}
    maskColor="rgb(50, 50, 50, 0.6)"
  />
</ReactFlow>
```

---

### 1.3 Background Grid & Patterns
**Status**: 🟢 Implemented (Basic)  
**Priority**: Low  
**Effort**: 0.5 days

**Current State**: Basic dot grid

**Enhancements**:
- [ ] Multiple grid patterns (dots, lines, cross)
- [ ] Grid snap settings (configurable snap distance)
- [ ] Background color themes
- [ ] Custom background patterns

**Implementation**:
```typescript
import { Background } from '@xyflow/react';

<Background
  variant="dots"  // or "lines" or "cross"
  gap={20}
  size={1}
  color="#94a3b8"
/>
```

---

### 1.4 Node Visual Enhancements
**Status**: 🟢 Mostly Complete  
**Priority**: Low  
**Effort**: 2-3 days

**Current State**: Basic node styling with hover controls

**Future Enhancements**:
- [ ] Node icons library (visual type indicators)
- [ ] Drag preview with semi-transparency
- [ ] Node badges for status (error, warning, success)
- [ ] Progress indicators for long-running nodes
- [ ] Node pinning (prevent accidental moves)
- [ ] Node locking (prevent edits)
- [ ] Custom node shapes (not just rectangles)

**Implementation**:
```typescript
// Node status badges
interface NodeBadge {
  status: 'error' | 'warning' | 'success' | 'processing';
  message: string;
}

// In BaseNode.tsx
const StatusBadge = ({ status, message }: NodeBadge) => (
  <div className={`status-badge status-${status}`}>
    <Icon name={status} />
    <Tooltip content={message} />
  </div>
);
```

---

## 2️⃣ Collaboration Features (Multi-User)

### 2.1 Real-Time Collaboration
**Status**: 🔴 Not Implemented  
**Priority**: High (Future)  
**Effort**: 2-3 weeks

**Vision**: Multiple users editing the same workflow simultaneously (like FigJam/Miro)

**Features**:
- [ ] Live cursors showing other users' positions
- [ ] User avatars on canvas
- [ ] Real-time node position sync (WebSocket)
- [ ] Collaborative selection (see what others select)
- [ ] Presence indicators (who's viewing)
- [ ] Conflict resolution (optimistic locking)
- [ ] Activity feed ("John added a step")
- [ ] Comments & mentions on nodes

**Technology Stack**:
- WebSocket (Django Channels)
- Operational Transformation or CRDT for conflict resolution
- Redis for presence tracking

**Inspiration**: DoubleLoop case study mentions leveling up to FigJam/Miro-like experience.

**Implementation Notes**:
```typescript
// WebSocket message types
interface CollaborationMessage {
  type: 'node_move' | 'node_add' | 'node_delete' | 'cursor_move';
  userId: string;
  timestamp: number;
  data: any;
}

// In UnifiedFlowEditor.tsx
const { cursors, users } = useCollaboration(workflowId);

<ReactFlow ...>
  {cursors.map(cursor => (
    <UserCursor
      key={cursor.userId}
      position={cursor.position}
      user={cursor.user}
    />
  ))}
</ReactFlow>
```

---

### 2.2 Commenting System
**Status**: 🔴 Not Implemented  
**Priority**: Medium  
**Effort**: 1 week

**Features**:
- [ ] Click to add comment on node or edge
- [ ] Comment threads
- [ ] @mentions to notify users
- [ ] Resolved/unresolved states
- [ ] Comment count badge on nodes
- [ ] Filter by commenter

**Implementation**:
```typescript
interface Comment {
  id: string;
  workflowId: string;
  nodeId?: string;
  edgeId?: string;
  userId: string;
  text: string;
  mentions: string[];
  resolved: boolean;
  createdAt: string;
  replies: Comment[];
}

// Comment overlay component
const CommentMarker = ({ nodeId, count }: { nodeId: string; count: number }) => (
  <div className="comment-marker" onClick={() => openComments(nodeId)}>
    <MessageCircle />
    <span>{count}</span>
  </div>
);
```

---

### 2.3 Version History & Diff Viewer
**Status**: 🔴 Not Implemented  
**Priority**: Medium  
**Effort**: 1 week

**Features**:
- [ ] Auto-save versions on major changes
- [ ] Version list with timestamps
- [ ] Side-by-side diff view (before/after)
- [ ] Restore previous version
- [ ] Branch/fork workflows
- [ ] Merge workflows

**Implementation**:
```typescript
interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  createdBy: string;
  createdAt: string;
  nodes: Node[];
  edges: Edge[];
  changeDescription: string;
}

// Diff viewer
const WorkflowDiff = ({ versionA, versionB }: { versionA: WorkflowVersion; versionB: WorkflowVersion }) => (
  <div className="diff-container">
    <ReactFlow nodes={versionA.nodes} edges={versionA.edges} />
    <ReactFlow nodes={versionB.nodes} edges={versionB.edges} />
  </div>
);
```

---

## 3️⃣ Advanced Layout & Organization

### 3.1 Auto-Layout Algorithms
**Status**: 🟡 Basic Implementation  
**Priority**: High  
**Effort**: 1-2 weeks

**Current State**: Manual layout with basic container auto-layout

**Enhancements**:
- [ ] Dagre layout (hierarchical top-down)
- [ ] ELK layout (advanced graph layout)
- [ ] Force-directed layout (organic)
- [ ] Radial layout (center-out)
- [ ] Tree layout (parent-child hierarchy)
- [ ] Auto-layout on demand (button click)
- [ ] Layout animation (smooth transitions)

**Implementation**:
```typescript
// Use dagre for hierarchical layout
import dagre from 'dagre';

const autoLayout = (nodes: Node[], edges: Edge[]): Node[] => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR', ranksep: 100, nodesep: 50 });
  
  nodes.forEach(node => {
    dagreGraph.setNode(node.id, { width: 200, height: 100 });
  });
  
  edges.forEach(edge => {
    dagreGraph.setEdge(edge.source, edge.target);
  });
  
  dagre.layout(dagreGraph);
  
  return nodes.map(node => {
    const position = dagreGraph.node(node.id);
    return { ...node, position: { x: position.x, y: position.y } };
  });
};
```

**Inspiration**: Carto uses custom layouts for data pipeline visualization.

---

### 3.2 Groups & Swimlanes
**Status**: 🟡 Groups Implemented  
**Priority**: Medium  
**Effort**: 1 week

**Enhancements**:
- [ ] Swimlanes (horizontal/vertical lanes for organization)
- [ ] Collapsible groups
- [ ] Group resizing
- [ ] Nested groups
- [ ] Group templates
- [ ] Auto-group by type/category

**Implementation**:
```typescript
// Swimlane component
const Swimlane = ({ id, title, color, width }: SwimlaneProps) => (
  <div 
    className="swimlane"
    style={{
      position: 'absolute',
      width: width,
      height: '100%',
      backgroundColor: `${color}10`,
      borderLeft: `4px solid ${color}`,
    }}
  >
    <h3>{title}</h3>
  </div>
);

// Swimlanes overlay
const Swimlanes = () => (
  <div className="swimlanes">
    <Swimlane id="input" title="Input" color="#3b82f6" width={300} />
    <Swimlane id="process" title="Process" color="#f59e0b" width={400} />
    <Swimlane id="output" title="Output" color="#10b981" width={300} />
  </div>
);
```

---

### 3.3 Node Alignment & Distribution
**Status**: 🔴 Not Implemented  
**Priority**: Low  
**Effort**: 3-4 days

**Features**:
- [ ] Align selected nodes (left, right, top, bottom, center)
- [ ] Distribute nodes evenly (horizontal, vertical)
- [ ] Snap to grid/guides
- [ ] Smart guides (like Figma)
- [ ] Alignment shortcuts

**Implementation**:
```typescript
const alignNodes = (nodes: Node[], alignment: 'left' | 'right' | 'top' | 'bottom' | 'center'): Node[] => {
  const selectedNodes = nodes.filter(n => n.selected);
  if (selectedNodes.length < 2) return nodes;
  
  let targetValue: number;
  switch (alignment) {
    case 'left':
      targetValue = Math.min(...selectedNodes.map(n => n.position.x));
      return nodes.map(n => 
        n.selected ? { ...n, position: { ...n.position, x: targetValue } } : n
      );
    // ... other alignments
  }
};
```

---

## 4️⃣ Performance & Scalability

### 4.1 Virtualization for Large Workflows
**Status**: 🔴 Not Implemented  
**Priority**: High (if workflows >100 nodes)  
**Effort**: 1 week

**Problem**: Performance degrades with 100+ nodes

**Solution**: Only render visible nodes (viewport culling)

**Implementation**:
```typescript
// React Flow has built-in viewport culling
// But can be enhanced with:

const onlyRenderVisibleNodes = true; // Built-in prop

// Custom optimization
const filteredNodes = useMemo(() => {
  if (nodes.length < 100) return nodes;
  
  const viewport = getViewport();
  return nodes.filter(node => {
    return isInViewport(node.position, viewport);
  });
}, [nodes, viewport]);
```

---

### 4.2 Lazy Loading & Code Splitting
**Status**: 🟡 Partial  
**Priority**: Medium  
**Effort**: 2-3 days

**Features**:
- [ ] Lazy load node components
- [ ] Lazy load heavy config panels
- [ ] Code split by feature
- [ ] Progressive loading (skeleton screens)

**Implementation**:
```typescript
// Lazy load node types
const FormStepNode = lazy(() => import('./nodes/FormStepNode'));
const CreateRecordNode = lazy(() => import('./nodes/CreateRecordNode'));

const nodeTypes = {
  formStep: (props: NodeProps) => (
    <Suspense fallback={<NodeSkeleton />}>
      <FormStepNode {...props} />
    </Suspense>
  ),
  createRecord: (props: NodeProps) => (
    <Suspense fallback={<NodeSkeleton />}>
      <CreateRecordNode {...props} />
    </Suspense>
  ),
};
```

---

### 4.3 Workflow Pagination & Subflows
**Status**: 🔴 Not Implemented  
**Priority**: Medium (for complex workflows)  
**Effort**: 2 weeks

**Vision**: Break large workflows into pages/subflows

**Features**:
- [ ] Subflow nodes (double-click to drill down)
- [ ] Breadcrumb navigation
- [ ] Subflow inputs/outputs
- [ ] Subflow library (reusable)
- [ ] Page tabs

**Implementation**:
```typescript
// Subflow node
const SubflowNode = ({ id, data }: NodeProps) => {
  const navigate = useNavigate();
  
  return (
    <div onDoubleClick={() => navigate(`/workflow/${data.subflowId}`)}>
      <h3>{data.title}</h3>
      <p>{data.nodeCount} nodes</p>
    </div>
  );
};

// Breadcrumb navigation
const WorkflowBreadcrumb = () => {
  const { path } = useWorkflowContext();
  return (
    <div className="breadcrumb">
      {path.map((workflow, i) => (
        <span key={i}>
          <Link to={`/workflow/${workflow.id}`}>{workflow.name}</Link>
          {i < path.length - 1 && ' / '}
        </span>
      ))}
    </div>
  );
};
```

**Reference**: [React Flow Sub-Flows Tutorial](https://reactflow.dev/learn/layouting/sub-flows)

---

## 5️⃣ Accessibility & Mobile

### 5.1 Keyboard Navigation
**Status**: 🟡 Basic  
**Priority**: High  
**Effort**: 1 week

**Current State**: Basic keyboard shortcuts (delete, undo/redo)

**Enhancements**:
- [ ] Tab through nodes in order
- [ ] Arrow keys to move selection
- [ ] Enter to edit selected node
- [ ] Escape to close modals
- [ ] Ctrl+A to select all
- [ ] Custom keyboard shortcut config
- [ ] Keyboard shortcut cheatsheet

**Implementation**:
```typescript
// Keyboard shortcut manager
const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Tab navigation
      if (e.key === 'Tab') {
        e.preventDefault();
        selectNextNode();
      }
      
      // Arrow keys to move node
      if (e.key.startsWith('Arrow') && selectedNode) {
        e.preventDefault();
        moveNode(selectedNode.id, getDirection(e.key), 10);
      }
      
      // Enter to edit
      if (e.key === 'Enter' && selectedNode) {
        openEditModal(selectedNode);
      }
    };
    
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedNode]);
};
```

---

### 5.2 Screen Reader Support
**Status**: 🔴 Minimal  
**Priority**: Medium  
**Effort**: 1 week

**Features**:
- [ ] ARIA labels for all interactive elements
- [ ] Announce node selection changes
- [ ] Describe workflow structure
- [ ] Edge relationship announcements
- [ ] Accessible modals with focus management

**Implementation**:
```typescript
// Accessible node component
const AccessibleNode = ({ data, selected }: NodeProps) => (
  <div
    role="button"
    tabIndex={0}
    aria-label={`${data.type} node: ${data.title}`}
    aria-selected={selected}
    aria-describedby={`node-desc-${id}`}
  >
    <h3>{data.title}</h3>
    <p id={`node-desc-${id}`} className="sr-only">
      {data.description}
    </p>
  </div>
);

// Announce selection changes
const AnnounceSelection = ({ selectedNode }: { selectedNode: Node | null }) => {
  const [announcement, setAnnouncement] = useState('');
  
  useEffect(() => {
    if (selectedNode) {
      setAnnouncement(`Selected ${selectedNode.data.type}: ${selectedNode.data.title}`);
    }
  }, [selectedNode]);
  
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );
};
```

---

### 5.3 Mobile/Tablet Support
**Status**: 🔴 Desktop Only  
**Priority**: Low (depends on user demand)  
**Effort**: 2-3 weeks

**Challenges**:
- Touch gestures (pinch to zoom, pan)
- Small screen layout
- No hover states
- Touch targets (minimum 44x44px)

**Features**:
- [ ] Touch-optimized controls
- [ ] Mobile-friendly node palette (bottom drawer)
- [ ] Simplified UI for small screens
- [ ] Read-only mode for mobile
- [ ] Responsive breakpoints

---

## 6️⃣ Developer Experience (DX)

### 6.1 Node Type Registry & Hot Reload
**Status**: 🟡 Basic Registry  
**Priority**: Low  
**Effort**: 3-4 days

**Features**:
- [ ] Plugin system for custom nodes
- [ ] Hot reload during development
- [ ] Node type validation
- [ ] Auto-register nodes from directory

**Implementation**:
```typescript
// Auto-register node types
const nodeTypes = importAll(
  require.context('./nodes', false, /Node\.tsx$/)
).reduce((acc, module) => {
  const nodeType = module.default;
  acc[nodeType.type] = nodeType.component;
  return acc;
}, {});

// Hot reload in development
if (import.meta.hot) {
  import.meta.hot.accept('./nodes', () => {
    console.log('[HMR] Reloading node types...');
    // Re-register node types
  });
}
```

---

### 6.2 Workflow Testing Framework
**Status**: 🔴 Not Implemented  
**Priority**: Medium  
**Effort**: 1-2 weeks

**Features**:
- [ ] Unit tests for node logic
- [ ] Integration tests for workflow execution
- [ ] Visual regression tests for nodes
- [ ] Mock data generator for testing
- [ ] Test workflow templates

**Implementation**:
```typescript
// Workflow test helper
describe('Purchase Order Workflow', () => {
  it('should create PO when form submitted', async () => {
    const workflow = loadWorkflow('po-creation');
    const testData = { supplier: 'ACME', amount: 1000 };
    
    const result = await executeWorkflow(workflow, testData);
    
    expect(result.status).toBe('success');
    expect(result.outputs.purchaseOrder).toBeDefined();
  });
  
  it('should show validation error for negative amount', async () => {
    const workflow = loadWorkflow('po-creation');
    const testData = { supplier: 'ACME', amount: -100 };
    
    const result = await executeWorkflow(workflow, testData);
    
    expect(result.status).toBe('error');
    expect(result.errors).toContain('Amount must be positive');
  });
});
```

---

### 6.3 Workflow Debugging Tools
**Status**: 🔴 Not Implemented  
**Priority**: High  
**Effort**: 1-2 weeks

**Features**:
- [ ] Step-through debugger
- [ ] Breakpoints on nodes
- [ ] Variable inspector
- [ ] Execution timeline
- [ ] Node output preview
- [ ] Error stack traces

**Implementation**:
```typescript
// Debugger panel
const WorkflowDebugger = ({ workflowId }: { workflowId: string }) => {
  const { execution, currentNode } = useWorkflowExecution(workflowId);
  
  return (
    <div className="debugger-panel">
      <div className="execution-controls">
        <button onClick={stepInto}>Step Into</button>
        <button onClick={stepOver}>Step Over</button>
        <button onClick={continue_}>Continue</button>
      </div>
      
      <div className="variables">
        <h3>Variables</h3>
        <pre>{JSON.stringify(execution.variables, null, 2)}</pre>
      </div>
      
      <div className="timeline">
        <h3>Execution Timeline</h3>
        {execution.timeline.map(event => (
          <div key={event.timestamp} className="timeline-event">
            <span>{event.nodeId}</span>
            <span>{event.action}</span>
            <span>{event.duration}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 7️⃣ Advanced Workflow Features

### 7.1 Conditional Logic & Branching
**Status**: 🟡 Basic Conditions  
**Priority**: High  
**Effort**: 1 week

**Enhancements**:
- [ ] Visual condition builder (no-code)
- [ ] Multiple condition branches
- [ ] Default/else branch
- [ ] Complex boolean logic (AND/OR/NOT)
- [ ] Condition testing

**Implementation**:
```typescript
// Conditional edge component
const ConditionalEdge = ({ data }: EdgeProps) => {
  return (
    <BaseEdge {...props}>
      <EdgeLabel style={{ fill: '#f59e0b' }}>
        {data.condition.display}
      </EdgeLabel>
      <Tooltip content={data.condition.expression} />
    </BaseEdge>
  );
};

// Condition builder UI
const ConditionBuilder = () => (
  <div className="condition-builder">
    <select name="field">
      <option>Order Total</option>
      <option>Customer Type</option>
    </select>
    <select name="operator">
      <option>equals</option>
      <option>greater than</option>
      <option>less than</option>
    </select>
    <input name="value" type="text" />
  </div>
);
```

---

### 7.2 Loops & Iterations
**Status**: 🔴 Not Implemented  
**Priority**: Medium  
**Effort**: 1 week

**Features**:
- [ ] For-each loop node
- [ ] While loop node
- [ ] Loop counter/index
- [ ] Break/continue logic
- [ ] Batch processing

---

### 7.3 Error Handling & Retry Logic
**Status**: 🔴 Not Implemented  
**Priority**: High  
**Effort**: 1 week

**Features**:
- [ ] Try-catch blocks
- [ ] Error edges (separate path)
- [ ] Retry configuration (attempts, delay)
- [ ] Fallback nodes
- [ ] Error logging

---

### 7.4 Variables & Data Flow
**Status**: 🟡 Basic  
**Priority**: High  
**Effort**: 2 weeks

**Enhancements**:
- [ ] Variable scope visualization
- [ ] Data flow tracing (highlight path)
- [ ] Type checking
- [ ] Transformation functions
- [ ] Data preview at each step

---

## 8️⃣ AI & Automation

### 8.1 AI-Assisted Workflow Building
**Status**: 🔴 Not Implemented  
**Priority**: Low (Future)  
**Effort**: 4-6 weeks

**Vision**: Natural language to workflow

**Features**:
- [ ] "Create a workflow that..." → AI generates nodes
- [ ] Suggest next steps based on context
- [ ] Auto-complete conditions
- [ ] Workflow optimization suggestions
- [ ] Pattern recognition (common workflows)

---

### 8.2 Smart Node Recommendations
**Status**: 🔴 Not Implemented  
**Priority**: Low  
**Effort**: 1-2 weeks

**Features**:
- [ ] Suggest compatible next nodes
- [ ] Based on node type
- [ ] Based on workflow context
- [ ] Popular patterns library

---

## 📊 Prioritization Matrix

| Feature | Priority | Effort | Impact | Quarter |
|---------|----------|--------|--------|---------|
| Real-Time Collaboration | High | 3 weeks | High | Q2 2026 |
| Auto-Layout Algorithms | High | 2 weeks | High | Q2 2026 |
| Workflow Debugging Tools | High | 2 weeks | High | Q2 2026 |
| Enhanced Edge Styling | Medium | 2 days | Medium | Q1 2026 |
| Commenting System | Medium | 1 week | Medium | Q2 2026 |
| Version History | Medium | 1 week | Medium | Q2 2026 |
| Conditional Logic | High | 1 week | High | Q1 2026 |
| Error Handling | High | 1 week | High | Q1 2026 |
| Virtualization | High* | 1 week | High* | As needed |
| Keyboard Navigation | High | 1 week | High | Q1 2026 |
| Screen Reader Support | Medium | 1 week | Medium | Q2 2026 |
| Minimap | Low | 1 day | Low | Q3 2026 |
| Mobile Support | Low | 3 weeks | Low | Q3 2026 |
| AI-Assisted Building | Low | 6 weeks | Low | Q4 2026 |

*High priority if workflows exceed 100 nodes

---

## 📚 Case Study Insights

### Carto (Data Pipeline Visualization)
**Industry**: Geospatial Analytics  
**Use Case**: Visual workflow builder for data preparation & analysis

**Key Learnings**:
- Custom edge colors for different pipeline stages
- Auto-layout for complex data flow graphs
- Real-time execution visualization
- Integration with data catalog

**Applicable to ProjectMeats**:
- Similar workflow complexity (multi-step forms)
- Could adopt color-coded edges for logic types
- Execution timeline visualization

---

### DoubleLoop (Business Goal Tracking)
**Industry**: Product Management  
**Use Case**: Strategy maps and goal tracking

**Key Learnings**:
- Leveling up to FigJam/Miro-like experience
- Natural interaction patterns
- Collaborative features

**Applicable to ProjectMeats**:
- User expects Figma-like UX
- Collaboration features needed for team workflows
- Focus on intuitive interactions

---

### Hubql (Data Model Visualization)
**Industry**: Database Management  
**Use Case**: Flexible data model visualization

**Key Learnings**:
- Chose React Flow for maturity and extensibility
- Custom rendering options important
- Time savings from using library vs building from scratch

**Applicable to ProjectMeats**:
- Validation of React Flow choice
- Custom node rendering already leveraged
- Continue extending vs rebuilding

---

### OneSignal (Customer Engagement Automation)
**Industry**: Marketing Automation  
**Use Case**: Workflow builder for message automation

**Key Learnings**:
- 12 billion messages/day processed through workflows
- React Flow over building from scratch
- Visual workflow builder is core UX

**Applicable to ProjectMeats**:
- Similar scale ambitions (high-volume processing)
- Workflow builder is central to product
- Proven choice for production systems

---

## 🔄 Maintenance & Review

**Review Schedule**: Quarterly (every 3 months)

**Update Triggers**:
- React Flow major version release
- User feedback patterns
- Performance bottlenecks identified
- New case studies published
- Competitive analysis

**Document Owners**: Frontend Team

---

## 📝 Related Documentation

- [React Flow Lessons Learned](./REACT_FLOW_LESSONS_LEARNED.md)
- [Design System](./DESIGN_SYSTEM.md)
- [Frontend Standards](../.github/instructions/frontend.instructions.md)
- [React Flow Official Docs](https://reactflow.dev)
- [React Flow Case Studies](https://reactflow.dev/pro/case-studies)

---

**End of Document** - Last Updated: 2026-02-09 05:18 UTC

---

## Phase 17 Editor Stabilization (RT-05)

> **Execution gate:** RT-05 only begins after RT-01 through RT-04 are verified on `development`.  
> **Canonical reference:** `MASTER_PLAN.md` → Phase 17 / Epic RT-05

### RT-05.1: Visual Support for Complex Node Types

**Goal:** The Workform Editor must render FormProcess groups, ForEach/DoUntil loop nodes, conditional field visibility, and multi-select configuration panels so the EndToEndInquiryToPOProcess template loads and edits cleanly.

**Deliverables:**
1. `FormProcessGroupNode` — container node that visually groups child steps with collapse/expand
2. `ForEachLoopNode` / `DoUntilLoopNode` — loop nodes with iteration-count badges and internal sub-graphs
3. Conditional field rendering — fields show/hide based on trigger type or previous node outputs
4. Multi-select configuration panel — select multiple Plant Contact Types, Responsibilities, etc.
5. Auto-layout algorithm update — handle nested groups and loops without overlap

**Acceptance criteria:**
- EndToEndInquiryToPOProcess template loads in editor without errors
- Groups and loops render with correct visual hierarchy
- Auto-layout produces readable graph for 20+ node templates
- Existing simple node types remain unchanged

### RT-05.2: Create Variant Workflow

**Goal:** Operators can create process variants from existing templates without rebuilding from scratch.

**Deliverables:**
1. "Create Variant" button in editor toolbar (visible for saved templates)
2. Clone service that preserves lineage (source_template_id, variant_metadata)
3. Variant badge/indicator in template list and editor header
4. Validation that variant name is unique within tenant

**Acceptance criteria:**
- "Create Variant" produces a valid clone with new ID
- Source lineage preserved in template metadata
- Original template unchanged after variant creation
- Variant appears in template list with visual indicator

---

**Phase 17 Editor Stabilization — Last Updated: 2026-05-07**
