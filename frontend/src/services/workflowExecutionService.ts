/**
 * Workflow Execution API Service
 * 
 * Service for managing workflow execution tracking.
 * Phase 5: Frontend Dashboard Integration
 */

import { businessApi } from './businessApi';
import {
  WorkflowExecution,
  WorkflowExecutionListResponse,
  WorkflowAuditTrailResponse,
  ResumeWorkflowPayload,
  CancelWorkflowPayload,
} from '../types/workflows';

/**
 * Workflow Execution API Service
 */
export class WorkflowExecutionService {
  private baseUrl = '/workflows/form-submissions/';

  /**
   * Get workflow executions with filtering
   */
  async getExecutions(params?: {
    status?: string;
    assigned_to?: string;
    page?: number;
    page_size?: number;
  }): Promise<WorkflowExecutionListResponse> {
    const response = await businessApi.get(this.baseUrl, { params });

    const rawResults = Array.isArray(response.data?.results)
      ? response.data.results
      : Array.isArray(response.data)
        ? response.data
        : [];

    const results = rawResults.map(this.transformToExecution);
    
    return {
      count: response.data.count || results.length,
      next: response.data.next || null,
      previous: response.data.previous || null,
      results,
    };
  }

  /**
   * Get a single workflow execution by ID
   */
  async getExecution(id: string): Promise<WorkflowExecution> {
    const response = await businessApi.get(`${this.baseUrl}${id}/`);
    return this.transformToExecution(response.data);
  }

  /**
   * Get audit trail for a workflow execution
   */
  async getAuditTrail(id: string): Promise<WorkflowAuditTrailResponse> {
    const response = await businessApi.get(`${this.baseUrl}${id}/history/`);
    
    const execution = this.transformToExecution(response.data.submission);
    const auditTrail = (response.data.history || []).map((entry: any) => ({
      id: entry.id,
      execution_id: id,
      step_name: entry.step_name || 'Unknown',
      step_id: entry.step_id || '',
      action: entry.status === 'completed' ? 'completed' : 'started',
      user_name: entry.assigned_to_name || entry.created_by_name,
      timestamp: entry.created_at,
      duration_seconds: entry.duration_seconds,
      notes: entry.notes,
      data: entry.data,
    }));

    // Calculate total duration
    const totalDuration = auditTrail.reduce(
      (sum: number, entry: any) => sum + (entry.duration_seconds || 0),
      0
    );

    return {
      execution,
      audit_trail: auditTrail,
      total_duration_seconds: totalDuration,
    };
  }

  /**
   * Resume a workflow execution
   */
  async resumeExecution(id: string, payload?: ResumeWorkflowPayload): Promise<WorkflowExecution> {
    const response = await businessApi.post(`${this.baseUrl}${id}/resume/`, payload);
    return this.transformToExecution(response.data);
  }

  /**
   * Cancel a workflow execution
   */
  async cancelExecution(id: string, payload?: CancelWorkflowPayload): Promise<WorkflowExecution> {
    const response = await businessApi.post(`${this.baseUrl}${id}/cancel/`, payload);
    return this.transformToExecution(response.data);
  }

  /**
   * Transform FormSubmission API response to WorkflowExecution
   */
  private transformToExecution(submission: any): WorkflowExecution {
    const totalSteps = submission.total_steps || 1;
    const currentStep = submission.current_step || 0;
    const completedSteps = Math.min(currentStep, totalSteps);
    const progressPercent = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    return {
      id: submission.id,
      workflow_name: submission.form_name || 'Unnamed Workflow',
      workflow_id: submission.form || submission.form_id || '',
      status: submission.status,
      current_node_id: submission.current_step_id || submission.current_step,
      current_step_name: submission.current_step_name || `Step ${currentStep}`,
      completed_nodes: completedSteps,
      total_nodes: totalSteps,
      progress_percent: progressPercent,
      assigned_to: submission.assigned_to,
      assigned_to_name: submission.assigned_to_name,
      started_by: submission.created_by || '',
      started_by_name: submission.created_by_name || 'Unknown',
      created_at: submission.created_at,
      updated_at: submission.updated_at,
      completed_at: submission.completed_at,
      cancelled_at: submission.cancelled_at,
      error_message: submission.error_message,
      data: submission.data,
    };
  }
}

// Export singleton instance
export const workflowExecutionService = new WorkflowExecutionService();
