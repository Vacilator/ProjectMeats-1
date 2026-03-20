/**
 * Workflow Persistence Utilities
 * 
 * Phase 7: Save and load workflow data to/from backend APIs
 * - Saves complete workflow to TenantWorkForm
 * - Links form steps to TenantForm records
 * - Handles container children serialization
 * - Reconstructs parent-child relationships on load
 * 
 * Created: 2026-02-08
 * Updated: 2026-02-10 - Fixed auth by using apiClient
 */

import { Node, Edge } from '@xyflow/react';
import { logger } from '@/utils/logger';

import { sortNodesTopologically } from './nodeSorting';
import { apiClient } from '../../../services/apiService';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface SaveWorkflowPayload {
  name: string;
  description?: string;
  status?: 'draft' | 'active' | 'archived';
  workflow_definition: {
    nodes: Node[];
    edges: Edge[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
}

export interface LoadWorkflowResponse {
  id: string;
  name: string;
  description: string;
  status: string;
  workflow_definition: {
    nodes: Node[];
    edges: Edge[];
    viewport?: {
      x: number;
      y: number;
      zoom: number;
    };
  };
  form_references: string[];
  version: number;
  created_at: string;
  updated_at: string;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  node_count: number;
  edge_count: number;
  updated_at: string;
}

// ============================================================================
// API Helper Functions
// ============================================================================

/**
 * Get tenant ID from localStorage
 * Required for multi-tenant isolation
 */
const getTenantId = (): string | null => {
  return localStorage.getItem('tenantId') || localStorage.getItem('currentTenantId');
};

// ============================================================================
// Save Workflow Functions
// ============================================================================

/**
 * Extract form references from workflow nodes
 * 
 * Scans nodes for tenantFormId references in:
 * - formStep nodes
 * - formReference nodes
 * - formMultiStepContainer nodes (legacy)
 * - formProcessGroup nodes (canonical)
 */
export const extractFormReferences = (nodes: Node[]): string[] => {
  const formIds = new Set<string>();

  for (const node of nodes) {
    const nodeData = node.data as any;

    // Form Step node (legacy)
    if (node.type === 'formStep' && nodeData.tenantFormId) {
      formIds.add(nodeData.tenantFormId);
    }

    // Form Reference node
    if (node.type === 'formReference' && nodeData.tenantFormId) {
      formIds.add(nodeData.tenantFormId);
    }

    // Form containers
    if (
      (
        node.type === 'formMultiStepContainer' ||
        node.type === 'formProcessGroup' ||
        node.type === 'formBook' ||
        node.type === 'smartWorkForm'
      ) &&
      nodeData.tenantFormId
    ) {
      formIds.add(nodeData.tenantFormId);
    }
  }

  return Array.from(formIds);
};

/**
 * Prepare workflow for saving
 * 
 * Ensures all container children have proper parent-child metadata
 */
export const prepareWorkflowForSave = (
  nodes: Node[],
  edges: Edge[],
  viewport?: { x: number; y: number; zoom: number }
): SaveWorkflowPayload['workflow_definition'] => {
  // Make deep copies to avoid mutating original state
  const nodesCopy = JSON.parse(JSON.stringify(nodes)) as Node[];
  const edgesCopy = JSON.parse(JSON.stringify(edges)) as Edge[];

  // Ensure parents appear before children for React Flow subflows.
  // This also prevents "disappearing" nodes when reloading persisted workflows.
  const sortedNodes = sortNodesTopologically(nodesCopy);
  
  // Ensure all nodes have proper parentId metadata (React Flow v11+)
  // (This is already set by React Flow, but we verify it's serialized)
  for (const node of sortedNodes) {
    if (node.parentId) {
      // Ensure extent is serialized
      if (!node.extent) {
        node.extent = 'parent';
      }
      
      // Ensure expandParent is set for child nodes
      if (node.expandParent === undefined) {
        node.expandParent = true;
      }
    }
  }
  
  return {
    nodes: sortedNodes,
    edges: edgesCopy,
    viewport: viewport || { x: 0, y: 0, zoom: 1 },
  };
};

/**
 * Save workflow to backend (create or update)
 * 
 * @param name - Workflow name
 * @param nodes - React Flow nodes array
 * @param edges - React Flow edges array
 * @param viewport - Current viewport position and zoom
 * @param existingWorkflowId - ID of existing workflow to update (undefined = create new)
 * @param description - Optional workflow description
 * @param status - Workflow status: draft | active | archived
 * @returns Promise with saved workflow data
 */
export const saveWorkflow = async (
  name: string,
  nodes: Node[],
  edges: Edge[],
  viewport?: { x: number; y: number; zoom: number },
  existingWorkflowId?: string,
  description?: string,
  status: 'draft' | 'active' | 'archived' = 'draft'
): Promise<LoadWorkflowResponse> => {
  try {
    logger.debug('💾 Saving workflow...', { name, nodes: nodes.length, edges: edges.length });
    
    // Validate tenant context
    const tenantId = getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context missing. Please select a tenant.');
    }
    
    const workflow_definition = prepareWorkflowForSave(nodes, edges, viewport);
    
    const payload: SaveWorkflowPayload = {
      name,
      description: description || '',
      status,
      workflow_definition,
    };
    
    let response;
    
    if (existingWorkflowId) {
      // Update existing workflow (PUT)
      response = await apiClient.put(
        `/tenant-workforms/${existingWorkflowId}/`,
        payload
      );
      logger.debug('✅ Workflow updated:', response.data);
    } else {
      // Create new workflow (POST)
      response = await apiClient.post(
        `/tenant-workforms/`,
        payload
      );
      logger.debug('✅ Workflow created:', response.data);
    }
    
    return response.data;
  } catch (error: any) {
    logger.error('❌ Error saving workflow:', {
      message: error?.message,
      status: error?.response?.status,
      url: error?.config?.url,
      method: error?.config?.method,
      data: error?.response?.data,
    });
    
    // Enhanced error handling with user-friendly messages
    if (error.response?.status === 401) {
      throw new Error('Please log in to save workflows.');
    }
    
    if (error.message?.includes('Tenant context missing')) {
      throw new Error('Please select a tenant to save workflows.');
    }
    
    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      switch (status) {
        case 403:
          throw new Error('Permission denied. You do not have access to save this workflow.');
        case 404:
          throw new Error('Workflow not found. It may have been deleted.');
        case 500:
          throw new Error('Server error. Please try again later.');
        default:
          throw new Error(`Save failed: ${data?.error || data?.detail || error.response.statusText}`);
      }
    } else if (error.request) {
      throw new Error('Network error: Unable to reach server. Please check your connection.');
    } else {
      throw new Error(`Save failed: ${error.message}`);
    }
  }
};

