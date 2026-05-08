/**
 * Workflow Execution Types
 *
 * Type definitions for workflow execution tracking and management.
 * Phase 5: Frontend Dashboard Integration
 */

/**
 * Workflow execution status choices
 */
export type WorkflowExecutionStatus =
  | 'draft'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Workflow execution - tracks form submissions as workflow executions
 */
export interface WorkflowExecution {
  id: string;
  workflow_name: string;
  workflow_id: string;
  status: WorkflowExecutionStatus;
  current_node_id?: string;
  current_step_name?: string;
  completed_nodes: number;
  total_nodes: number;
  progress_percent: number;
  assigned_to?: string;
  assigned_to_name?: string;
  started_by: string;
  started_by_name?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_at?: string;
  error_message?: string;
  data?: Record<string, unknown>;
}

/**
 * Audit trail entry for workflow execution
 */
export interface WorkflowAuditEntry {
  id: string;
  execution_id: string;
  step_name: string;
  step_id: string;
  action: 'started' | 'completed' | 'skipped' | 'failed';
  user_name?: string;
  timestamp: string;
  duration_seconds?: number;
  notes?: string;
  data?: Record<string, unknown>;
}

/**
 * Workflow execution list response (paginated)
 */
export interface WorkflowExecutionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: WorkflowExecution[];
}

/**
 * Workflow execution audit trail response
 */
export interface WorkflowAuditTrailResponse {
  execution: WorkflowExecution;
  audit_trail: WorkflowAuditEntry[];
  total_duration_seconds: number;
}

/**
 * Resume workflow request payload
 */
export interface ResumeWorkflowPayload {
  step_id?: string;
  notes?: string;
}

/**
 * Cancel workflow request payload
 */
export interface CancelWorkflowPayload {
  reason?: string;
  notes?: string;
}
