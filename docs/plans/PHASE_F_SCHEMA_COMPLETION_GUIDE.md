# Phase F Implementation Guide
## Universal Node Schema Coverage

**Goal:** Create configuration schemas for all 42 nodes requiring configuration.

**Current Progress:** 5/42 complete (12%)
**Target:** 42/42 complete (100%)

---

## 📋 Implementation Checklist

### Batch 1: Core Logic & Actions (Priority 1) - 10 nodes

#### Logic Nodes (2)
- [ ] **conditionIf** - If/Else branching
  - Renderer needed: `condition-builder`
  - Fields: label, condition (variable/operator/value)
  - Context: Needs upstream variables for condition building
  
- [ ] **conditionSwitch** - Switch/Case branching
  - Renderer needed: `case-builder`
  - Fields: label, cases[] (each with condition + label)
  - Context: Needs upstream variables

#### Communication Actions (3)
- [ ] **actionEmail** - Send Email (generic)
  - Fields: to, cc, bcc, subject, body, from
  - Template support with variable insertion
  - Similar to outlookEmail but provider-agnostic
  
- [ ] **actionNotification** - In-App Notification
  - Fields: recipients, title, message, priority, link
  - User/role selection renderer needed
  
- [ ] **actionSMS** - Send SMS
  - Fields: to (phone), message, from (optional)
  - Template support with variable insertion

#### Data Operations (2)
- [ ] **updateRecord** - Update existing record
  - Renderer needed: `entity-selector` (similar to createRecord)
  - Fields: entity_type, record_id (from context), field_mapping
  - Context: Needs upstream data for record_id and field values
  
- [ ] **deleteRecord** - Delete record
  - Fields: entity_type, record_id (from context), confirmation
  - Safety: Require confirmation checkbox

#### Integration Actions (3)
- [ ] **httpRequest** - Make HTTP API call
  - Fields: url, method, headers[], query_params[], body
  - Renderer needed: `key-value-list` for headers/params
  - Auth support: none, basic, bearer, api-key
  
- [ ] **transformData** - Transform/map data
  - Renderer needed: `json-mapper` or `code-editor`
  - Fields: input_data, transformation_script, output_format
  
- [ ] **approvalWait** - Wait for approval
  - Fields: approvers[] (user/role), message, timeout, escalation
  - Renderer needed: `user-selector`, `role-selector`

---

### Batch 2: Triggers & Loops (Priority 2) - 6 nodes

#### Triggers (3)
- [ ] **triggerSchedule** - Scheduled/cron trigger
  - Fields: schedule_type (cron/interval), cron_expression, timezone
  - Renderer needed: `cron-builder` or use text with validation
  
- [ ] **triggerWebhook** - Webhook endpoint
  - Fields: path, authentication, allowed_origins
  - Show generated webhook URL (read-only)
  
- [ ] **triggerEvent** - Database event trigger
  - Fields: entity_type, event_type (create/update/delete), conditions
  - Filter by field changes (e.g., status changed to 'approved')

#### Loops & Filters (3)
- [ ] **loopFor** - For-each iteration
  - Fields: source (array from context), item_name, max_iterations
  - Context: Needs upstream array variables
  
- [ ] **loopWhile** - While loop
  - Fields: condition, max_iterations (safety), item_name
  - Renderer: Reuse `condition-builder`
  
- [ ] **filterRecords** - Filter dataset
  - Fields: source (array), filter_conditions, output_name
  - Renderer: `filter-builder` (multiple conditions with AND/OR)

---

### Batch 3: Documents & Utility (Priority 3) - 10 nodes

#### Document Nodes (4)
- [ ] **documentGenerate** - Generate document from template
  - Fields: template_id, data_source, output_format (PDF/DOCX)
  - Template editor or selection from library
  
- [ ] **documentMerge** - Merge multiple documents
  - Fields: source_documents[], merge_strategy, output_name
  
- [ ] **documentSignature** - Request signature
  - Fields: document_id, signers[], signing_order, deadline
  - Integration with signature providers
  
- [ ] **documentStore** - Store/archive document
  - Fields: document_id, storage_location, metadata, retention_policy

#### Utility Nodes (6)
- [ ] **lookupRecord** - Query single record
  - Fields: entity_type, lookup_field, lookup_value, output_name
  - Context: lookup_value from upstream
  
- [ ] **mergeData** - Combine data sources
  - Fields: sources[] (from context), merge_strategy, output_name
  
