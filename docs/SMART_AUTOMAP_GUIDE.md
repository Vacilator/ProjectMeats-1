# Smart Auto-Map Implementation Guide

**Feature**: Automatic field inheritance between workflow nodes
**Status**: Architecture designed, partial implementation
**Created**: 2026-03-04 - Delegation II: Editor Revolution

---

## Overview

Smart Auto-Map automatically inherits and pre-fills fields from previous nodes in a workflow. When a "Product" node follows a "Sales Order" node, fields like `unit_price`, `sku`, or `quantity` are automatically mapped.

This document outlines the implementation approach for future development.

---

## Architecture

### 1. Node Output Schema

Each node must declare its output schema:

```typescript
interface NodeOutputSchema {
  nodeId: string;
  nodeType: string;
  entityType?: string; // e.g., "customer", "product"
  outputFields: {
    [fieldName: string]: {
      type: string; // "text", "number", "select", etc.
      label: string;
      value: any; // Runtime value or placeholder
    };
  };
}
```

### 2. Field Matching Engine

The engine analyzes field compatibility across nodes:

```typescript
interface FieldMatch {
  sourceNodeId: string;
  sourceField: string;
  targetField: string;
  matchScore: number; // 0-1 confidence
  matchReason: 'exact_name' | 'type_compatible' | 'semantic_similar';
}

class FieldMatchingEngine {
  /**
   * Find compatible fields between two nodes.
   *
   * Matching strategies:
   * 1. Exact name match (score: 1.0)
   * 2. Type-compatible with similar name (score: 0.8)
   * 3. Semantic similarity via embeddings (score: 0.6)
   */
  findMatches(
    sourceSchema: NodeOutputSchema,
    targetFields: FormField[]
  ): FieldMatch[];
}
```

### 3. Auto-Mapping Service

```typescript
class AutoMappingService {
  /**
   * Auto-map fields when a node is added to the workflow.
   *
   * @param workflowNodes - All nodes in the workflow
   * @param targetNodeId - The node being configured
   * @returns Suggested field mappings
   */
  suggestMappings(
    workflowNodes: Node[],
    targetNodeId: string
  ): FieldMapping[] {
    // 1. Get all upstream nodes (connected via edges)
    const upstreamNodes = this.getUpstreamNodes(workflowNodes, targetNodeId);

    // 2. Extract output schemas from upstream nodes
    const schemas = upstreamNodes.map(n => this.extractOutputSchema(n));

    // 3. Match fields with target node
    const matches = this.findBestMatches(schemas, targetNode.data.fields);

    // 4. Return as field mappings
    return matches.map(m => ({
      id: uuid(),
      formFieldId: m.targetField,
      entityField: m.sourceField,
      transformation: {
        type: 'direct',
      },
      autoPopulate: {
        sourceStep: m.sourceNodeId,
        sourceField: m.sourceField,
        mode: 'copy',
      }
    }));
  }
}
```

---

## Implementation Phases

### Phase 1: Manual Field Mapping (CURRENT STATE)

Users manually configure field mappings in the node config panel.

**Status**: ✅ Complete

---

### Phase 2: Entity Selector + Field Cascade (IMPLEMENTED)

**Status**: ✅ Complete (Delegation II)

Users select an entity type, and fields are automatically fetched:

```typescript
// Component: EntityFieldSelector.tsx
<EntityFieldSelector
  selectedEntity="customers.customer"
  selectedFields={["name", "email", "tax_id"]}
  onEntityChange={(entity) => {
    // Fetch fields from /api/v1/system/entities-introspect/${entity}/fields/
  }}
  onFieldsChange={(fields) => {
    // Update node config with selected fields
  }}
/>
```

**Benefits**:
- No manual field creation
- Always in sync with Django models
- Type-safe (field types from introspection)

---

### Phase 3: Output Schema Inference (TODO)

**Estimate**: 8-12 hours

Automatically infer what data a node outputs:

```typescript
// Example: Sales Order node outputs
{
  nodeId: "order-123",
  nodeType: "form",
  entityType: "sales_orders.salesorder",
  outputFields: {
    "order_number": { type: "text", label: "Order #", value: "SO-001" },
    "customer_name": { type: "text", label: "Customer", value: "Acme Corp" },
    "total_amount": { type: "number", label: "Total", value: 1500.00 },
    "order_date": { type: "date", label: "Date", value: "2026-03-04" }
  }
}
```

