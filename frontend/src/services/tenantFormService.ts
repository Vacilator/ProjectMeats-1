/**
 * TenantForm API Service
 * 
 * Handles persistence of FormProcessGroup nodes to TenantForm backend records.
 * Implements the FormProcessGroup ↔ TenantForm mapping logic.
 * 
 * Created: 2026-02-24
 * Phase: Agent B - Persistence
 */

import { Node, Edge } from '@xyflow/react';
import { logger } from '@/utils/logger';

import { adminClient } from './apiService';
import type { FormProcessGroupData } from '../components/FlowEditor/nodes/FormProcessGroupNode';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TenantForm {
  id?: string;
  tenant?: string;
  name: string;
  description?: string;
  type: 'single_step' | 'multi_step';
  form_definition: {
    steps?: FormStep[];
    navigation?: {
      show_progress: boolean;
      allow_back: boolean;
      allow_skip: boolean;
    };
  };
  version: number;
  usage_count?: number;
  source_node_id?: string;
  definition_hash?: string;
  is_template?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FormStep {
  name: string;
  description?: string;
  entity_type?: string;
  entity_action?: 'create' | 'update' | 'collect';
  fields: FormField[];
  validation_rules?: any[];
  order: number;
  node_id: string; // React Flow node ID
}

export interface FormField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  default_value?: string;
  validation?: any;
  conditional?: any;
  order: number;
}

