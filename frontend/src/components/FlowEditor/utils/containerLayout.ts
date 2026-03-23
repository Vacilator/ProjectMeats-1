/**
 * Container Layout Utilities
 * 
 * Phase 3: Auto-Layout Algorithm for Multi-Step Containers
 * 
 * This module handles automatic positioning of nodes within containers:
 * - Form steps arrange horizontally (left-to-right)
 * - Non-form nodes are NOT repositioned by container layout (prevents forcing actions inside the book)
 * - Maintains consistent spacing and alignment
 */

import { Node, Edge } from '@xyflow/react';
import { logger } from '@/utils/logger';


// ============================================================================
// Layout Constants (Phase 3.1)
// ============================================================================

export const LAYOUT_CONSTANTS = {
  // Step layout (FormProcess: vertical stack; others may still use horizontal)
  START_X: 50,
  STEP_SPACING: 350,
  STEP_Y: 80,

  // Fixed dimensions for Form Step nodes (keeps steps inside parent bounds)
  STEP_W: 320,
  STEP_H: 320,

  // Vertical layout for action nodes
  ACTION_OFFSET_Y: 180,
  ACTION_SPACING_Y: 120,

  // Container padding
  CONTAINER_PADDING_X: 20,
  CONTAINER_PADDING_Y: 20,

  // Virtual "+" add button (render-time, not persisted)
  ADD_BUTTON_D: 56,
  ADD_BUTTON_MARGIN_Y: 24,

  // Fallback node dimensions (for calculating container size)
  DEFAULT_NODE_WIDTH: 320,
  DEFAULT_NODE_HEIGHT: 320,
} as const;

// ============================================================================
// Type Definitions
// ============================================================================

export interface LayoutResult {
  nodes: Node[];           // Updated nodes with new positions
  containerWidth: number;  // Calculated required container width
  containerHeight: number; // Calculated required container height
}

export interface NodePosition {
  x: number;
  y: number;
}

// ============================================================================
// Phase 3.2: Auto-Layout Algorithm
// ============================================================================

/**
 * Calculate optimal layout for nodes within a container
 * 
 * @param containerId - ID of the container node
 * @param allNodes - All nodes in the editor
 * @param allEdges - All edges in the editor
 * @returns Updated nodes with new positions and calculated container dimensions
 */
