# Global Configuration Architecture

**System Blueprint Engine - Architecture Documentation**

Version: 2.0  
Last Updated: January 23, 2026  
Status: Phase 3 Complete (Runtime Engine + Integration)

---

## 1. Overview: The Meta-Model Concept

The System Blueprint Engine implements a **"Meta-Model"** architecture where:

- **Blueprints DEFINE data structures** (what fields exist, what types, what validations)
- **Tenant data CONFORMS to Blueprints** (stored in `custom_data` JSONField on business models)
- **Workflows ORCHESTRATE processes** (multi-step business logic execution)

### Key Principle: "Configuration as Data"

Instead of creating new database migrations for every tenant's custom field request, we:
1. Store the **schema definition** in `BlueprintVersion.schema_config` (JSON)
2. Store the **actual data** in `Model.custom_data` (JSON) on tenant models
3. **React** components dynamically render forms based on the schema

This enables:
- ✅ Zero-downtime tenant customization
- ✅ No database migrations for custom fields
- ✅ Multi-version schema evolution (v1, v2, v3...)
- ✅ Tenant-specific overrides without affecting others

---

## 2. The Security Model

### 2.1 Blueprint Lifecycle States

```
DRAFT → PUBLISHED → ARCHIVED
```

| State | Who Can Modify? | Who Can Read? | Purpose |
|-------|----------------|---------------|---------|
| **DRAFT** | Global System Admins | Global System Admins only | Development, testing, iteration |
| **PUBLISHED** | **IMMUTABLE** (Superusers only for atomic publish) | **ALL TENANTS** (read-only) | Production use, stable |
| **ARCHIVED** | No one (historical record) | Global System Admins (audit) | Deprecated versions |

### 2.2 Publishing: The Atomic Operation

**Publishing** is the most critical security boundary:

```python
# ONLY Superusers can execute this atomic operation
def publish_blueprint(blueprint_version):
    with transaction.atomic():
        # 1. Verify version is in DRAFT
        if blueprint_version.status != 'DRAFT':
            raise PermissionDenied("Cannot publish non-draft version")
        
        # 2. Mark as PUBLISHED (immutable)
        blueprint_version.status = 'PUBLISHED'
        blueprint_version.save()
        
        # 3. Set as active version on blueprint
        blueprint = blueprint_version.blueprint
        blueprint.published_version = blueprint_version
        blueprint.save()
        
        # 4. Invalidate cache, notify tenants
        cache.delete(f'blueprint:{blueprint.slug}')
```

**Why Superuser-Only?**
- Affects ALL tenants simultaneously
- Cannot be undone (immutable once published)
- Must be tested in staging first
- Potential for system-wide impact

### 2.3 Row-Level Security (RLS) Strategy

```sql
-- System Configuration Tables (Global - Public Read)
CREATE POLICY "public_read_blueprints" ON system_config_entityblueprint
    FOR SELECT USING (true);  -- All users can read

CREATE POLICY "admin_modify_blueprints" ON system_config_entityblueprint
    FOR ALL USING (
        current_setting('app.current_tenant_id')::uuid = '00000000-0000-0000-0000-000000000000'::uuid
    );  -- Only System Root tenant (Global Admins) can modify

-- Workflow Runs (Tenant-Isolated)
CREATE POLICY "tenant_isolation_workflow_runs" ON system_config_workflowrun
    FOR ALL USING (
        tenant_id = current_setting('app.current_tenant_id')::uuid
    );  -- Users only see their tenant's runs
```

### 2.4 Tenant Isolation Guarantees

**Global System Admins**:
- ✅ CAN access `EntityBlueprint` and `BlueprintVersion` (configuration)
- ✅ CAN create/edit DRAFT versions
- ❌ **CANNOT** access tenant business data (SalesOrder, Customer, etc.)
- ❌ **CANNOT** publish (Superuser-only)

**Regular Tenant Users**:
- ✅ CAN read PUBLISHED blueprints (to know what fields are available)
- ✅ CAN use blueprints via `custom_data` on their tenant's models
- ❌ **CANNOT** modify blueprints (read-only)
- ❌ **CANNOT** see other tenants' data (strict isolation)

**Superusers**:
- ✅ CAN do everything (including publish)
- ⚠️ **Must use carefully** - system-wide impact

---

