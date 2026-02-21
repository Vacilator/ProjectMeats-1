# Form Builder Component Suite

Reusable FormBuilder modal for creating and editing multi-step forms with intelligent features.

## Overview

The FormBuilder suite provides a complete solution for designing forms within the Workform Editor. It supports:

- **Multi-Step Forms**: Unlimited steps with drag-drop reordering
- **Field Configuration**: 15 field types with validation rules
- **Conditional Logic**: When/then rules with multiple conditions/actions
- **Data Inheritance**: Field mappings from upstream nodes
- **Live Preview**: See forms as end users will experience them
- **Auto-Populate**: Smart suggestions for field population (Phase 5)
- **Auto-Map**: Intelligent field mapping algorithm (Phase 5)

## Components

### FormBuilder.tsx
Main modal component with tabs for Steps, Settings, and Preview. Uses Zustand for state management.

**Props:**
- `isOpen`: boolean - Controls modal visibility
- `onClose`: () => void - Close handler
- `onSave`: (formData: any) => void - Save handler
- `initialData?`: any - Pre-populate form data
- `nodeId?`: string - Associated node ID

**Usage:**
```tsx
import { FormBuilder } from '@/components/form-builder';

<FormBuilder
  isOpen={isFormBuilderOpen}
  onClose={() => setIsFormBuilderOpen(false)}
  onSave={(data) => {
    updateNode(nodeId, { formData: data });
  }}
  initialData={nodeData.formData}
  nodeId={nodeId}
/>
```

### StepCard.tsx
Collapsible card for each form step with expand/collapse, field list, rules, and mappings.

**Features:**
- Drag handle for reordering
- Field count, rule count, mapping count
- Quick actions: Add Field, Delete Step
- Expandable sections for Fields, Rules, Mappings

### FieldConfigModal.tsx
Modal for configuring individual form fields.

**Field Types Supported:**
- Text, TextArea, Number
- Email, Phone
- Date, DateTime
- Select, MultiSelect
- Radio, Checkbox
- File, Signature
- Rating, Slider

**Configuration Options:**
- Label, Placeholder, Help Text
- Required/Optional
- Validation rules
- Field width (Full/Half/Third)
- Auto-populate settings (Phase 5)
- Conditional visibility (Phase 5)

### RuleBuilderModal.tsx
Visual rule builder for conditional form logic.

**Supports:**
- Multiple conditions (AND/OR)
- Operators: equals, notEquals, greaterThan, lessThan, contains, isEmpty
- Actions: show, hide, enable, disable, require, setValue
- Real-time rule evaluation (Phase 7)

**Example Rule:**
```
When:
  - Field "Order Type" equals "Bulk"
  - AND Field "Quantity" greaterThan 100
Then:
  - Show Field "Bulk Discount"
  - Require Field "Delivery Date"
```

### MappingSection.tsx
Manages field mappings for data inheritance from previous steps.

**Features:**
- Source-target field pairing
- Auto-Map algorithm (Phase 5)
- Transformation expressions
- Manual override

### PreviewModal.tsx
Live preview of the form with progress bar and navigation.

**Features:**
- Step-by-step navigation
- Progress bar
- Field mocks with test data
- Exact end-user experience

## State Management

Uses Zustand store (`store.ts`) for:
- Form metadata (name, description)
- Steps array
- Active step tracking
- Modal states
- Editing contexts
- Persistence helpers

**Key Actions:**
```ts
const {
  addStep,
  removeStep,
  updateStep,
  reorderSteps,
  openFieldModal,
  saveField,
  removeField,
  openRuleModal,
  saveRule,
  openMappingModal,
  autoMapFields,
  loadForm,
  getFormData
} = useFormBuilderStore();
```

## Type System

See `types.ts` for complete type definitions:

- `FormStep` - Step with fields, rules, mappings
- `FormField` - Field configuration
- `FormRule` - Conditional logic rule
- `FieldMapping` - Data inheritance mapping
- `RuleCondition` - When clause
- `RuleAction` - Then clause
- `AutoPopulateSuggestion` - Smart suggestion (Phase 5)

## Integration with Flow Editor

### Opening FormBuilder from Node

```tsx
// In node config panel or context menu
import { useFormBuilderStore } from '@/components/form-builder';

const { loadForm } = useFormBuilderStore();

const handleEditInBuilder = () => {
  // Load existing form data
  loadForm(node.data.formData);
  
  // Open FormBuilder
  setIsFormBuilderOpen(true);
};
```

### Saving FormBuilder to Node

```tsx
const handleSave = (formData: any) => {
  // Update node data
  updateNode(nodeId, {
    formData,
    // Optionally update node label
    label: formData.name
  });
  
  // Close modal
  setIsFormBuilderOpen(false);
};
```

## Phase 4 Status

✅ **Complete (2026-02-21):**
- FormBuilder modal with tabs
- StepCard with expand/collapse
- FieldConfigModal with 15 field types
- RuleBuilderModal with conditions/actions
- MappingSection placeholder
- PreviewModal with navigation
- Zustand store
- Type system

⏸️ **Pending (Phase 5):**
- Auto-populate suggestions with scoring
- Auto-Map algorithm
- Transformation expressions
- Conditional field visibility

⏸️ **Pending (Phase 6):**
- Integration with Form and FormProcessGroup nodes
- Backend form submission
- Data validation

⏸️ **Pending (Phase 7):**
- Real-time rule evaluation
- Live context from test runs
- Validation engine integration

## File Structure

```
form-builder/
├── index.ts                 # Main exports
├── types.ts                 # Type definitions
├── store.ts                 # Zustand store
├── FormBuilder.tsx          # Main modal
├── StepCard.tsx             # Step card component
├── FieldConfigModal.tsx     # Field configuration
├── RuleBuilderModal.tsx     # Rule builder
├── MappingSection.tsx       # Field mappings
├── PreviewModal.tsx         # Live preview
└── README.md               # This file
```

## Best Practices

1. **Always load initial data** when opening FormBuilder for editing
2. **Use getFormData()** before saving to get complete form state
3. **Check isDirty** before closing to warn about unsaved changes
4. **Validate field labels** before saving (required)
5. **Use generateId()** utility for new items to ensure uniqueness

## Testing

```bash
# Run type check
cd frontend && npm run type-check

# Build
npm run build

# Test in browser
npm run dev
```

## Future Enhancements

- Drag-drop field reordering within steps
- Field templates/presets
- Form versioning and history
- Import/export form definitions
- Form analytics and completion rates
- Multi-language support for field labels

---

**Phase:** 4 - FormBuilder Suite  
**Created:** 2026-02-21  
**Status:** Complete  
**Next:** Phase 5 - Smart Features (Auto-populate, Auto-Map, Visual Chips)
