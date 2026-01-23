# Workflow Engine API Reference

## Overview

The Workflow Engine API provides endpoints for creating, executing, and monitoring custom business workflows. This document covers all available endpoints, request/response formats, and usage examples.

**Base URL:** `/admin/system-config/api/`

**Authentication:** All endpoints require authentication via session cookies or token auth.

**Tenant Isolation:** All operations are scoped to the authenticated user's tenant.

---

## Endpoints

### Workflow Catalog

#### List Available Workflows
Get all published workflows available to the current tenant.

```http
GET /admin/system-config/api/available-workflows/
```

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Customer Onboarding",
    "slug": "customer-onboarding",
    "description": "Onboard new customers with standardized workflow"
  }
]
```

**Notes:**
- Returns flat array (not paginated)
- Only includes published workflows
- Sorted by creation date (newest first)

---

### Blueprint Version Management

#### Get Blueprint Version Details
Retrieve full configuration for a specific blueprint version.

```http
GET /admin/system-config/api/studio/versions/{version_id}/
```

**Response:**
```json
{
  "id": "uuid",
  "blueprint": "uuid",
  "version": 1,
  "status": "PUBLISHED",
  "is_published": true,
  "schema_config": {
    "fields": [
      {
        "key": "customer_name",
        "label": "Customer Name",
        "type": "text",
        "required": true
      }
    ]
  },
  "workflow_config": {
    "steps": [
      {
        "id": "step_1",
        "label": "Collect Information",
        "type": "form",
        "config": {
          "submit_button_text": "Next",
          "form_fields": ["customer_name", "email"]
        }
      }
    ]
  },
  "created_at": "2026-01-23T12:00:00Z"
}
```

#### Update Schema Configuration
Update the data schema (fields) for a blueprint version.

```http
PATCH /admin/system-config/api/studio/versions/{version_id}/schema/
Content-Type: application/json
X-CSRFToken: {token}

{
  "schema_config": {
    "fields": [...]
  }
}
```

**Response:**
```json
{
  "message": "Schema configuration updated successfully"
}
```

**Validation:**
- Each field must have `key` and `label`
- Keys must be unique
- Select/radio fields must have `options` array

#### Update Workflow Configuration
Update the workflow steps for a blueprint version.

```http
PATCH /admin/system-config/api/studio/versions/{version_id}/workflow/
Content-Type: application/json
X-CSRFToken: {token}

{
  "workflow_config": {
    "steps": [...]
  }
}
```

**Response:**
```json
{
  "message": "Workflow configuration updated successfully"
}
```

#### Publish Blueprint
Publish a blueprint version, making it available for execution.

```http
POST /admin/system-config/api/studio/versions/{version_id}/publish/
X-CSRFToken: {token}
```

**Response:**
```json
{
  "message": "Blueprint version published successfully"
}
```

**Effects:**
- Sets `EntityBlueprint.published_version` to this version
- Changes version `status` to "PUBLISHED"
- Workflow becomes visible in catalog

#### Unpublish Blueprint
Unpublish a blueprint version.

```http
POST /admin/system-config/api/studio/versions/{version_id}/unpublish/
X-CSRFToken: {token}
```

**Response:**
```json
{
  "message": "Blueprint version unpublished successfully"
}
```

---

### Version History

#### Get Version History
Retrieve all versions of a blueprint with metadata.

```http
GET /admin/system-config/api/studio/versions/{version_id}/version_history/
```

**Response:**
```json
{
  "versions": [
    {
      "id": "uuid",
      "version": 2,
      "status": "PUBLISHED",
      "created_at": "2026-01-23T14:00:00Z",
      "field_count": 5,
      "step_count": 3
    },
    {
      "id": "uuid",
      "version": 1,
      "status": "DRAFT",
      "created_at": "2026-01-23T12:00:00Z",
      "field_count": 3,
      "step_count": 2
    }
  ]
}
```

#### Compare Versions
Get diff between two blueprint versions.

```http
GET /admin/system-config/api/studio/versions/{version_id}/compare_versions/?with={other_version_id}
```

**Response:**
```json
{
  "current_version": 2,
  "compared_version": 1,
  "schema_diff": {
    "added_fields": ["phone"],
    "removed_fields": [],
    "modified_fields": ["email"]
  },
  "workflow_diff": {
    "added_steps": ["Approval"],
    "removed_steps": [],
    "modified_steps": ["Collect Information"]
  },
  "current_schema": {...},
  "compared_schema": {...},
  "current_workflow": {...},
  "compared_workflow": {...}
}
```

#### Rollback to Version
Create new draft version from older version configuration.

```http
POST /admin/system-config/api/studio/versions/{version_id}/rollback/
X-CSRFToken: {token}
```

**Response:**
```json
{
  "message": "Rolled back to version 1. New draft version 3 created.",
  "new_version_id": "uuid",
  "new_version_number": 3
}
```

**Notes:**
- Non-destructive: creates new version instead of overwriting
- New version starts as DRAFT
- Preserves complete version history

---

### Workflow Execution

#### Start Workflow
Create a new workflow run instance.

```http
POST /admin/system-config/api/workflow-runs/start/
Content-Type: application/json