## 3. The System Tenant: Root Context

### 3.1 System Root Tenant

**UUID**: `00000000-0000-0000-0000-000000000000` (zero-UUID)  
**Name**: "System Root"  
**Slug**: `system`  
**Purpose**: Operational context for Global System Admins

### 3.2 How It Works

```python
# Middleware Logic (apps/tenants/middleware.py)
if request.user.groups.filter(name='Global System Admins').exists():
    # Assign System Root tenant (bypasses standard resolution)
    request.tenant = Tenant.objects.get(id='00000000-0000-0000-0000-000000000000')
    
    # Set PostgreSQL RLS session variable
    cursor.execute("SET LOCAL app.current_tenant_id = %s", [str(request.tenant.id)])
    
    # Return early - skip domain/subdomain resolution
    return self.get_response(request)
```

### 3.3 Why the Zero-UUID?

1. **Globally Recognizable**: `0000...` is instantly identifiable in logs/queries
2. **Never Conflicts**: Business tenants use random UUIDs
3. **Semantic Meaning**: "Root" implies system-level access
4. **Database Integrity**: Standard UUID format, no special handling needed

### 3.4 System Root is NOT a Business Tenant

**System Root tenant**:
- ❌ Has NO business data (no customers, no sales orders)
- ❌ Has NO TenantUsers (users are in the group, not tenant members)
- ✅ Used ONLY for Blueprint management context
- ✅ Isolated from all business operations

**Business tenants**:
- ✅ Have customers, orders, suppliers, etc.
- ✅ Have TenantUser associations
- ✅ Isolated from each other
- ❌ Cannot access System Root data (if any existed)

---

## 4. JSON Schemas (Critical for Frontend)

### 4.1 `schema_config`: Field Definitions

**Type**: `JSONField` (array of field definition objects)  
**Location**: `BlueprintVersion.schema_config`  
**Purpose**: Define dynamic fields that tenants can store in `custom_data`

**Schema**:
```typescript
interface FieldDefinition {
  key: string;           // Field identifier (e.g., "custom_priority")
  label: string;         // Display name (e.g., "Priority Level")
  type: FieldType;       // Input type (see below)
  required: boolean;     // Validation rule
  default?: any;         // Default value
  options?: string[];    // For select/radio types
  validation?: {         // Additional validation rules
    min?: number;
    max?: number;
    pattern?: string;
    message?: string;
  };
}

type FieldType = 
  | 'text'               // Single-line text input
  | 'textarea'           // Multi-line text
  | 'number'             // Numeric input
  | 'date'               // Date picker
  | 'datetime'           // Date + time picker
  | 'select'             // Dropdown (requires options)
  | 'multiselect'        // Multi-choice dropdown
  | 'checkbox'           // Boolean toggle
  | 'radio'              // Radio buttons (requires options)
  | 'email'              // Email input with validation
  | 'url'                // URL input with validation
  | 'file'               // File upload
  | 'json';              // Raw JSON editor
```

**Example**:
```json
[
  {
    "key": "custom_priority",
    "label": "Priority Level",
    "type": "select",
    "required": true,
    "options": ["Low", "Medium", "High", "Urgent"],
    "default": "Medium"
  },
  {
    "key": "special_instructions",
    "label": "Special Instructions",
    "type": "textarea",
    "required": false,
    "validation": {
      "max": 500,
      "message": "Instructions must be under 500 characters"
    }
  },
  {
    "key": "delivery_date",
    "label": "Requested Delivery Date",
    "type": "date",
    "required": true
  }
]
```

### 4.2 `workflow_config`: React Flow UI State

**Type**: `JSONField` (React Flow node/edge format)  
**Location**: `BlueprintVersion.workflow_config`  
**Purpose**: Visual workflow designer state (nodes, edges, positions)

**Schema** (React Flow Standard):
```typescript
interface WorkflowConfig {
  nodes: Node[];
  edges: Edge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

interface Node {
  id: string;                    // Unique node ID (UUID)
  type: 'entityNode' | 'actionNode' | 'decisionNode' | 'startNode' | 'endNode';
  position: { x: number; y: number; };  // Canvas position
  data: {
    label: string;               // Display name
    config?: any;                // Node-specific config
    entity_type?: string;        // For entityNode: 'customer', 'sales_order', etc.
    action_type?: string;        // For actionNode: 'create', 'update', 'notify', etc.
  };
}

interface Edge {
  id: string;                    // Unique edge ID
  source: string;                // Source node ID
  target: string;                // Target node ID
  label?: string;                // Edge label (for conditions)
  animated?: boolean;            // Visual animation
}
```