// ============================================================================
// Load Workflow Functions
// ============================================================================

/**
 * Reconstruct parent-child relationships after loading
 * 
 * React Flow v11+ requires nodes to have parentId property set correctly.
 * This ensures all container children are properly linked.
 */
export const reconstructParentChildRelationships = (nodes: Node[]): Node[] => {
  const reconstructed = JSON.parse(JSON.stringify(nodes));
  
  for (const node of reconstructed) {
    if (node.parentId) {
      // Ensure extent is set for constrained movement
      if (!node.extent) {
        node.extent = 'parent';
      }
      
      // Ensure expandParent is set
      if (node.expandParent === undefined) {
        node.expandParent = true;
      }
    }
  }
  
  return reconstructed;
};

/**
 * Load workflow from backend by ID
 * 
 * @param workflowId - UUID of the workflow to load
 * @returns Promise with workflow data including nodes and edges
 */
export const loadWorkflow = async (
  workflowId: string
): Promise<LoadWorkflowResponse> => {
  // Removed getApiBaseUrl - using apiClient
  
  try {
    const response = await apiClient.get(`/tenant-workforms/${workflowId}/`);
    
    logger.debug('✅ Workflow loaded:', response.data);
    
    // Reconstruct parent-child relationships
    if (response.data.workflow_definition?.nodes) {
      response.data.workflow_definition.nodes = reconstructParentChildRelationships(
        response.data.workflow_definition.nodes
      );
    }
    
    return response.data;
  } catch (error: any) {
    logger.error('❌ Error loading workflow:', error);
    
    if (error.response) {
      throw new Error(`Load failed: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Load failed: No response from server');
    } else {
      throw new Error(`Load failed: ${error.message}`);
    }
  }
};

/**
 * List all workflows for current tenant
 * 
 * @param filters - Optional filters (status, search)
 * @returns Promise with array of workflow list items
 */
export const listWorkflows = async (
  filters?: {
    status?: 'draft' | 'active' | 'archived';
    search?: string;
  }
): Promise<WorkflowListItem[]> => {
  // Removed getApiBaseUrl - using apiClient
  
  // Build query params
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.search) params.append('search', filters.search);
  
  const queryString = params.toString();
  const url = `/tenant-workforms/${queryString ? `?${queryString}` : ''}`;
  
  try {
    const response = await apiClient.get(url);
    
    // API returns paginated response: {count, next, previous, results: [...]}
    // Extract results array from pagination wrapper
    const workflows = response.data.results || response.data;
    
    logger.debug(`✅ Loaded ${workflows.length} workflows`);
    return workflows;
  } catch (error: any) {
    logger.error('❌ Error listing workflows:', error);
    
    if (error.response) {
      throw new Error(`List failed: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('List failed: No response from server');
    } else {
      throw new Error(`List failed: ${error.message}`);
    }
  }
};

/**
 * Delete workflow by ID
 * 
 * @param workflowId - UUID of the workflow to delete
 */
export const deleteWorkflow = async (workflowId: string): Promise<void> => {
  // Removed getApiBaseUrl - using apiClient
  
  try {
    await apiClient.delete(
      `/tenant-workforms/${workflowId}/`,
      
    );
    logger.debug('✅ Workflow deleted:', workflowId);
  } catch (error: any) {
    logger.error('❌ Error deleting workflow:', error);
    
    if (error.response) {
      throw new Error(`Delete failed: ${error.response.data?.error || error.response.statusText}`);
    } else if (error.request) {
      throw new Error('Delete failed: No response from server');
    } else {
      throw new Error(`Delete failed: ${error.message}`);
    }
  }
};

/**
 * Validate workflow for broken references
 * 
 * @param workflowId - UUID of the workflow to validate
 * @returns Validation result with any missing form references
 */
export const validateWorkflow = async (
  workflowId: string
): Promise<{
  valid: boolean;
  missing_forms: string[];
  total_references: number;
}> => {
  // Removed getApiBaseUrl - using apiClient
  
  try {
    const response = await apiClient.post(
      `/tenant-workforms/${workflowId}/validate/`,
      {},
      
    );
    
    logger.debug('✅ Workflow validation:', response.data);
    return response.data;
  } catch (error: any) {
    logger.error('❌ Error validating workflow:', error);
    throw error;
  }
};

// ============================================================================
// Container-Specific Functions
// ============================================================================

/**
 * Get all container nodes in a workflow
 * 
 * @param workflowId - UUID of the workflow
 * @returns Promise with array of container summaries
 */
export const listContainers = async (
  workflowId: string
): Promise<Array<{
  id: string;
  name: string;
  node_count: number;
  node_types: Record<string, number>;
  form_references: string[];
}>> => {
  // Removed getApiBaseUrl - using apiClient
  
  try {
    const response = await apiClient.get(
      `/tenant-workforms/${workflowId}/containers/`,
      
    );
    
    return response.data.containers || [];
  } catch (error: any) {
    logger.error('❌ Error listing containers:', error);
    throw error;
  }
};

/**
 * Get details of a specific container
 * 
 * @param workflowId - UUID of the workflow
 * @param containerId - ID of the container node
 * @returns Promise with container details including child nodes
 */
export const getContainerDetails = async (
  workflowId: string,
  containerId: string
): Promise<{
  container_id: string;
  container_name: string;
  total_nodes: number;
  node_types: Record<string, number>;
  form_references: string[];
  nodes: Node[];
}> => {
  // Removed getApiBaseUrl - using apiClient
  
  try {
    const response = await apiClient.get(
      `/tenant-workforms/${workflowId}/containers/${containerId}/`,
      
    );
    
    return response.data;
  } catch (error: any) {
    logger.error('❌ Error getting container details:', error);
    throw error;
  }
};

// ============================================================================
// Export All Functions
// ============================================================================

export default {
  // Save/Load
  saveWorkflow,
  loadWorkflow,
  listWorkflows,
  deleteWorkflow,
  validateWorkflow,
  
  // Container-specific
  listContainers,
  getContainerDetails,
  
  // Utilities
  extractFormReferences,
  prepareWorkflowForSave,
  reconstructParentChildRelationships,
};
