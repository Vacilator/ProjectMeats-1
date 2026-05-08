# Phase 5: WorkFlow Execution API Contract

## Overview
This document defines the API contract for the WorkflowExecution system connecting Catalog, MyTasks, and History pages.

---

## API Endpoints

### 1. List Workflow Executions
**Endpoint**: `GET /api/workflows/executions/`

**Description**: List all workflow executions with filtering support.

**Query Parameters**:
- `status` (string, optional): Filter by status (comma-separated for multiple)
  - Values: `pending`, `in_progress`, `paused`, `completed`, `failed`, `cancelled`
  - Example: `?status=in_progress,paused`
- `assigned_to` (string, optional): Filter by assigned user
  - Special value: `me` (current user)
  - Or UUID of user
- `workflow` (UUID, optional): Filter by workflow ID
- `started_by` (string, optional): Filter by starter
  - Special value: `me` (current user)
  - Or UUID of user
- `page` (int, optional): Page number for pagination
- `page_size` (int, optional): Items per page (default: 20)

**Response**:
```json
{
  "count": 45,
  "next": "https://api.example.com/api/workflows/executions/?page=2",
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "workflow": "uuid",
      "workflow_name": "Supplier Onboarding",
      "workflow_icon": "⚙️",
      "status": "in_progress",
      "current_node_id": "step_2",
      "progress_percent": 40,
      "started_by": "uuid",
      "started_by_name": "John Doe",
      "assigned_to": "uuid",
      "assigned_to_name": "Jane Smith",
      "created_at": "2026-02-14T10:30:00Z",
      "updated_at": "2026-02-14T11:00:00Z",
      "started_at": "2026-02-14T10:31:00Z",
      "completed_at": null,
      "total_nodes": 5,
      "completed_nodes": 2,
      "duration_seconds": 1800.5,
      "error_message": ""
    }
  ]
}
```

---

### 2. Get Execution Details
**Endpoint**: `GET /api/workflows/executions/{id}/`

**Description**: Get detailed information about a specific execution including full context and audit trail.

**Response**:
```json
{
  "id": "uuid",
  "workflow": "uuid",
  "workflow_name": "Supplier Onboarding",
  "workflow_icon": "⚙️",
  "workflow_description": "Complete onboarding process for new suppliers",
  "status": "in_progress",
  "current_node_id": "approval_node",
  "context_data": {
    "supplier_id": "uuid",
    "approval_level": 2,
    "custom_variables": {}
  },
  "audit_trail": [
    {
      "timestamp": "2026-02-14T10:31:00Z",
      "node_id": "start",
      "action": "created",
      "user_id": "uuid",
      "user_name": "John Doe",
      "data": {}
    },
    {
      "timestamp": "2026-02-14T10:45:00Z",
      "node_id": "step_1",
      "action": "completed",
      "user_id": "uuid",
      "user_name": "John Doe",
      "data": {"fields_filled": 10}
    }
  ],
  "progress_percent": 40,
  "started_by": "uuid",
  "started_by_name": "John Doe",
  "assigned_to": "uuid",
  "assigned_to_name": "Jane Smith",
  "created_at": "2026-02-14T10:30:00Z",
  "updated_at": "2026-02-14T11:00:00Z",
  "started_at": "2026-02-14T10:31:00Z",
  "completed_at": null,
  "total_nodes": 5,
  "completed_nodes": 2,
  "duration_seconds": 1800.5,
  "error_message": ""
}
```

---

### 3. Create New Execution
**Endpoint**: `POST /api/workflows/executions/`

**Description**: Start a new workflow execution.

**Request Body**:
```json
{
  "workflow": "uuid",
  "assigned_to": "uuid (optional)",
  "context_data": {
    "initial_variables": "any_value"
  }
}
```

**Response**: Same as GET execution details (201 Created)

---

### 4. Update Execution
**Endpoint**: `PATCH /api/workflows/executions/{id}/`

**Description**: Update execution state (progress, context, status).

**Request Body** (all fields optional):
```json
{
  "status": "in_progress",
  "current_node_id": "step_3",
  "context_data": {
    "updated_variables": "value"
  },
  "assigned_to": "uuid",
  "completed_nodes": 3,
  "error_message": "Optional error details"
}
```

**Response**: Updated execution details (200 OK)

---

### 5. Get Audit Trail
**Endpoint**: `GET /api/workflows/executions/{id}/audit/`

**Description**: Get chronological audit trail for an execution.

**Response**:
```json
{
  "execution_id": "uuid",
  "workflow_name": "Supplier Onboarding",
  "status": "in_progress",
  "audit_trail": [
    {
      "timestamp": "2026-02-14T10:31:00Z",
      "node_id": "start",
      "action": "created",
      "user_id": "uuid",
      "user_name": "John Doe",
      "data": {}
    },
    {
      "timestamp": "2026-02-14T10:45:00Z",
      "node_id": "step_1",
      "action": "completed",
      "user_id": "uuid",
      "user_name": "John Doe",
      "data": {"fields_filled": 10}
    },
    {
      "timestamp": "2026-02-14T11:00:00Z",
      "node_id": "step_2",
      "action": "paused",
      "user_id": "uuid",
      "user_name": "John Doe",
      "data": {"reason": "Waiting for approvals"}
    }
  ]
}
```