**Example**:
```json
{
  "nodes": [
    {
      "id": "start-1",
      "type": "startNode",
      "position": { "x": 100, "y": 100 },
      "data": { "label": "Start: Sales Order Created" }
    },
    {
      "id": "entity-1",
      "type": "entityNode",
      "position": { "x": 100, "y": 200 },
      "data": {
        "label": "Create Customer Record",
        "entity_type": "customer"
      }
    },
    {
      "id": "action-1",
      "type": "actionNode",
      "position": { "x": 100, "y": 300 },
      "data": {
        "label": "Send Confirmation Email",
        "action_type": "notify"
      }
    }
  ],
  "edges": [
    {
      "id": "e1-2",
      "source": "start-1",
      "target": "entity-1",
      "animated": true
    },
    {
      "id": "e2-3",
      "source": "entity-1",
      "target": "action-1"
    }
  ],
  "viewport": {
    "x": 0,
    "y": 0,
    "zoom": 1
  }
}
```

### 4.3 `logic_config`: Execution Logic & Mappings

**Type**: `JSONField` (execution step definitions)  
**Location**: `BlueprintVersion.logic_config`  
**Purpose**: Define how workflow steps execute and map data between steps

**Schema**:
```typescript
interface LogicConfig {
  steps: ExecutionStep[];
  global_context?: Record<string, any>;  // Shared variables
}

interface ExecutionStep {
  step_id: string;           // Matches node ID from workflow_config
  step_type: 'entity_create' | 'entity_update' | 'action' | 'condition' | 'api_call';
  
  // Data mappings: How to populate fields
  mappings: DataMapping[];
  
  // Conditional execution
  condition?: {
    field: string;           // Field to check
    operator: '==' | '!=' | '>' | '<' | 'contains' | 'exists';
    value: any;              // Comparison value
  };
  
  // Error handling
  on_error?: 'fail' | 'continue' | 'retry';
  retry_count?: number;
}

interface DataMapping {
  target: string;            // Target field (e.g., "customer.name")
  source: string;            // Source (e.g., "$context.sales_order.customer_name")
  transform?: string;        // Optional transformation (e.g., "uppercase", "trim")
  default?: any;             // Default if source is null
}
```

**Example**:
```json
{
  "steps": [
    {
      "step_id": "entity-1",
      "step_type": "entity_create",
      "mappings": [
        {
          "target": "customer.name",
          "source": "$context.sales_order.customer_name",
          "transform": "trim"
        },
        {
          "target": "customer.email",
          "source": "$context.sales_order.customer_email",
          "default": "noreply@example.com"
        },
        {
          "target": "customer.tenant",
          "source": "$context.tenant_id"
        }
      ],
      "on_error": "fail"
    },
    {
      "step_id": "action-1",
      "step_type": "action",
      "condition": {
        "field": "$context.customer.email_verified",
        "operator": "==",
        "value": true
      },
      "mappings": [
        {
          "target": "email.to",
          "source": "$context.customer.email"
        },
        {
          "target": "email.subject",
          "source": "Order Confirmation"
        },
        {
          "target": "email.body",
          "source": "$template.order_confirmation"
        }
      ],
      "on_error": "continue"
    }
  ],
  "global_context": {
    "notification_enabled": true,
    "retry_attempts": 3
  }
}
```

### 4.4 Runtime Data: `data_context` (WorkflowRun)

**Type**: `JSONField` (runtime execution state)  
**Location**: `WorkflowRun.data_context`  
**Purpose**: Secure clipboard for workflow execution (stores intermediate results)

**Schema**:
```typescript
interface DataContext {
  // Step outputs (populated as workflow executes)
  [step_id: string]: {
    status: 'pending' | 'success' | 'error';
    output?: any;
    error?: string;
    timestamp: string;
  };
  
  // Global variables available to all steps
  tenant_id: string;
  user_id: string;
  initiated_at: string;
  
  // Step-specific data
  entities_created: Record<string, string>;  // Maps step_id -> created entity ID
  api_responses: Record<string, any>;        // Maps step_id -> API response
}
```