export function calculateContainerLayout(
  containerId: string,
  allNodes: Node[],
  allEdges: Edge[]
): LayoutResult {
  logger.debug(`[Layout] Calculating layout for container ${containerId}`);

  const containerNode = allNodes.find((n) => n.id === containerId);
  const containerType = ((containerNode?.data as any)?.nodeType as string | undefined) || containerNode?.type;
  const enforceStrictPages = !!containerType &&
    (containerType === 'formProcessGroup' ||
      containerType === 'formProcess' ||
      containerType === 'formMultiStepContainer' ||
      containerType === 'formBook');

  // Filter child nodes (using parentId - React Flow v11+)
  const childNodes = allNodes.filter(node => node.parentId === containerId);
  
  if (childNodes.length === 0) {
    logger.debug(`[Layout] No child nodes found for container ${containerId}`);
    return {
      nodes: allNodes,
      containerWidth: 400,  // Default container size
      containerHeight: 300,
    };
  }
  
  // Separate nodes by type
  // Pages (form nodes) should be laid out in a horizontal row; other child nodes remain free-positioned.
  const isPageNodeType = (type?: string) =>
    type === 'form' || type === 'formReference' || type === 'formStepSingle' || type === 'formStep';

  const formSteps = childNodes.filter((node) => isPageNodeType(node.type));
  const otherNodes = childNodes.filter(
    (node) => !isPageNodeType(node.type) && node.type !== 'formMultiStepContainer' // Don't layout nested containers
  );
  
  logger.debug(`[Layout] Found \${formSteps.length} form steps, \${otherNodes.length} non-form child nodes`);
  
  const layoutDirection: 'vertical' | 'horizontal' = enforceStrictPages ? 'vertical' : 'horizontal';

  // Preserve rough order based on the axis that matters for the container
  formSteps.sort((a, b) => {
    const ax = layoutDirection === 'vertical' ? (a.position?.y || 0) : (a.position?.x || 0);
    const bx = layoutDirection === 'vertical' ? (b.position?.y || 0) : (b.position?.x || 0);
    return ax - bx;
  });

  // Update form steps with container layout
  const updatedFormSteps = formSteps.map((step, index) => {
    const newPosition: NodePosition =
      layoutDirection === 'vertical'
        ? {
            x: LAYOUT_CONSTANTS.START_X,
            y: LAYOUT_CONSTANTS.STEP_Y + index * LAYOUT_CONSTANTS.STEP_SPACING,
          }
        : {
            x: LAYOUT_CONSTANTS.START_X + index * LAYOUT_CONSTANTS.STEP_SPACING,
            y: LAYOUT_CONSTANTS.STEP_Y,
          };

    logger.debug(`[Layout] Form step \${step.id} positioned at (\${newPosition.x}, \${newPosition.y})`);

    return {
      ...step,
      position: newPosition,
      draggable: enforceStrictPages ? false : step.draggable,
      style: enforceStrictPages
        ? {
            ...(step.style || {}),
            width: LAYOUT_CONSTANTS.STEP_W,
            height: LAYOUT_CONSTANTS.STEP_H,
            overflow: 'hidden',
          }
        : step.style,
      data: {
        ...step.data,
        order: index,
      },
    };
  });
  
  // Book+Pages: only reposition form steps; leave other child nodes unchanged
  const updatedChildNodes = [...updatedFormSteps, ...otherNodes];
  
  const getNodeSize = (n: Node) => {
    const styleAny = (n.style || {}) as any;
    const width = styleAny.width ?? (n as any).width ?? LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH;
    const height = styleAny.height ?? (n as any).height ?? LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT;
    return { width: Number(width) || LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH, height: Number(height) || LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT };
  };

  // Calculate required container dimensions (respect explicit style widths/heights when present)
  const maxX = Math.max(
    ...updatedChildNodes.map((n) => n.position.x + getNodeSize(n).width),
    400 // Minimum width
  );
  const maxY = Math.max(
    ...updatedChildNodes.map((n) => n.position.y + getNodeSize(n).height),
    300 // Minimum height
  );

  const containerWidth = maxX + LAYOUT_CONSTANTS.CONTAINER_PADDING_X;
  const extraBottom = enforceStrictPages ? LAYOUT_CONSTANTS.ADD_BUTTON_D + LAYOUT_CONSTANTS.ADD_BUTTON_MARGIN_Y : 0;
  const containerHeight = maxY + LAYOUT_CONSTANTS.CONTAINER_PADDING_Y + extraBottom;
  
  logger.debug(`[Layout] Calculated container dimensions: \${containerWidth}x\${containerHeight}`);
  
  // Merge updated child nodes back into all nodes
  const updatedAllNodes = allNodes.map(node => {
    const updatedChild = updatedChildNodes.find(child => child.id === node.id);
    return updatedChild || node;
  });
  
  return {
    nodes: updatedAllNodes,
    containerWidth,
    containerHeight,
  };
}


/**
 * Check if a node should trigger auto-layout
 * (Only form steps and action nodes, not containers)
 */
export function shouldTriggerLayout(nodeType: string): boolean {
  return nodeType !== 'formMultiStepContainer';
}

// ============================================================================
// Phase 4: Auto-Connection Algorithm
// ============================================================================

export interface ConnectionResult {
  edges: Edge[];  // Updated edges array with auto-created connections
}

/**
 * Auto-connect sequential form steps horizontally
 * 
 * Creates edges: step1 → step2 → step3 (left-to-right)
 * Marks auto-created edges with data.auto = true
 * 
 * @param containerId - ID of the container node
 * @param allNodes - All nodes in the editor
 * @param allEdges - All edges in the editor
 * @returns Updated edges array with sequential connections
 */