---

### 6. Resume Execution
**Endpoint**: `POST /api/workflows/executions/{id}/resume/`

**Description**: Resume a paused execution.

**Request Body** (optional):
```json
{
  "reason": "Approvals received"
}
```

**Response**: Updated execution details (200 OK)

**Error Response**:
```json
{
  "error": "Cannot resume execution with status completed"
}
```
(400 Bad Request)

---

### 7. Pause Execution
**Endpoint**: `POST /api/workflows/executions/{id}/pause/`

**Description**: Pause an in-progress execution.

**Request Body** (optional):
```json
{
  "reason": "Waiting for approvals"
}
```

**Response**: Updated execution details (200 OK)

---

### 8. Cancel Execution
**Endpoint**: `POST /api/workflows/executions/{id}/cancel/`

**Description**: Cancel an execution (cannot be resumed after cancellation).

**Request Body** (optional):
```json
{
  "reason": "No longer needed"
}
```

**Response**: Updated execution details (200 OK)

---

## Status Flow Diagram

```
pending ──▶ in_progress ◀──▶ paused
                │
                ├──▶ completed
                ├──▶ failed
                └──▶ cancelled
```

**Rules**:
- `resume()` only works on `paused` status
- `pause()` only works on `in_progress` status
- `cancel()` works on any status except `completed` or `failed`
- Once `completed`, `failed`, or `cancelled`, status cannot change

---

## Frontend Integration Examples

### MyTasks.tsx - Fetch In-Progress Workflows
```typescript
const { data } = useQuery({
  queryKey: ['workflow-executions', 'in-progress'],
  queryFn: async () => {
    const response = await apiClient.get('/workflows/executions/', {
      params: {
        status: 'in_progress',
        assigned_to: 'me'
      }
    });
    return response.data.results;
  }
});
```

### History.tsx - Fetch Completed Workflows
```typescript
const { data } = useQuery({
  queryKey: ['workflow-executions', 'completed', filters],
  queryFn: async () => {
    const response = await apiClient.get('/workflows/executions/', {
      params: {
        status: 'completed',
        workflow: selectedWorkflowId,
        page: currentPage
      }
    });
    return response.data;
  }
});
```

### InProgress.tsx - Real-Time Updates with Polling
```typescript
const { data } = useQuery({
  queryKey: ['workflow-executions'],
  queryFn: async () => {
    const response = await apiClient.get('/workflows/executions/', {
      params: {
        status: 'in_progress,paused'
      }
    });
    return response.data.results;
  },
  refetchInterval: 10000  // Poll every 10 seconds
});
```

### Resume/Pause/Cancel Actions
```typescript
const resumeMutation = useMutation({
  mutationFn: async (executionId: string) => {
    return apiClient.post(`/workflows/executions/${executionId}/resume/`, {
      reason: 'Ready to continue'
    });
  },
  onSuccess: () => {
    queryClient.invalidateQueries(['workflow-executions']);
  }
});
```

---

## Authentication & Permissions

**All endpoints require authentication**: `IsAuthenticated` permission class.

**Tenant Filtering**: All queries are automatically filtered by `request.tenant`.

**Future Enhancement**: Role-based permissions (viewer can only see assigned executions, admin can see all).

---

## Error Handling

**Common Error Responses**:

- `400 Bad Request`: Invalid status transition or missing required fields
- `401 Unauthorized`: Not authenticated
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Execution not found or not accessible in current tenant
- `500 Internal Server Error`: Server error

**Error Response Format**:
```json
{
  "error": "Error message description",
  "detail": "Additional error details (optional)",
  "code": "ERROR_CODE (optional)"
}
```

---

## Verification Steps

1. **Backend API Tests**:
   ```bash
   # List executions
   curl -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/workflows/executions/

   # Create execution
   curl -X POST -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"workflow": "uuid"}' \
        http://localhost:8000/api/workflows/executions/

   # Get audit trail
   curl -H "Authorization: Bearer $TOKEN" \
        http://localhost:8000/api/workflows/executions/uuid/audit/

   # Resume execution
   curl -X POST -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"reason": "Ready"}' \
        http://localhost:8000/api/workflows/executions/uuid/resume/
   ```

2. **Frontend Integration Tests**:
   - Verify MyTasks shows in-progress workflows
   - Verify History shows completed workflows with audit trail
   - Test resume/pause/cancel actions
   - Test real-time polling updates
   - Verify tenant isolation

3. **Performance Tests**:
   - Test with 100+ executions
   - Verify pagination works correctly
   - Check query performance with filters

---

## Next Steps

1. ✅ Backend API implemented
2. ⏳ Update MyTasks.tsx with execution tracking
3. ⏳ Update History.tsx with audit trail
4. ⏳ Update InProgress.tsx with real-time updates
5. ⏳ Add usage_count to Catalog workflow cards
6. ⏳ Integration testing
7. ⏳ Performance optimization