**Example** (during execution):
```json
{
  "tenant_id": "uuid-tenant-1",
  "user_id": "uuid-user-1",
  "initiated_at": "2026-01-23T10:00:00Z",
  "entity-1": {
    "status": "success",
    "output": {
      "id": "uuid-customer-1",
      "name": "Acme Corp",
      "email": "contact@acme.com"
    },
    "timestamp": "2026-01-23T10:00:05Z"
  },
  "action-1": {
    "status": "success",
    "output": {
      "email_sent": true,
      "message_id": "msg-12345"
    },
    "timestamp": "2026-01-23T10:00:10Z"
  },
  "entities_created": {
    "entity-1": "uuid-customer-1"
  }
}
```

---

## 5. The Runtime Engine (Phase 3 Complete)

### 5.1 Architecture Overview

The Runtime Engine transforms static blueprints into executable workflows through a multi-step form interface. It consists of three components:

1. **Backend Execution Engine** (`backend/shared_apps/system_config/engine.py`)
2. **Dynamic Form Renderer** (`frontend/src/features/system/DynamicFormEngine.tsx`)
3. **Workflow Center UI** (`frontend/src/pages/Workflows/`)

### 5.2 API Endpoints (Implemented)

#### Public Catalog Endpoint

```
GET /admin/system-config/api/available-workflows/
```

**Purpose**: List published workflows available to tenant users  
**Permission**: `IsAuthenticated` (any logged-in user)  
**Returns**: Array of published blueprints

**Response**:
```json
[
  {
    "id": "uuid-here",
    "name": "Customer Onboarding",
    "slug": "customer-onboarding",
    "created_at": "2026-01-23T13:00:00Z"
  }
]
```

**Security**:
- ✅ Filters to `published_version__isnull=False`
- ✅ Read-only (no mutations)
- ✅ No admin privileges required
- ✅ Safe metadata exposure only

#### Start Workflow Endpoint

```
POST /admin/system-config/api/runs/
```

**Purpose**: Initiate a new workflow execution  
**Permission**: `IsAuthenticated`  
**Body**:
```json
{
  "blueprint_slug": "customer-onboarding",
  "initial_data": {}  // Optional
}
```

**Response**:
```json
{
  "run_id": "uuid-workflow-run",
  "step_schema": {
    "fields": [...],  // DynamicFormEngine schema
    "step_title": "Step 1: Basic Information",
    "step_description": "Enter customer details"
  },
  "message": "Workflow started successfully"
}
```

**What Happens**:
1. ✅ Creates `WorkflowRun` record with `tenant=request.tenant`
2. ✅ Initializes `data_context` with user/tenant info
3. ✅ Returns first step schema for rendering
4. ✅ Sets `status=IN_PROGRESS`, `current_step_index=0`

#### Submit Step Endpoint

```
POST /admin/system-config/api/runs/:run_id/submit_step/
```

**Purpose**: Submit current step data and advance workflow  
**Permission**: `IsAuthenticated` + tenant owns the run  
**Body**:
```json
{
  "step_data": {
    "customer_name": "Acme Corp",
    "customer_email": "contact@acme.com"
  }
}
```

**Response (Not Complete)**:
```json
{
  "complete": false,
  "next_step_schema": {
    "fields": [...],  // Next step fields
    "step_title": "Step 2: Address Details"
  },
  "initial_data": {},  // Pre-populated values if any
  "current_step_index": 1
}
```

**Response (Complete)**:
```json
{
  "complete": true,
  "run_id": "uuid-workflow-run",
  "message": "Workflow completed successfully"
}
```

**What Happens**:
1. ✅ Validates step data against schema
2. ✅ Merges data into `WorkflowRun.data_context`
3. ✅ Increments `current_step_index`
4. ✅ Returns next step schema or completion message
5. ✅ Sets `status=COMPLETED` if final step

#### Retrieve Workflow Run

```
GET /admin/system-config/api/runs/:run_id/
```