export function autoConnectSequentialSteps(
  containerId: string,
  allNodes: Node[],
  allEdges: Edge[]
): ConnectionResult {
  logger.debug(`[AutoConnect] Creating sequential connections for container ${containerId}`);
  
  const containerNode = allNodes.find((n) => n.id === containerId);
  const containerType = ((containerNode?.data as any)?.nodeType as string | undefined) || containerNode?.type;
  const enforceStrictPages = !!containerType &&
    (containerType === 'formProcessGroup' ||
      containerType === 'formProcess' ||
      containerType === 'formMultiStepContainer' ||
      containerType === 'formBook');

  // Filter child nodes (using parentId - React Flow v11+)
  const childNodes = allNodes.filter((node) => node.parentId === containerId);

  // Get only form steps and sort by the container axis
  const isPageNodeType = (type?: string) =>
    type === 'form' || type === 'formReference' || type === 'formStepSingle' || type === 'formStep';

  const layoutDirection: 'vertical' | 'horizontal' = enforceStrictPages ? 'vertical' : 'horizontal';

  const formSteps = childNodes
    .filter((node) => isPageNodeType(node.type))
    .sort((a, b) =>
      layoutDirection === 'vertical'
        ? (a.position?.y || 0) - (b.position?.y || 0)
        : (a.position?.x || 0) - (b.position?.x || 0)
    );
  
  logger.debug(`[AutoConnect] Found ${formSteps.length} form steps to connect`);
  
  if (formSteps.length < 2) {
    logger.debug(`[AutoConnect] Not enough form steps to create connections`);
    return { edges: allEdges };
  }
  
  // Remove old auto-created edges for this container
  const nonAutoEdges = allEdges.filter(edge => {
    // Keep edge if it's NOT auto-created OR if it's not in this container
    if (!edge.data?.auto) return true;
    
    const sourceNode = allNodes.find(n => n.id === edge.source);
    const targetNode = allNodes.find(n => n.id === edge.target);
    
    // Keep if either node is not in this container (using parentId - React Flow v11+)
    return sourceNode?.parentId !== containerId || targetNode?.parentId !== containerId;
  });
  
  logger.debug(`[AutoConnect] Removed ${allEdges.length - nonAutoEdges.length} old auto-edges`);
  
  // Create sequential edges between form steps
  const newAutoEdges: Edge[] = [];
  
  for (let i = 0; i < formSteps.length - 1; i++) {
    const sourceStep = formSteps[i];
    const targetStep = formSteps[i + 1];
    
    const edgeId = `auto-${sourceStep.id}-${targetStep.id}`;
    
    // Check if manual edge already exists
    const manualEdgeExists = nonAutoEdges.some(
      edge => edge.source === sourceStep.id && edge.target === targetStep.id
    );
    
    if (manualEdgeExists) {
      logger.debug(`[AutoConnect] Skipping ${edgeId} - manual edge exists`);
      continue;
    }
    
    newAutoEdges.push({
      id: edgeId,
      source: sourceStep.id,
      target: targetStep.id,
      type: 'custom',
      data: { 
        auto: true,  // Mark as auto-created for future removal
        label: `Step ${i + 1} → ${i + 2}`,
      },
    });
    
    logger.debug(`[AutoConnect] Created edge: ${sourceStep.id} → ${targetStep.id}`);
  }
  
  logger.debug(`[AutoConnect] Created ${newAutoEdges.length} sequential edges`);
  
  return {
    edges: [...nonAutoEdges, ...newAutoEdges],
  };
}

/**
 * Check if a node type should trigger auto-connection
 * (Only form steps trigger auto-connection of sequential edges)
 */
export function shouldTriggerConnection(nodeType: string): boolean {
  return nodeType === 'formStep' || nodeType === 'formReference';
}
