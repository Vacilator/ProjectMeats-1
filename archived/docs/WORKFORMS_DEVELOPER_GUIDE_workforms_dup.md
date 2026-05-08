# WorkForms Developer Guide

**Version**: 2.0
**Last Updated**: 2026-02-05
**Audience**: Developers extending or maintaining WorkForms

---

## 📖 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Structure](#component-structure)
3. [Adding New Node Types](#adding-new-node-types)
4. [Creating Config Panels](#creating-config-panels)
5. [Data Flow](#data-flow)
6. [Testing](#testing)
7. [Common Patterns](#common-patterns)
8. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Structure

```
frontend/src/components/
├── FlowEditor/
│   ├── UnifiedFlowEditor.tsx      # Main editor container
│   ├── SidePanel.tsx              # Portal-based modal wrapper
│   ├── nodeTypes.ts               # Node type registry
│   ├── nodes/                     # Node component implementations
│   │   ├── index.ts
│   │   ├── TriggerNode.tsx
│   │   ├── FormStepNode.tsx
│   │   ├── ActionNode.tsx
│   │   └── FormReferenceNode.tsx
│   ├── ConfigPanel/               # Configuration panels
│   │   ├── NodeConfigPanel.tsx    # Generic fallback
│   │   ├── FormStepConfigPanel.tsx
│   │   ├── FormFieldConfigPanel.tsx
│   │   ├── SectionConfigPanel.tsx
│   │   ├── DocumentConfigPanel.tsx
│   │   ├── CreateRecordConfigPanel.tsx
│   │   └── FormReferenceConfigPanel.tsx
│   ├── edges/                     # Custom edge components
│   └── templates/                 # Workflow templates
├── FormBuilder/                   # Standalone form builder
│   ├── FormBuilder.tsx
│   └── index.ts
└── WorkForms/                     # WorkForms pages
    ├── Catalog.tsx
    ├── FormPreviewModal.tsx
    └── FormSelectorModal.tsx
```

### Key Technologies

- **React Flow**: Visual node editor (`@xyflow/react`)
- **React Portal**: Modal rendering outside DOM hierarchy
- **Styled Components**: CSS-in-JS styling
- **TypeScript**: Type safety
- **React Query**: Server state management

### FlowEditor Portals + Schema Bootstrapping (Critical)

The FlowEditor configuration panel is rendered via a **React Portal** and depends on a schema registry that must be initialized at runtime.

**Portal containers (Vite)**:
- `frontend/index.html` must contain:
  - `#config-portal-root`
  - `#config-portal`

The editor will style/show/hide `#config-portal` when a node is selected. If these containers are missing, the config panel can fail to mount and you will see console errors.

**Schema registry bootstrapping**:
- `schemaRegistry` must be imported from `frontend/src/components/FlowEditor/config/index.ts` (not directly from `schemaRegistry.ts`).
- Importing the config index ensures `nodeConfigSchemas.ts` executes and registers schemas.

Symptoms of missing bootstrap:
- `[Schema Registry] No schema found for node type: trigger/formStep, using fallback`

Authority:
- `frontend/src/components/FlowEditor/config/index.ts`
- `frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts`
- `frontend/src/components/FlowEditor/UnifiedFlowEditor.tsx`

### Real-Time Collaboration (Phase 7.3)

ProjectMeats uses **Django Channels** to support WebSocket-based collaboration.

**WebSocket path convention**:
- `/ws/workflows/<workflow_id>/collab/?tenant_id=<tenant_uuid>`

**Requirements**:
- `tenant_id` is mandatory in the query string to prevent cross-tenant broadcast leakage.
- The backend joins a **tenant-scoped group** for the workflow session.

**Current message plumbing (scaffold)**:
- Client → Server: `{ "type": "ping" }` → `{ "type": "pong" }`
- Any other JSON payload is broadcast to the tenant+workflow group as `collab.message`.

Authority:
- `backend/projectmeats/asgi.py`
- `backend/tenant_apps/workflows/routing.py`
- `backend/tenant_apps/workflows/consumers.py`

---

## Component Structure

### UnifiedFlowEditor.tsx

**Purpose**: Main container for the visual workflow editor.

**Responsibilities**:
- Manages React Flow state (nodes, edges)
- Handles node selection and routing to config panels
- Provides drag-and-drop from palette
- Manages undo/redo history
- JSON import/export

**Key State Variables**:
```typescript
// React Flow state
const [nodes, setNodes, onNodesChange] = useNodesState([]);
const [edges, setEdges, onEdgesChange] = useEdgesState([]);

// Modal state
const [formStepModalOpen, setFormStepModalOpen] = useState(false);
const [formFieldModalOpen, setFormFieldModalOpen] = useState(false);
const [sectionModalOpen, setSectionModalOpen] = useState(false);
// ... etc for each modal type

// Selected nodes
const [selectedFormStep, setSelectedFormStep] = useState<Node | null>(null);
const [selectedFormField, setSelectedFormField] = useState<Node | null>(null);
// ... etc for each node type
```

**Node Selection Handler**:
```typescript
const handleSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
  if (nodes.length !== 1) return;

  const selected = nodes[0];

  switch (selected.type) {
    case 'formStep':
      setSelectedFormStep(selected);
      setFormStepModalOpen(true);
      break;

    case 'formField':
      setSelectedFormField(selected);
      setFormFieldModalOpen(true);
      break;

    // ... cases for each node type

    default:
      // Fallback to generic panel
      setSelectedNode(selected);
      setConfigPanelOpen(true);
  }
}, []);
```

### SidePanel.tsx

**Purpose**: Portal-based wrapper for config panels.

**Why Needed**: Config panels need fixed positioning relative to viewport, but were rendering inside `EditorContainer` which has limited height and relative positioning.

**Implementation**:
```typescript
export const SidePanel: React.FC<SidePanelProps> = ({ isOpen, onClose, children }) => {
  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Render to document.body using portal
  return ReactDOM.createPortal(
    <Backdrop onClick={(e) => e.target === e.currentTarget && onClose()}>
      <PanelContent onClick={(e) => e.stopPropagation()}>
        {children}
      </PanelContent>
    </Backdrop>,
    document.body
  );
};
```

**Usage Pattern**:
```typescript
<SidePanel
  isOpen={modalOpen && !!selectedNode}
  onClose={() => {
    setModalOpen(false);
    setSelectedNode(null);
  }}
>
  {selectedNode && (
    <ConfigPanel
      node={selectedNode}
      onChange={handleUpdate}
      onClose={() => {
        setModalOpen(false);
        setSelectedNode(null);
      }}
    />
  )}
</SidePanel>
```

### nodeTypes.ts

**Purpose**: Central registry for all node types.

**Structure**:
```typescript
export interface NodeTypeDef {
  id: string;
  label: string;
  category: NodeCategory;
  description: string;
  icon: string;
  defaultData: Record<string, any>;
  configPanel?: string; // Optional specialized panel
}

export const NODE_TYPE_REGISTRY: Record<string, NodeTypeDef> = {
  'triggerFormSubmission': {
    id: 'triggerFormSubmission',
    label: 'Form Submission',
    category: 'triggers',
    description: 'Triggered when a form is submitted',
    icon: '📝',
    defaultData: { triggerType: 'form_submission' },
  },
  // ... 30+ more node types
};
```

**Categories**:
- `triggers` - Workflow starting points
- `forms` - Form-related nodes
- `logic` - Conditional branching
- `actions` - Data operations
- `waits` - Delays and approvals
- `documents` - Document generation
- `utilities` - Data transformation
- `terminals` - Workflow endpoints

---

## Adding New Node Types

### Step 1: Create Node Component

Create `frontend/src/components/FlowEditor/nodes/YourNode.tsx`:

```typescript
import React from 'react';
import styled from 'styled-components';
import { Handle, Position } from '@xyflow/react';

export interface YourNodeData {
  label: string;
  // ... your custom data fields
}

export const YourNode: React.FC<{ data: YourNodeData }> = ({ data }) => {
  return (
    <Container>
      <Handle type="target" position={Position.Top} />

      <Header>
        <Icon>🎯</Icon>
        <Title>{data.label || 'Your Node'}</Title>
      </Header>

      <Content>
        {/* Your node content */}
      </Content>

      <Handle type="source" position={Position.Bottom} />
    </Container>
  );
};

const Container = styled.div`
  min-width: 200px;
  background: rgb(var(--color-surface));
  border: 2px solid rgb(var(--color-border));
  border-radius: 8px;
  padding: 12px;
`;

// ... more styled components
```

### Step 2: Register in nodeTypes.ts

```typescript
export const NODE_TYPE_REGISTRY: Record<string, NodeTypeDef> = {
  // ... existing types

  'yourNodeType': {
    id: 'yourNodeType',
    label: 'Your Node Type',
    category: 'actions', // or appropriate category
    description: 'What your node does',
    icon: '🎯',
    defaultData: {
      label: 'Your Node',
      // ... default values
    },
  },
};
```

### Step 3: Add to UnifiedFlowEditor

```typescript
// Import your node
import { YourNode } from './nodes/YourNode';

// Add to nodeTypes mapping
const nodeTypes: NodeTypes = useMemo(
  () => ({
    // ... existing types
    yourNode: YourNode,
  }),
  []
);
```

### Step 4: Create Config Panel (Optional)

If your node needs specialized configuration, create a config panel (see next section).

### Step 5: Update Node Selection Handler

```typescript
const handleSelectionChange = useCallback(({ nodes }: OnSelectionChangeParams) => {
  // ... existing cases

  case 'yourNodeType':
    setSelectedYourNode(selected);
    setYourNodeModalOpen(true);
    break;
}, []);
```

---

## Creating Config Panels

### Panel Structure

Config panels follow this standard structure:

```typescript
/**
 * Configuration Panel for YourNode
 *
 * Description of what this panel configures.
 */
import React, { useState } from 'react';
import styled from 'styled-components';

export interface YourNodeData {
  // ... data interface
}

export interface YourConfigPanelProps {
  node: { id: string; data: YourNodeData };
  onChange: (nodeId: string, data: YourNodeData) => void;
  onClose: () => void;
}

export const YourConfigPanel: React.FC<YourConfigPanelProps> = ({
  node,
  onChange,
  onClose,
}) => {
  const [formData, setFormData] = useState(node.data);

  const handleUpdate = (updates: Partial<YourNodeData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleSave = () => {
    onChange(node.id, formData);
    onClose();
  };

  return (
    <Container>
      <Header>
        <Title>Configure Your Node</Title>
        <CloseButton onClick={onClose}>×</CloseButton>
      </Header>

      <Content>
        {/* Configuration form fields */}
        <FormGroup>
          <Label>Label</Label>
          <Input
            value={formData.label}
            onChange={(e) => handleUpdate({ label: e.target.value })}
          />
        </FormGroup>

        {/* More form fields */}
      </Content>

      <Footer>
        <Button onClick={onClose}>Cancel</Button>
        <Button $variant="primary" onClick={handleSave}>
          Save
        </Button>
      </Footer>
    </Container>
  );
};

// Styled components
const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

// ... more styled components
```

### Using SidePanel Wrapper

In UnifiedFlowEditor, wrap your panel with SidePanel:

```typescript
<SidePanel
  isOpen={yourNodeModalOpen && !!selectedYourNode}
  onClose={() => {
    setYourNodeModalOpen(false);
    setSelectedYourNode(null);
  }}
>
  {selectedYourNode && (
    <YourConfigPanel
      node={selectedYourNode}
      onChange={(nodeId, data) => {
        handleNodeUpdate(nodeId, data);
        setYourNodeModalOpen(false);
        setSelectedYourNode(null);
      }}
      onClose={() => {
        setYourNodeModalOpen(false);
        setSelectedYourNode(null);
      }}
    />
  )}
</SidePanel>
```

### Common Panel Patterns

**Collapsible Sections**:
```typescript
const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

const toggleSection = (key: string) => {
  setCollapsed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    return next;
  });
};
```

**Conditional Fields**:
```typescript
{formData.mode === 'advanced' && (
  <FormGroup>
    <Label>Advanced Option</Label>
    {/* ... */}
  </FormGroup>
)}
```

**Field Validation**:
```typescript
const [errors, setErrors] = useState<Record<string, string>>({});

const validate = () => {
  const newErrors: Record<string, string> = {};

  if (!formData.label) {
    newErrors.label = 'Label is required';
  }

  setErrors(newErrors);
  return Object.keys(newErrors).length === 0;
};

const handleSave = () => {
  if (!validate()) return;
  onChange(node.id, formData);
  onClose();
};
```

---

## Data Flow

### Workflow Execution Flow

```
User Submits Form
    ↓
Trigger Node Captures Data
    ↓
Form Step Validates Input
    ↓
Action Nodes Process Data
    ↓
Condition Nodes Route Flow
    ↓
Terminal Node Completes
```

### Node Data Structure

Each node has this structure:

```typescript
interface Node {
  id: string;                    // Unique node ID
  type: string;                  // Node type from registry
  position: { x: number; y: number };
  data: Record<string, any>;     // Node-specific data
  measured?: { width: number; height: number };
}
```

### Edge Data Structure

```typescript
interface Edge {
  id: string;                    // Unique edge ID
  source: string;                // Source node ID
  target: string;                // Target node ID
  sourceHandle?: string;         // Optional source handle
  targetHandle?: string;         // Optional target handle
  type?: string;                 // Edge type (default, custom)
  data?: Record<string, any>;    // Edge-specific data
}
```

### Data Passing Between Nodes

Data flows through the workflow via the `workflow execution context`:

```typescript
// Previous nodes' outputs are available in later nodes
const previousData = getPreviousStepFields(currentNodeId);

// Example: Form field values
{
  'field_name': 'John Doe',
  'field_email': 'john@example.com',
  'field_amount': 1500
}

// Action nodes can reference these
createRecord({
  customer_name: previousData.field_name,
  email: previousData.field_email,
  order_total: previousData.field_amount,
});
```

---

## Testing

### Unit Tests

Test individual components in isolation:

```typescript
// SidePanel.test.tsx
describe('SidePanel', () => {
  it('renders content when open', () => {
    render(
      <SidePanel isOpen={true} onClose={jest.fn()}>
        <div>Content</div>
      </SidePanel>
    );
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('calls onClose on Escape', () => {
    const onClose = jest.fn();
    render(<SidePanel isOpen={true} onClose={onClose}><div>Content</div></SidePanel>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
```

### Integration Tests

Test node selection and configuration flow:

```typescript
describe('Node Configuration Flow', () => {
  it('opens config panel when node is clicked', async () => {
    const { getByText } = render(<UnifiedFlowEditor />);

    // Add node
    const trigger = getByText('Form Submission');
    fireEvent.drag(trigger, { clientX: 200, clientY: 200 });

    // Click node
    const node = getByText('Form Submission');
    fireEvent.click(node);

    // Config panel should open
    await waitFor(() => {
      expect(getByText('Configure Trigger')).toBeInTheDocument();
    });
  });
});
```

### Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

---

## Common Patterns

### Cascading Configuration

When one field's value determines available options for another:

```typescript
// Load forms when trigger type changes
useEffect(() => {
  if (formData.triggerType === 'form_submission') {
    fetchForms().then(setAvailableForms);
  }
}, [formData.triggerType]);

// Load fields when form changes
useEffect(() => {
  if (formData.selectedFormId) {
    const form = forms.find((f) => f.id === formData.selectedFormId);
    if (form) {
      const fields = extractFieldsFromWorkflow(form);
      setAvailableFields(fields);
    }
  }
}, [formData.selectedFormId, forms]);
```

### Field Mapping

Map form fields to entity fields:

```typescript
<FieldMappingPanel
  formFields={previousStepFields}
  targetFields={entityFields}
  mappings={formData.fieldMappings}
  onChange={(mappings) => handleUpdate({ fieldMappings: mappings })}
/>
```

### Conditional Visibility

Show/hide sections based on conditions:

```typescript
{formData.visibility?.mode === 'conditional' && (
  <ConditionBuilder
    conditions={formData.visibility.conditions || []}
    logic={formData.visibility.logic || 'and'}
    onChange={(conditions, logic) =>
      handleUpdate({
        visibility: { mode: 'conditional', conditions, logic }
      })
    }
    availableFields={availableFields}
  />
)}
```

---

## Troubleshooting

### Config Panels Not Rendering

**Symptom**: Click node, nothing happens

**Cause**: Panel rendering inside EditorContainer (fixed in PR #2586)

**Solution**: Ensure panels are wrapped in `<SidePanel>` component

### Node Type Not Appearing in Palette

**Symptom**: New node type doesn't show in palette

**Checklist**:
1. ✅ Added to `NODE_TYPE_REGISTRY` in nodeTypes.ts
2. ✅ Component exported from nodes/index.ts
3. ✅ Added to nodeTypes mapping in UnifiedFlowEditor

### Data Not Persisting

**Symptom**: Config changes don't save

**Cause**: Not calling `onChange` callback

**Solution**:
```typescript
const handleSave = () => {
  onChange(node.id, formData); // ← Make sure this is called
  onClose();
};
```

### TypeScript Errors

**Common Issues**:
```typescript
// ❌ Wrong - missing required fields
const node: Node = { id: '1' };

// ✅ Correct - all required fields
const node: Node = {
  id: '1',
  type: 'trigger',
  position: { x: 0, y: 0 },
  data: {},
};
```

---

## API Reference

### Key Functions

**handleNodeUpdate**:
```typescript
const handleNodeUpdate = (nodeId: string, updates: Record<string, any>) => {
  setNodes((nds) =>
    nds.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...updates } } : node
    )
  );
};
```

**getPreviousStepFields**:
```typescript
const getPreviousStepFields = (nodeId: string): Array<{ key: string; label: string; type: string }> => {
  // Traverse graph backwards from nodeId
  // Return all fields from previous form steps
};
```

**extractFieldsFromWorkflow**:
```typescript
const extractFieldsFromWorkflow = (workflow: any): Array<{ key: string; label: string; type: string }> => {
  // Parse workflow JSON
  // Extract all formField nodes
  // Return field metadata
};
```

---

## Performance Optimization

### Memoization

```typescript
// Memoize expensive nodeTypes object
const nodeTypes: NodeTypes = useMemo(
  () => ({
    trigger: TriggerNode,
    formStep: FormStepNode,
    // ... all node types
  }),
  []
);

// Memoize callbacks
const handleNodeClick = useCallback((node: Node) => {
  // ...
}, [dependencies]);
```

### Code Splitting

```typescript
// Lazy load heavy components
const FormBuilder = lazy(() => import('./FormBuilder/FormBuilder'));

<Suspense fallback={<Loading />}>
  <FormBuilder />
</Suspense>
```

---

## Contributing

### Adding Features

1. **Create Feature Branch**: `git checkout -b feat/your-feature`
2. **Implement Changes**: Follow patterns in this guide
3. **Add Tests**: Unit + integration tests
4. **Update Docs**: Add to user/developer guides
5. **Create PR**: Target `development` branch
6. **Code Review**: Address feedback
7. **Merge**: Squash and merge when approved

### Code Style

- Use TypeScript strict mode
- Follow existing patterns
- Add TSDoc comments
- Use styled-components for styling
- Prefer functional components
- Use hooks over class components

---

**Last Updated**: 2026-05-07
**Version**: 3.0
**Maintained By**: ProjectMeats Development Team

---

## Phase 18 — RT-09: Analytics Telemetry Event Standards

> **Full analytics event standards** are maintained in `docs/WORKFORMS_DEVELOPER_GUIDE.md` under the "Phase 18 — RT-09" section.
> Includes: event schema, event type enum, emission guidelines, aggregation queries, export formats, and dashboard metrics.
> **Canonical reference:** `MASTER_PLAN.md` → Phase 18 / Epic RT-09