**Purpose**: Get workflow run details  
**Permission**: `IsAuthenticated` + tenant owns the run  
**Response**:
```json
{
  "id": "uuid-workflow-run",
  "workflow_slug": "customer-onboarding",
  "status": "IN_PROGRESS",
  "current_step_index": 1,
  "data_context": {
    "step_0": { "customer_name": "Acme Corp" },
    "tenant_id": "uuid-tenant",
    "user_id": "uuid-user"
  },
  "created_on": "2026-01-23T10:00:00Z",
  "modified_on": "2026-01-23T10:05:00Z"
}
```

### 5.3 Frontend Integration

#### Workflow Center (`/workflows`)

**Component**: `WorkflowList.tsx`  
**Purpose**: "App Store" catalog of available workflows

**Features**:
- ✅ Card grid layout (responsive)
- ✅ Loading, error, and empty states
- ✅ "Start Workflow" button
- ✅ React Query caching
- ✅ Automatic redirect to runner

**User Flow**:
1. User clicks "Workflows" (⚡) in sidebar
2. Sees grid of published workflow cards
3. Clicks "Start Workflow" on desired card
4. Redirects to `/workflows/run/:runId`

#### Workflow Runner (`/workflows/run/:runId`)

**Component**: `WorkflowRunner.tsx` + `DynamicFormEngine.tsx`  
**Purpose**: Execute multi-step workflows

**Features**:
- ✅ Dynamic form rendering based on step schema
- ✅ Progress bar showing completion percentage
- ✅ Step indicator (e.g., "Step 2 of 5")
- ✅ Form validation before submission
- ✅ Auto-advance to next step
- ✅ Success message on completion

**Supported Field Types**:
- `text` - Single-line text input
- `textarea` - Multi-line text
- `number` - Numeric input
- `date` - Date picker
- `select` - Dropdown menu
- `checkbox` - Boolean toggle
- `email` - Email with validation

**Example Step Schema**:
```json
{
  "fields": [
    {
      "name": "customer_name",
      "type": "text",
      "label": "Customer Name",
      "required": true,
      "placeholder": "Enter customer name"
    },
    {
      "name": "customer_email",
      "type": "email",
      "label": "Email Address",
      "required": true,
      "validation": {
        "pattern": "^[^@]+@[^@]+\\.[^@]+$",
        "message": "Please enter a valid email"
      }
    },
    {
      "name": "priority",
      "type": "select",
      "label": "Priority Level",
      "required": false,
      "options": ["Low", "Medium", "High"],
      "default": "Medium"
    }
  ]
}
```

### 5.4 Execution Engine

**Location**: `backend/shared_apps/system_config/engine.py`

**Singleton Pattern**:
```python
# Global instance
engine = WorkflowEngine()

# Usage in views
run_id, step_schema = engine.start_workflow(
    tenant=request.tenant,
    blueprint_slug='customer-onboarding',
    user=request.user
)
```

**Key Methods**:

1. **`start_workflow()`**
   - Creates WorkflowRun
   - Loads published blueprint version
   - Returns first step schema
   - Initializes data_context

2. **`submit_step()`**
   - Validates data against step schema
   - Merges into data_context
   - Advances step index
   - Returns next step or completion

3. **`get_step_schema()`**
   - Extracts current step from logic_config
   - Returns formatted schema for frontend
   - Handles initial_data for pre-population

**Error Handling**:
- ✅ `WorkflowEngineError` - Workflow-specific errors
- ✅ `ValidationError` - Data validation failures
- ✅ Detailed error messages
- ✅ HTTP 400 for client errors
- ✅ HTTP 500 for server errors

### 5.5 Security Model

**Blueprint Access**:
- ✅ Public read (published blueprints only)
- ✅ No modification by tenant users
- ✅ Global Admins can create/edit drafts
- ✅ Superusers can publish

**Workflow Runs**:
- ✅ Tenant-isolated (via `TenantAwareModel`)
- ✅ Users only see their tenant's runs
- ✅ Auto-assign `tenant=request.tenant`
- ✅ Cannot access other tenant's runs

**Data Context**:
- ✅ Stored securely in `data_context` JSONField
- ✅ Never exposed to other tenants
- ✅ Cleared on workflow completion (optional)
- ✅ Audit trail preserved

### 5.6 Navigation

**Sidebar Menu**:
- Icon: ⚡ (Lightning bolt)
- Label: "Workflows"
- Route: `/workflows`
- Permission: Any authenticated user

**Routes**:
- `/workflows` → WorkflowList (catalog)
- `/workflows/run/:runId` → WorkflowRunner (execution)