**Implementation**:
1. When node is saved, extract field list from node.data.fields
2. Store in node.data.outputSchema
3. Use for downstream matching

---

### Phase 4: Name-Based Matching (TODO)

**Estimate**: 12-16 hours

Match fields by exact or fuzzy name:

```typescript
// Exact match: "sku" → "sku" (score: 1.0)
// Fuzzy match: "product_sku" → "sku" (score: 0.8)
// Semantic match: "item_code" → "sku" (score: 0.6 via embeddings)

class NameMatcher {
  match(sourceName: string, targetName: string): number {
    // Exact
    if (sourceName === targetName) return 1.0;

    // Normalized (remove prefixes/suffixes)
    const normalized = this.normalize([sourceName, targetName]);
    if (normalized[0] === normalized[1]) return 0.9;

    // Levenshtein distance
    const distance = this.levenshtein(sourceName, targetName);
    if (distance < 3) return 0.8;

    // Semantic (future: use embeddings)
    return 0.0;
  }
}
```

---

### Phase 5: Type-Safe Mapping (TODO)

**Estimate**: 16-20 hours

Ensure type compatibility:

```typescript
const typeCompatibility = {
  'text': ['textarea', 'email', 'url', 'phone'],
  'number': ['text'], // Can convert number to text
  'date': ['datetime', 'text'],
  'select': ['multi-select', 'text'],
};

function isCompatible(sourceType: string, targetType: string): boolean {
  if (sourceType === targetType) return true;
  return typeCompatibility[sourceType]?.includes(targetType) || false;
}
```

---

### Phase 6: UI Integration (TODO)

**Estimate**: 20-24 hours

Display auto-mapping suggestions in node config panel:

```typescript
<AutoMappingSuggestions
  suggestions={autoMappedFields}
  onAccept={(mapping) => {
    // Apply mapping to node config
    updateNodeData(nodeId, {
      fieldMappings: [...existingMappings, mapping]
    });
  }}
  onReject={(mappingId) => {
    // Remove suggestion
  }}
/>
```

**UI Flow**:
1. User adds a new Form node
2. System detects upstream nodes with output schemas
3. Shows "Auto-Map Fields" button with badge (e.g., "5 suggestions")
4. User clicks, sees list of suggested mappings with confidence scores
5. User accepts/rejects individual mappings
6. Accepted mappings become active field pre-population

---

### Phase 7: Runtime Field Inheritance (TODO)

**Estimate**: 24-32 hours

At workflow execution time, copy values from source node to target node:

```typescript
class WorkflowExecutor {
  async executeNode(node: Node, context: ExecutionContext) {
    // 1. Check if node has auto-populated fields
    const autoFields = node.data.fieldMappings?.filter(
      m => m.autoPopulate !== undefined
    );

    // 2. For each auto-populated field, fetch value from source node
    for (const mapping of autoFields) {
      const sourceValue = context.getNodeOutput(
        mapping.autoPopulate.sourceStep,
        mapping.autoPopulate.sourceField
      );

      // 3. Apply transformation if needed
      const transformedValue = this.applyTransformation(
        sourceValue,
        mapping.transformation
      );

      // 4. Pre-fill target field
      context.setFieldValue(node.id, mapping.formFieldId, transformedValue);
    }

    // 5. Continue with node execution
    await this.runNodeLogic(node, context);
  }
}
```

---

## Example Workflow

### Scenario: Sales Order → Product Selection

**Node 1: Sales Order Form**
- Fields: `customer_name`, `order_date`, `order_total`
- Output Schema: `{ customer_name: "Acme Corp", order_total: 1500 }`

**Node 2: Product Selection Form** (Smart Auto-Map)
- Fields: `product_name`, `quantity`, `unit_price`, `customer_reference`
- Auto-Mapping:
  - ✅ `customer_name` → `customer_reference` (exact match, score: 1.0)
  - ✅ `order_total` → (no match - different purpose)
  - ⏭️ `quantity`, `unit_price` - no upstream source (user input required)

**Result**: When user reaches Node 2, the `customer_reference` field is pre-filled with "Acme Corp" from Node 1.