{
  "workflow_slug": "customer-onboarding",
  "initial_data": {
    "customer_name": "Acme Corp"
  }
}
```

**Response:**
```json
{
  "run_id": "uuid",
  "schema": {
    "fields": [...],
    "initial_data": {...}
  }
}
```

#### Submit Step
Submit data for the current workflow step.

```http
POST /admin/system-config/api/workflow-runs/{run_id}/submit_step/
Content-Type: application/json

{
  "data": {
    "customer_name": "Acme Corp",
    "email": "contact@acme.com"
  }
}
```

**Response (Continue):**
```json
{
  "status": "continue",
  "next_step": 1,
  "schema": {...}
}
```

**Response (Complete):**
```json
{
  "status": "complete",
  "message": "Workflow completed successfully"
}
```

**Errors:**
```json
{
  "status": "error",
  "error": "Validation failed",
  "details": {
    "email": ["This field is required"]
  }
}
```

#### Get Workflow Run Details
Retrieve detailed information about a workflow run.

```http
GET /admin/system-config/api/workflow-runs/{run_id}/
```

**Response:**
```json
{
  "id": "uuid",
  "workflow_slug": "customer-onboarding",
  "workflow_name": "Customer Onboarding",
  "status": "IN_PROGRESS",
  "current_step_index": 1,
  "total_steps": 3,
  "progress_percentage": 33,
  "data_context": {...},
  "execution_history": [
    {
      "timestamp": "2026-01-23T15:00:00Z",
      "event": "step_completed",
      "step_index": 0,
      "step_name": "Collect Information"
    }
  ],
  "error_log": [],
  "step_details": [
    {
      "index": 0,
      "id": "step_1",
      "label": "Collect Information",
      "type": "form",
      "status": "completed"
    },
    {
      "index": 1,
      "id": "step_2",
      "label": "Approval",
      "type": "approval",
      "status": "current"
    }
  ],
  "created_on": "2026-01-23T14:50:00Z",
  "modified_on": "2026-01-23T15:00:00Z"
}
```

---

### Workflow Monitoring

#### List My Workflows
Get workflow runs for the current user with filtering.

```http
GET /admin/system-config/api/workflow-runs/my_workflows/?status=IN_PROGRESS&limit=20
```

**Query Parameters:**
- `status` (optional): Filter by status (IN_PROGRESS, COMPLETED, FAILED)
- `limit` (optional): Max results (default: 20)

**Response:**
```json
{
  "count": 5,
  "results": [
    {
      "id": "uuid",
      "workflow_slug": "customer-onboarding",
      "workflow_name": "Customer Onboarding",
      "status": "IN_PROGRESS",
      "progress_percentage": 66,
      "current_step_index": 2,
      "created_on": "2026-01-23T14:00:00Z",
      "modified_on": "2026-01-23T14:30:00Z"
    }
  ]
}
```

#### Get Execution Log
Retrieve detailed execution history for a workflow run.

```http
GET /admin/system-config/api/workflow-runs/{run_id}/execution_log/
```

**Response:**
```json
{
  "execution_history": [
    {
      "timestamp": "2026-01-23T14:00:00Z",
      "event": "workflow_started",
      "step_index": 0,
      "message": "Workflow 'Customer Onboarding' started by user john_doe",
      "user": "uuid"
    },
    {
      "timestamp": "2026-01-23T14:05:00Z",
      "event": "step_completed",
      "step_index": 0,
      "step_name": "Collect Information",
      "data": {
        "customer_name": "Acme Corp",
        "password": "***"
      }
    }
  ],
  "error_log": []
}
```

**Notes:**
- Sensitive fields (containing "password") are redacted
- Timestamps in ISO 8601 format
- Events ordered chronologically

---

## Data Models

### Workflow Statuses
```typescript
enum WorkflowStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED"
}
```

### Step Types
```typescript
enum StepType {
  FORM = "form",
  APPROVAL = "approval",
  NOTIFICATION = "notification",
  ACTION = "action"
}
```

### Field Types
```typescript
enum FieldType {
  TEXT = "text",
  NUMBER = "number",
  EMAIL = "email",
  DATE = "date",
  SELECT = "select",
  RADIO = "radio",
  CHECKBOX = "checkbox",
  TEXTAREA = "textarea"
}
```

### Step Configuration Schemas

**Form Step:**
```typescript
{
  submit_button_text?: string;
  form_fields?: string[]; // Keys of fields to display
}
```

**Approval Step:**
```typescript
{
  approver_role?: string;
  approval_message?: string;
  auto_approve_after_hours?: number;
}
```

**Notification Step:**
```typescript
{
  notification_type?: 'email' | 'sms' | 'in_app';
  recipients?: string[];
  subject?: string;
  message?: string;
}
```

**Action Step:**
```typescript
{
  action_type?: 'create_record' | 'update_record' | 'send_webhook' | 'custom';
  target_model?: string;
  field_mappings?: Record<string, string>;
}
```

---

## Error Handling

### Standard Error Response
```json
{
  "detail": "Error message",
  "status_code": 400
}
```

### Common Error Codes

| Code | Meaning |
|------|---------|
| 400 | Bad Request - Invalid input data |
| 401 | Unauthorized - Authentication required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 500 | Internal Server Error |

---

## Rate Limiting

**Current Status:** No rate limiting implemented

**Planned:** 
- Workflow starts: 10 per minute per user
- Step submissions: 20 per minute per user
- Queries: 60 per minute per user

---

## Best Practices

### 1. Version Management
- Always create draft versions for testing
- Only publish stable workflows
- Use rollback for quick reverts, not for regular edits

### 2. Workflow Design
- Keep workflows under 10 steps for better UX
- Validate data early in the workflow
- Provide clear labels and help text

### 3. Performance
- Batch fetch workflow lists instead of individual runs
- Use status filters to reduce dataset size
- Cache blueprint configurations client-side

### 4. Error Handling
- Always check `status` field in responses
- Display validation errors inline with fields
- Provide retry mechanisms for network failures

---

## Migration Guide

### From Manual Django Admin to API

**Before:**
```python
# Manual JSON editing in Django admin
blueprint.schema_config = {
  "fields": [...]
}
blueprint.save()
```

**After:**
```javascript
// Visual Studio with API
await axios.patch(`/api/studio/versions/${id}/schema/`, {
  schema_config: { fields: [...] }
});
```

### From Hardcoded Workflows to Dynamic Engine

**Before:**
```python
# Custom view for each workflow
def customer_onboarding(request):
    # Hardcoded logic
    pass
```

**After:**
```javascript
// Generic workflow runner
const { run_id } = await api.post('/workflow-runs/start/', {
  workflow_slug: 'customer-onboarding'
});
```

---

## Support

**Documentation:** `/docs/WORKFLOW_ENGINE_API.md` (this file)
**Troubleshooting:** `/docs/WORKFLOW_ENGINE_TROUBLESHOOTING.md`
**User Guide:** `/docs/WORKFLOW_STUDIO_USER_GUIDE.md`

**Issues:** Report bugs via GitHub Issues
**Questions:** Contact dev team via Slack #workflow-engine