---

## 6. API Endpoints (Legacy - Now Implemented)

```
GET    /api/v1/system-config/blueprints/          # List all blueprints
GET    /api/v1/system-config/blueprints/:id/      # Get blueprint details
POST   /api/v1/system-config/blueprints/          # Create new blueprint (Global Admin)
PUT    /api/v1/system-config/blueprints/:id/      # Update blueprint (Global Admin)

GET    /api/v1/system-config/blueprints/:id/versions/        # List versions
POST   /api/v1/system-config/blueprints/:id/versions/        # Create new version (Global Admin)
POST   /api/v1/system-config/blueprints/:id/publish/         # Publish version (Superuser ONLY)

GET    /api/v1/workflow-runs/                     # List tenant's workflow runs
POST   /api/v1/workflow-runs/                     # Start new workflow run
GET    /api/v1/workflow-runs/:id/                 # Get run details
POST   /api/v1/workflow-runs/:id/advance/         # Advance to next step
POST   /api/v1/workflow-runs/:id/cancel/          # Cancel run
```

---

## 6. Security Verification Tests

**Location**: `backend/shared_apps/system_config/tests/test_security.py`

**Critical Tests**:
1. ✅ **Blueprint Access**: Global Admins CAN access EntityBlueprint/BlueprintVersion
2. ✅ **Tenant Data Isolation**: Global Admins CANNOT access tenant business data
3. ✅ **Publish Restriction**: Only Superusers can publish (Global Admins blocked)
4. ✅ **WorkflowRun Isolation**: Runs are tenant-isolated via TenantAwareModel
5. ✅ **Cross-Tenant Prevention**: Queries with wrong tenant return empty

**Run Tests**:
```bash
python manage.py test shared_apps.system_config.tests.test_security
```

---

## 7. Migration Checklist

Before deploying to production:

- [ ] Phase 1.1 migrations applied (TenantAwareModel + custom_data)
- [ ] Phase 1.2 migrations applied (system_config app + System Root tenant)
- [ ] System Root tenant exists (UUID: `0000...`)
- [ ] Global System Admins group exists
- [ ] Middleware updated with Global Admin bypass logic
- [ ] Security tests passed (all 7 tests green)
- [ ] RLS policies configured (if using PostgreSQL RLS)
- [ ] Superuser account created for publishing

---

## 8. Future Phases

**Phase 3: Frontend Studio** (Not yet implemented)
- Visual workflow designer (React Flow)
- Schema editor UI
- Version management interface
- Publish approval workflow

**Phase 4: Runtime Engine** (Not yet implemented)
- Workflow execution engine
- Step-by-step processing
- Error handling and retries
- Audit logging

**Phase 5: Advanced Features** (Not yet implemented)
- Conditional branching
- Parallel execution
- API integrations
- Custom actions

---

## 9. Glossary

**Blueprint**: A template defining data structure and workflow for an entity type  
**Version**: A specific iteration of a Blueprint (v1, v2, v3...)  
**Draft**: Editable version, not visible to tenants  
**Published**: Immutable version, available to all tenants  
**System Root**: Special tenant (UUID: `0000...`) for Global Admin operations  
**Global Admin**: User in "Global System Admins" group (manages Blueprints)  
**Superuser**: Django superuser (can publish Blueprints)  
**Tenant Isolation**: Data segregation ensuring tenants only see their own data  
**RLS**: Row-Level Security (PostgreSQL feature for database-level isolation)  
**Meta-Model**: "Configuration as Data" pattern where schemas are stored in JSON  

---

## 10. Contact & Support

**Documentation Maintained By**: System Architecture Team  
**Last Reviewed**: January 23, 2026  
**Questions?**: Contact the Platform Team

**Related Documentation**:
- `/backend/shared_apps/system_config/models.py` - Model definitions
- `/backend/shared_apps/system_config/tests/test_security.py` - Security tests
- `/backend/apps/tenants/middleware.py` - Middleware logic
- `/backend/apps/core/models.py` - TenantAwareModel base class

---

**Status**: ✅ Phase 3 Complete (Runtime Engine + Integration)  
**Implemented**: Workflow execution, public catalog, dynamic forms, tenant UI  
**Production Ready**: Yes  
**Next**: Phase 4 - Polish & Release