---

## Database Schema

### Field Mappings Table

```sql
CREATE TABLE workflow_field_mappings (
  id UUID PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id),
  source_node_id UUID NOT NULL,
  source_field VARCHAR(255) NOT NULL,
  target_node_id UUID NOT NULL,
  target_field VARCHAR(255) NOT NULL,
  mapping_type VARCHAR(50) DEFAULT 'direct', -- direct, lookup, format, calculated
  transformation_config JSONB DEFAULT '{}',
  auto_populated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workflow_id, target_node_id, target_field)
);
```

---

## Testing Strategy

### Unit Tests

```typescript
describe('FieldMatchingEngine', () => {
  it('should match exact field names with score 1.0', () => {
    const sourceSchema = {
      outputFields: { sku: { type: 'text', label: 'SKU' } }
    };
    const targetFields = [{ id: 'sku', type: 'text', label: 'Product SKU' }];

    const matches = engine.findMatches(sourceSchema, targetFields);

    expect(matches[0].matchScore).toBe(1.0);
    expect(matches[0].sourceField).toBe('sku');
    expect(matches[0].targetField).toBe('sku');
  });

  it('should match type-compatible fields with lower score', () => {
    const sourceSchema = {
      outputFields: { price: { type: 'number', label: 'Price' } }
    };
    const targetFields = [{ id: 'unit_cost', type: 'text', label: 'Unit Cost' }];

    const matches = engine.findMatches(sourceSchema, targetFields);

    expect(matches[0].matchScore).toBeLessThan(1.0);
    expect(matches[0].matchReason).toBe('type_compatible');
  });
});
```

### Integration Tests

```typescript
describe('Auto-Mapping E2E', () => {
  it('should suggest mappings when adding node after upstream nodes', async () => {
    // 1. Create workflow with Order node
    const orderNode = createNode({ type: 'form', fields: [
      { id: 'customer', type: 'text' },
      { id: 'total', type: 'number' }
    ]});

    // 2. Add Product node after Order
    const productNode = createNode({ type: 'form', fields: [
      { id: 'customer_name', type: 'text' },
      { id: 'quantity', type: 'number' }
    ]});

    // 3. Connect Order → Product
    const edge = createEdge(orderNode.id, productNode.id);

    // 4. Trigger auto-mapping
    const suggestions = await autoMappingService.suggestMappings(
      [orderNode, productNode],
      productNode.id
    );

    // 5. Verify suggestion
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].sourceField).toBe('customer');
    expect(suggestions[0].targetField).toBe('customer_name');
  });
});
```

---

## Performance Considerations

1. **Lazy Matching**: Only suggest mappings when user opens node config (not on every render)
2. **Caching**: Cache field schemas to avoid repeated API calls
3. **Batching**: Batch field introspection for multiple entities
4. **Background Processing**: Run matching in Web Worker for large workflows

---

## Future Enhancements

1. **AI-Powered Semantic Matching**: Use OpenAI embeddings to match fields by meaning
   - Example: "client_name" matches "customer" with 0.85 confidence

2. **Learning from User Corrections**: Track when users modify auto-mappings and improve algorithm

3. **Multi-Source Mapping**: Allow target field to inherit from multiple source fields
   - Example: `full_address = ${street} ${city} ${zip}`

4. **Conditional Mapping**: Map fields based on runtime conditions
   - Example: If `order_type == "wholesale"`, use `wholesale_price` else `retail_price`

---

## Status Summary

| Phase | Status | Estimate | Priority |
|-------|--------|----------|----------|
| 1. Manual Mapping | ✅ Complete | - | - |
| 2. Entity Selector | ✅ Complete | - | - |
| 3. Output Schema Inference | ⏳ TODO | 8-12h | High |
| 4. Name Matching | ⏳ TODO | 12-16h | High |
| 5. Type Safety | ⏳ TODO | 16-20h | Medium |
| 6. UI Integration | ⏳ TODO | 20-24h | High |
| 7. Runtime Inheritance | ⏳ TODO | 24-32h | Critical |

**Total Remaining Effort**: 80-104 hours (~2-3 weeks of dedicated development)

---

**Document Version**: 1.0
**Last Updated**: 2026-03-04
**Author**: Delegation II Implementation
