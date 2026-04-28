import type { Edge, Node } from '@xyflow/react';

import { sanitizeNodeDataForPersistence } from './nodeDataSanitization';

export interface FlowHistoryState {
  nodes: Node[];
  edges: Edge[];
  signature: string;
}

function sanitizeForClone(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(sanitizeForClone);

  const out: Record<string, unknown> = {};
  for (const [key, nextValue] of Object.entries(value as Record<string, unknown>)) {
    if (typeof nextValue === 'function') continue;
    out[key] = sanitizeForClone(nextValue);
  }
  return out;
}

export function buildFlowHistoryState(nodes: Node[], edges: Edge[]): FlowHistoryState {
  const sanitizedNodes = nodes.map((node) => ({
    ...node,
    data: sanitizeForClone(sanitizeNodeDataForPersistence(node.data)) as Node['data'],
  }));
  const sanitizedEdges = edges.map((edge) => sanitizeForClone({ ...edge }) as Edge);
  const signature = JSON.stringify({
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
  });

  return {
    nodes: sanitizedNodes,
    edges: sanitizedEdges,
    signature,
  };
}

export interface AutoSaveEligibilityArgs {
  currentWorkflowId?: string;
  currentWorkflowStatus: 'draft' | 'active' | 'archived';
  hasUnsavedChanges: boolean;
  readOnly: boolean;
  isSaving: boolean;
  validationErrorCount: number;
}

export function shouldAutoSaveWorkflow({
  currentWorkflowId,
  currentWorkflowStatus,
  hasUnsavedChanges,
  readOnly,
  isSaving,
  validationErrorCount,
}: AutoSaveEligibilityArgs): boolean {
  return Boolean(
    currentWorkflowId &&
      currentWorkflowStatus === 'draft' &&
      hasUnsavedChanges &&
      !readOnly &&
      !isSaving &&
      validationErrorCount === 0,
  );
}
