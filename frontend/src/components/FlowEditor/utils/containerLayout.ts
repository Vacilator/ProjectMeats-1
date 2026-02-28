/**
 * Container Layout Utilities
 * 
 * Phase 3: Auto-Layout Algorithm for Multi-Step Containers
 * 
 * This module handles automatic positioning of nodes within containers:
 * - Form steps arrange horizontally (left-to-right)
 * - Action nodes stack vertically below connected form steps
 * - Maintains consistent spacing and alignment
 */

import { Node, Edge } from '@xyflow/react';
import { logger } from '@/utils/logger';


// ============================================================================
// Layout Constants (Phase 3.1)
// ============================================================================

export const LAYOUT_CONSTANTS = {
  // Horizontal layout for form steps
  START_X: 50,           // Starting x position for first form step
  STEP_SPACING: 250,     // Horizontal spacing between form steps
  STEP_Y: 80,            // Y position for form step row
  
  // Vertical layout for action nodes
  ACTION_OFFSET_Y: 180,  // Vertical offset below form step
  ACTION_SPACING_Y: 120, // Spacing between stacked actions
  
  // Container padding
  CONTAINER_PADDING_X: 20,
  CONTAINER_PADDING_Y: 20,
  
  // Node dimensions (for calculating container size)
  DEFAULT_NODE_WIDTH: 200,
  DEFAULT_NODE_HEIGHT: 100,
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
  const formSteps = childNodes.filter(node => node.type === 'formStep' || node.type === 'formReference');
  const actionNodes = childNodes.filter(node => 
    node.type !== 'formStep' && 
    node.type !== 'formReference' &&
    node.type !== 'formMultiStepContainer' // Don't layout nested containers
  );
  
  logger.debug(`[Layout] Found \${formSteps.length} form steps, \${actionNodes.length} action nodes`);
  
  // Sort form steps by current x-position to preserve rough order
  formSteps.sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0));
  
  // Update form steps with horizontal layout
  const updatedFormSteps = formSteps.map((step, index) => {
    const newPosition: NodePosition = {
      x: LAYOUT_CONSTANTS.START_X + (index * LAYOUT_CONSTANTS.STEP_SPACING),
      y: LAYOUT_CONSTANTS.STEP_Y,
    };
    
    logger.debug(`[Layout] Form step \${step.id} positioned at (\${newPosition.x}, \${newPosition.y})`);
    
    return {
      ...step,
      position: newPosition,
      data: {
        ...step.data,
        order: index, // Store order for future reordering
      },
    };
  });
  
  // Layout action nodes below their connected form steps
  const updatedActionNodes = actionNodes.map(action => {
    // Find which form step this action is connected to
    const connectedStep = findConnectedFormStep(action, updatedFormSteps, allEdges);
    
    if (connectedStep) {
      // Position below the connected form step
      const actionsAtThisStep = actionNodes.filter(a => 
        findConnectedFormStep(a, updatedFormSteps, allEdges)?.id === connectedStep.id
      );
      const actionIndex = actionsAtThisStep.indexOf(action);
      
      const newPosition: NodePosition = {
        x: connectedStep.position.x,
        y: connectedStep.position.y + LAYOUT_CONSTANTS.ACTION_OFFSET_Y + 
           (actionIndex * LAYOUT_CONSTANTS.ACTION_SPACING_Y),
      };
      
      logger.debug(`[Layout] Action \${action.id} positioned below step \${connectedStep.id} at (\${newPosition.x}, \${newPosition.y})`);
      
      return {
        ...action,
        position: newPosition,
      };
    } else {
      // No connected form step - position at the end
      const defaultX = LAYOUT_CONSTANTS.START_X + (formSteps.length * LAYOUT_CONSTANTS.STEP_SPACING);
      const newPosition: NodePosition = {
        x: defaultX,
        y: LAYOUT_CONSTANTS.STEP_Y,
      };
      
      logger.debug(`[Layout] Orphaned action \${action.id} positioned at end (\${newPosition.x}, \${newPosition.y})`);
      
      return {
        ...action,
        position: newPosition,
      };
    }
  });
  
  // Combine updated nodes
  const updatedChildNodes = [...updatedFormSteps, ...updatedActionNodes];
  
  // Calculate required container dimensions
  const maxX = Math.max(
    ...updatedChildNodes.map(n => n.position.x + LAYOUT_CONSTANTS.DEFAULT_NODE_WIDTH),
    400 // Minimum width
  );
  const maxY = Math.max(
    ...updatedChildNodes.map(n => n.position.y + LAYOUT_CONSTANTS.DEFAULT_NODE_HEIGHT),
    300 // Minimum height
  );
  
  const containerWidth = maxX + LAYOUT_CONSTANTS.CONTAINER_PADDING_X;
  const containerHeight = maxY + LAYOUT_CONSTANTS.CONTAINER_PADDING_Y;
  
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

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find the form step that an action node is connected to
 * 
 * @param actionNode - The action node to check
 * @param formSteps - Array of form step nodes
 * @param edges - All edges in the editor
 * @returns The connected form step node, or null if none found
 */
function findConnectedFormStep(
  actionNode: Node,
  formSteps: Node[],
  edges: Edge[]
): Node | null {
  // Check incoming edges (action is target)
  const incomingEdge = edges.find(edge => edge.target === actionNode.id);
  if (incomingEdge) {
    const sourceNode = formSteps.find(step => step.id === incomingEdge.source);
    if (sourceNode) {
      return sourceNode;
    }
  }
  
  // Check outgoing edges (action is source)
  const outgoingEdge = edges.find(edge => edge.source === actionNode.id);
  if (outgoingEdge) {
    const targetNode = formSteps.find(step => step.id === outgoingEdge.target);
    if (targetNode) {
      return targetNode;
    }
  }
  
  return null;
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
  
  // Filter child nodes (using parentId - React Flow v11+)
  const childNodes = allNodes.filter(node => node.parentId === containerId);
  
  // Get only form steps and sort by x-position (left-to-right)
  const formSteps = childNodes
    .filter(node => node.type === 'formStep' || node.type === 'formReference')
    .sort((a, b) => (a.position?.x || 0) - (b.position?.x || 0));
  
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