export interface SaveFormResult {
  tenantFormId: string;
  version: number;
  created: boolean;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract child nodes from a FormProcessGroup.
 *
 * Note: xyflow uses `parentId` for grouping, but some older code paths still
 * write `parentNode`. We support both to avoid false "0 children" saves.
 */
function getChildNodes(groupNode: Node<FormProcessGroupData>, allNodes: Node[]): Node[] {
  const groupNodeId = groupNode.id;
  const pageOrder = Array.isArray(groupNode.data?.pageOrder) ? groupNode.data.pageOrder : null;

  const isChild = (node: Node): boolean => {
    const anyNode = node as any;
    const parent =
      anyNode.parentId ??
      anyNode.parentNode ??
      node.data?.parentId ??
      node.data?.parentNode ??
      node.data?.containerNodeId;

    return parent === groupNodeId;
  };

  const isFormStepLike = (type?: string) =>
    type === 'form' || type === 'formStepSingle' || type === 'formStep' || type === 'formReference';

  const children = allNodes.filter((node) => isChild(node) && isFormStepLike(node.type));

  // Prefer stable ordering if the container has an explicit pageOrder.
  if (pageOrder?.length) {
    const index = new Map(pageOrder.map((id, i) => [id, i]));
    return [...children].sort((a, b) => {
      const ai = index.has(a.id) ? (index.get(a.id) as number) : Number.MAX_SAFE_INTEGER;
      const bi = index.has(b.id) ? (index.get(b.id) as number) : Number.MAX_SAFE_INTEGER;
      if (ai !== bi) return ai - bi;
      return (a.position?.x || 0) - (b.position?.x || 0) || (a.position?.y || 0) - (b.position?.y || 0);
    });
  }

  // Default: horizontal ordering for the "Book + Pages" layout.
  return [...children].sort(
    (a, b) => (a.position?.x || 0) - (b.position?.x || 0) || (a.position?.y || 0) - (b.position?.y || 0)
  );
}

/**
 * Convert React Flow node to FormStep format
 */
function convertNodeToFormStep(node: Node, index: number): FormStep {
  const data = node.data;
  
  return {
    name: data.name || data.label || `Step ${index + 1}`,
    description: data.description || '',
    entity_type: data.entityType || data.entity_type,
    entity_action: data.entityAction || data.entity_action || 'create',
    fields: convertFieldsToFormFields(data.fields || []),
    validation_rules: data.validationRules || [],
    order: index,
    node_id: node.id
  };
}

/**
 * Convert React Flow field data to FormField format
 */
function convertFieldsToFormFields(fields: any[]): FormField[] {
  return fields.map((field, index) => ({
    name: field.name || field.fieldName || `field_${index}`,
    label: field.label || field.name || 'Unnamed Field',
    type: field.type || field.fieldType || 'text',
    required: field.required || false,
    placeholder: field.placeholder || '',
    helpText: field.helpText || field.help_text || '',
    default_value: field.defaultValue || field.default_value || '',
    validation: field.validation || {},
    conditional: field.conditional || {},
    order: field.order || index
  }));
}

/**
 * Generate hash for form definition (for deduplication)
 */
async function generateDefinitionHash(definition: any): Promise<string> {
  const jsonString = JSON.stringify(definition);
  const encoder = new TextEncoder();
  const data = encoder.encode(jsonString);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============================================================================
// Main API Functions
// ============================================================================

/**
 * Save FormProcessGroup node as TenantForm
 * 
 * @param groupNode - The FormProcessGroup node
 * @param allNodes - All nodes in the flow
 * @param allEdges - All edges in the flow
 * @returns SaveFormResult with tenantFormId and version
 */
export async function saveFormProcessGroup(
  groupNode: Node<FormProcessGroupData>,
  allNodes: Node[],
  allEdges: Edge[]
): Promise<SaveFormResult> {
  logger.debug('[TenantFormService] Saving FormProcessGroup:', groupNode.id);
  
  // Extract child nodes (form/page steps only)
  const childNodes = getChildNodes(groupNode, allNodes);

  if (childNodes.length === 0) {
    throw new Error('FormProcessGroup must have at least one child step');
  }
  
  // Convert child nodes to form steps
  const steps = childNodes.map((node, index) => convertNodeToFormStep(node, index));
  
  // Build form definition
  const formDefinition = {
    steps,
    navigation: {
      show_progress: groupNode.data.showProgressIndicator !== false,
      allow_back: groupNode.data.allowBackNavigation !== false,
      allow_skip: groupNode.data.allowSkipSteps || false
    }
  };
  
  // Generate hash for deduplication
  const definitionHash = await generateDefinitionHash(formDefinition);
  
  // Check if form already exists (by source_node_id)
  const existingFormId = groupNode.data.tenantFormId;
  
  const tenantFormData: Partial<TenantForm> = {
    name: groupNode.data.containerName || groupNode.data.label || 'Untitled Form Process',
    description: groupNode.data.containerDescription || '',
    type: 'multi_step',
    form_definition: formDefinition,
    source_node_id: groupNode.id,
    definition_hash: definitionHash,
    is_template: false
  };
  
  try {
    let response;
    
    if (existingFormId) {
      // Update existing form (increments version automatically)
      logger.debug('[TenantFormService] Updating existing form:', existingFormId);
      response = await adminClient.patch(`/core/tenant-forms/${existingFormId}/`, tenantFormData);
      
      return {
        tenantFormId: response.data.id,
        version: response.data.version,
        created: false
      };
    } else {
      // Create new form
      logger.debug('[TenantFormService] Creating new form');
      response = await adminClient.post('/core/tenant-forms/', tenantFormData);
      
      return {
        tenantFormId: response.data.id,
        version: response.data.version,
        created: true
      };
    }
  } catch (error: any) {
    logger.error('[TenantFormService] Save failed:', error);
    throw new Error(`Failed to save form: ${error.response?.data?.detail || error.message}`);
  }
}

/**
 * Load TenantForm and sync back to FormProcessGroup node
 * 
 * @param tenantFormId - UUID of the TenantForm
 * @returns TenantForm data
 */
export async function loadTenantForm(tenantFormId: string): Promise<TenantForm> {
  logger.debug('[TenantFormService] Loading TenantForm:', tenantFormId);
  
  try {
    const response = await adminClient.get(`/core/tenant-forms/${tenantFormId}/`);
    return response.data;
  } catch (error: any) {
    logger.error('[TenantFormService] Load failed:', error);
    throw new Error(`Failed to load form: ${error.response?.data?.detail || error.message}`);
  }
}

/**
 * Delete TenantForm
 * 
 * @param tenantFormId - UUID of the TenantForm
 */
export async function deleteTenantForm(tenantFormId: string): Promise<void> {
  logger.debug('[TenantFormService] Deleting TenantForm:', tenantFormId);
  
  try {
    await adminClient.delete(`/core/tenant-forms/${tenantFormId}/`);
  } catch (error: any) {
    logger.error('[TenantFormService] Delete failed:', error);
    throw new Error(`Failed to delete form: ${error.response?.data?.detail || error.message}`);
  }
}

/**
 * List all TenantForms for the current tenant
 * 
 * @returns Array of TenantForms
 */
export async function listTenantForms(): Promise<TenantForm[]> {
  logger.debug('[TenantFormService] Listing TenantForms');
  
  try {
    const response = await adminClient.get('/core/tenant-forms/');
    return response.data.results || response.data;
  } catch (error: any) {
    logger.error('[TenantFormService] List failed:', error);
    throw new Error(`Failed to list forms: ${error.response?.data?.detail || error.message}`);
  }
}

/**
 * Auto-repair edges when a child node is deleted from FormProcessGroup
 * Bridges the gap between before/after nodes
 * 
 * @param deletedNodeId - ID of the deleted node
 * @param groupNodeId - ID of the parent FormProcessGroup
 * @param allNodes - All nodes in the flow
 * @param allEdges - All edges in the flow
 * @returns Updated edges array
 */
export function autoRepairEdges(
  deletedNodeId: string,
  groupNodeId: string,
  allNodes: Node[],
  allEdges: Edge[]
): Edge[] {
  logger.debug('[TenantFormService] Auto-repairing edges after node deletion:', deletedNodeId);
  
  // Find edges connected to deleted node
  const incomingEdge = allEdges.find(edge => edge.target === deletedNodeId);
  const outgoingEdge = allEdges.find(edge => edge.source === deletedNodeId);
  
  // Remove edges connected to deleted node
  let updatedEdges = allEdges.filter(
    edge => edge.source !== deletedNodeId && edge.target !== deletedNodeId
  );
  
  // If both incoming and outgoing exist, bridge the gap
  if (incomingEdge && outgoingEdge) {
    const bridgeEdge: Edge = {
      id: `${incomingEdge.source}-to-${outgoingEdge.target}`,
      source: incomingEdge.source,
      target: outgoingEdge.target,
      type: 'smoothstep',
      animated: true,
      style: {
        stroke: 'rgba(139, 92, 246, 0.6)',
        strokeWidth: 2,
      }
    };
    
    updatedEdges.push(bridgeEdge);
    logger.debug('[TenantFormService] Bridged gap with new edge:', bridgeEdge.id);
  }
  
  // Renumber remaining child nodes
  const remainingChildren = getChildNodes(groupNodeId, allNodes)
    .filter(node => node.id !== deletedNodeId);
  
  logger.debug(`[TenantFormService] ${remainingChildren.length} child nodes remaining`);
  
  return updatedEdges;
}