- [ ] **utilityNote** - Add comment/note
  - Fields: note_text, color, icon
  - Visual only, no execution impact
  
- [ ] **wait** - Fixed delay
  - Fields: duration, unit (seconds/minutes/hours/days)
  
- [ ] **waitUntil** - Conditional wait
  - Fields: condition, max_wait_time, check_interval
  - Renderer: Reuse `condition-builder`
  
- [ ] **terminalSuccess** - Success end
  - Fields: message, return_data
  - Show workflow completion details

---

### Batch 4: Cleanup & Edge Cases (Priority 4) - 11 nodes

#### Form Nodes (2)
- [ ] **formReference** - Reference external form
  - Fields: form_id, data_binding
  - Form selection from library
  
- [ ] **formSignature** - Signature field
  - Fields: label, required, signer_name, date_format
  - Preview signature pad

#### Deprecated Nodes (3) - DECIDE: Migrate or Remove
- [ ] **formProcessSingle** → Migrate to `form` or deprecate
- [ ] **formProcessMulti** → Migrate to `formProcess` or deprecate
- [ ] **formSection** → Migrate to section within form or deprecate

#### Other (6)
- [ ] **externalResponse** - Return data to external caller
  - Fields: response_data, status_code, headers
  
- [ ] **paymentConfirmation** - Payment verification
  - Fields: payment_provider, amount, currency, order_id
  
- [ ] **runScript** - Execute custom code
  - Renderer: `code-editor` with syntax highlighting
  - Fields: language, script, timeout
  
- [ ] **terminalError** - Error end
  - Fields: error_message, error_code, rollback_actions
  
- [ ] **triggerForm** - Form submission trigger
  - Fields: form_id, submission_filters
  
- [ ] **documentUpload** - File upload
  - Fields: allowed_types[], max_size, required, multiple

---

## 🛠️ Implementation Pattern

### 1. Create Schema Definition

```typescript
// In frontend/src/components/FlowEditor/config/nodeConfigSchemas.ts

export const conditionIfSchema: NodeConfigSchema = {
  nodeType: 'conditionIf',
  displayName: 'If/Else Condition',
  description: 'Branch flow based on condition',
  icon: GitBranch, // Import from lucide-react
  version: '1.0.0',
  tags: ['logic', 'branching', 'control-flow'],
  contextAware: true, // Important if needs upstream data
  
  sections: [
    {
      id: 'basic',
      title: 'Condition Configuration',
      icon: GitBranch,
      defaultExpanded: true,
      description: 'Configure the branching logic',
      fields: [
        {
          id: 'label',
          type: 'text',
          label: 'Node Label',
          placeholder: 'e.g., Check if amount > 1000',
          helpText: 'Display name for this condition node',
          required: true,
          defaultValue: 'If/Else',
          validation: [
            { type: 'required', message: 'Label is required' },
            { type: 'minLength', value: 3, message: 'Min 3 characters' },
            { type: 'maxLength', value: 100, message: 'Max 100 characters' }
          ]
        },
        {
          id: 'condition',
          type: 'condition-builder', // Custom complex renderer
          label: 'If Condition',
          helpText: 'Flow takes TRUE path if condition matches, FALSE path otherwise',
          required: true,
          validation: [
            { type: 'required', message: 'Condition is required' }
          ]
        }
      ]
    },
    {
      id: 'advanced',
      title: 'Advanced Options',
      icon: Settings,
      defaultExpanded: false,
      fields: [
        {
          id: 'description',
          type: 'textarea',
          label: 'Description',
          placeholder: 'Document the business logic...',
          helpText: 'Internal notes (not shown to end users)',
          rows: 3
        }
      ]
    }
  ]
};
```

### 2. Add to Schema Registry

```typescript
// In same file, update allSchemas array
export const allSchemas: NodeConfigSchema[] = [
  formSchema,
  formProcessSchema,
  formProcessGroupSchema,
  createRecordSchema,
  outlookEmailSchema,
  conditionIfSchema, // NEW
  // ... rest
];
```

### 3. Create Complex Renderer (if needed)

```typescript
// In frontend/src/components/FlowEditor/config/fieldRenderers/complexRenderers.tsx

export const renderConditionBuilder: FieldRenderer = (
  field,
  value,
  onChange,
  error,
  context
) => {
  return (
    <ConditionBuilderWrapper>
      <Select
        value={value?.variable}
        onChange={(v) => onChange({ ...value, variable: v })}
        placeholder="Select variable"
      >
        {context?.upstreamVariables?.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </Select>
      
      <Select
        value={value?.operator}
        onChange={(op) => onChange({ ...value, operator: op })}
      >
        <option value="equals">Equals</option>
        <option value="notEquals">Not Equals</option>
        <option value="greaterThan">Greater Than</option>
        <option value="lessThan">Less Than</option>
        <option value="contains">Contains</option>
      </Select>
      
      <Input
        type="text"
        value={value?.compareValue || ''}
        onChange={(e) => onChange({ ...value, compareValue: e.target.value })}
        placeholder="Compare value"
      />
      
      {error && <ErrorText>{error}</ErrorText>}
    </ConditionBuilderWrapper>
  );
};
```

### 4. Register Renderer in DynamicConfigPanel

```typescript
// In frontend/src/components/FlowEditor/ConfigPanel/DynamicConfigPanel.tsx

// Import new renderer
import {
  renderConditionBuilder, // NEW
  renderEntitySelector,
  // ... rest
} from '../config/fieldRenderers/complexRenderers';

// In renderField function, add case:
switch (field.type) {
  case 'text': return renderTextField(...);
  case 'select': return renderSelectField(...);
  case 'condition-builder': return renderConditionBuilder(...); // NEW
  // ... rest
}
```

### 5. Test in Dev Environment

1. Build frontend: `npm run build`
2. Open Form Editor in dev
3. Add node type to canvas
4. Click to configure
5. Verify:
   - Schema loads correctly
   - All fields render properly
   - Validation works
   - Save/Apply updates node data
   - No console errors

### 6. Create PR

```bash
git checkout -b feat/phase-f-batch1-logic
git add -A
git commit -m "feat(flow): Phase F Batch 1 - Logic node schemas (conditionIf, conditionSwitch)

- Add conditionIf schema with condition-builder renderer
- Add conditionSwitch schema with case-builder renderer
- Implement condition-builder complex renderer
- Implement case-builder complex renderer
- Test both nodes in dev environment

This brings schema coverage to 7/42 nodes (17%).

Part of Phase F: Universal Node Schema Coverage

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"

git push -u origin feat/phase-f-batch1-logic
gh pr create --title "feat(flow): Phase F Batch 1 - Logic node schemas" --body "..." --base development
```

---

## 🧪 Testing Checklist (Per Schema)

For each new schema, verify:

- [ ] Schema registered in schemaRegistry
- [ ] Node type in NODE_TYPE_REGISTRY has matching ID
- [ ] DynamicConfigPanel renders all fields
- [ ] Required field validation works
- [ ] Optional fields can be empty
- [ ] Conditional fields show/hide correctly
- [ ] Help text displays properly
- [ ] Default values applied
- [ ] Save updates node.data
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] Bundle size impact acceptable (<1% increase per batch)

---

## 📊 Progress Tracking

**Batch 1 (Priority 1):** 0/10 complete
- Logic: 0/2
- Communication: 0/3
- Data Operations: 0/2
- Integration: 0/3

**Batch 2 (Priority 2):** 0/6 complete
- Triggers: 0/3
- Loops & Filters: 0/3

**Batch 3 (Priority 3):** 0/10 complete
- Documents: 0/4
- Utility: 0/6

**Batch 4 (Priority 4):** 0/11 complete
- Form Nodes: 0/2
- Deprecated: 0/3
- Other: 0/6

**Overall:** 5/42 complete (12%)

---

## 🎯 Success Criteria

Phase F is complete when:

1. All 42 configurable nodes have schemas
2. DynamicConfigPanel handles 100% of configuration UI
3. Zero hardcoded panels (except backward compat)
4. All schemas tested in dev environment
5. Documentation updated with schema patterns
6. Complex renderers documented for reuse
7. No regression in existing functionality
8. Bundle size increase <5%

---

## 📝 Notes

- **Small PRs:** 2-3 schemas per PR for faster review
- **Test Early:** Test each schema immediately after creation
- **Reuse Renderers:** Check if renderer already exists before creating new
- **Document Patterns:** Add common patterns to this guide as discovered
- **User Feedback:** Get user feedback on UX after each batch
- **Performance:** Monitor bundle size, optimize if needed

---

**Status:** Phase F Planning Complete
**Next Action:** Start Batch 1 - Logic Nodes (conditionIf, conditionSwitch)
**Owner:** Development Team
**Timeline:** Complete Batch 1 within next 2-3 development cycles
