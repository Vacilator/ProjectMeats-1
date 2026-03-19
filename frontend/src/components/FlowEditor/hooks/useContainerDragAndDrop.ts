/**
 * Container Drag-and-Drop Hook
 * 
 * Provides magnetic snapping, collision detection, and visual feedback
 * for dragging nodes into containers.
 * 
 * Phase 7.2: Enhanced Container Management (Part 2/3)
 */

import { useCallback, useState, useEffect } from 'react';
import { Node, useReactFlow, XYPosition } from '@xyflow/react';
import {
  isNodeInsideContainer,
  getContainerSnapPoints,
} from '../utils/containerStyling';
import { snapToGrid } from '../utils/grid';

export interface DragState {
  /** Node being dragged (null if none) */
  draggingNodeId: string | null;
  /** Container that is valid drop target (null if none) */
  dropTargetId: string | null;
  /** Snap preview position (null if no snapping) */
  snapPreview: XYPosition | null;
}

export interface ContainerDropResult {
  /** Whether the drop was successful */
  success: boolean;
  /** ID of container where node was dropped */
  containerId: string | null;
  /** Final position of dropped node */
  position: XYPosition | null;
}

/**
 * Hook for enhanced container drag-and-drop with magnetic snapping
 * 
 * Features:
 * - Real-time collision detection
 * - Magnetic snapping to container centerlines
 * - Visual feedback (drop target highlighting)
 * - Snap preview indicators
 * - Automatic parent assignment
 * 
 * @param containerNodeTypes - Array of node types that are containers (default: ['formProcessGroup'])
 * @param snapThreshold - Distance in pixels for magnetic snap (default: 30)
 * @param gridSize - Grid size for snapping (default: 20)
 * @returns Drag state and handler functions
 */
export function useContainerDragAndDrop(
  containerNodeTypes: string[] = ['formBook', 'formProcessGroup'],
  snapThreshold: number = 30,
  gridSize: number = 20
) {
  const { getNodes, setNodes, getNode } = useReactFlow();
  
  const [dragState, setDragState] = useState<DragState>({
    draggingNodeId: null,
    dropTargetId: null,
    snapPreview: null,
  });

  /**
   * Check if a node is a container
   */
  const isContainer = useCallback(
    (node: Node): boolean => {
      return containerNodeTypes.includes(node.type || '');
    },
    [containerNodeTypes]
  );

  /**
   * Find container at given position
   */
  const findContainerAtPosition = useCallback(
    (position: XYPosition, excludeNodeId?: string): Node | null => {
      const nodes = getNodes();
      
      // Find containers that the position is inside
      const candidates = nodes.filter(node => {
        if (!isContainer(node)) return false;
        if (node.id === excludeNodeId) return false;
        
        const nodeWidth = node.width || 280;
        const nodeHeight = node.height || 400;
        
        return isNodeInsideContainer(
          position,
          { width: 1, height: 1 }, // Point check
          node.position,
          { width: nodeWidth, height: nodeHeight },
          0 // No threshold for point check
        );
      });

      // Return topmost container (highest z-index)
      if (candidates.length === 0) return null;
      return candidates[candidates.length - 1];
    },
    [getNodes, isContainer]
  );

  /**
   * Calculate snap position for node in container
   */
  const calculateSnapPosition = useCallback(
    (
      nodePosition: XYPosition,
      nodeSize: { width: number; height: number },
      containerId: string
    ): XYPosition | null => {
      const containerNode = getNode(containerId);
      if (!containerNode) return null;

      const containerWidth = containerNode.width || 280;
      const containerHeight = containerNode.height || 400;

      // Get snap points along container centerline
      const snapPoints = getContainerSnapPoints(
        containerNode.position,
        { width: containerWidth, height: containerHeight },
        gridSize
      );

      // Find nearest snap point
      const nodeCenterY = nodePosition.y + nodeSize.height / 2;
      let nearestPoint: XYPosition | null = null;
      let minDistance = Infinity;

      snapPoints.forEach(point => {
        const distance = Math.abs(point.y - nodeCenterY);
        if (distance < minDistance && distance < snapThreshold) {
          minDistance = distance;
          nearestPoint = point;
        }
      });

      if (!nearestPoint) {
        // No snap point close enough, just center horizontally
        const centerX = containerNode.position.x + containerWidth / 2;
        return {
          x: centerX - nodeSize.width / 2,
          y: nodePosition.y,
        };
      }

      // Snap to nearest point
      const centerX = containerNode.position.x + containerWidth / 2;
      return {
        x: centerX - nodeSize.width / 2,
        y: nearestPoint.y - nodeSize.height / 2,
      };
    },
    [getNode, gridSize, snapThreshold]
  );

  /**
   * Handle node drag start
   */
  const onNodeDragStart = useCallback(
    (event: React.MouseEvent, node: Node) => {
      // Don't track container nodes being dragged
      if (isContainer(node)) return;

      setDragState({
        draggingNodeId: node.id,
        dropTargetId: null,
        snapPreview: null,
      });
    },
    [isContainer]
  );

  /**
   * Handle node drag (updates drop target and snap preview)
   */
  const onNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (!dragState.draggingNodeId || dragState.draggingNodeId !== node.id) {
        return;
      }

      const nodeWidth = node.width || 200;
      const nodeHeight = node.height || 100;

      // Find container at current position
      const container = findContainerAtPosition(
        {
          x: node.position.x + nodeWidth / 2,
          y: node.position.y + nodeHeight / 2,
        },
        node.id
      );

      if (container) {
        // Calculate snap position
        const snapPos = calculateSnapPosition(
          node.position,
          { width: nodeWidth, height: nodeHeight },
          container.id
        );

        setDragState({
          draggingNodeId: node.id,
          dropTargetId: container.id,
          snapPreview: snapPos,
        });
      } else {
        // No container, clear drop target
        setDragState({
          draggingNodeId: node.id,
          dropTargetId: null,
          snapPreview: null,
        });
      }
    },
    [dragState.draggingNodeId, findContainerAtPosition, calculateSnapPosition]
  );

  /**
   * Handle node drag end (perform the drop)
   */
  const onNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node): ContainerDropResult => {
      const result: ContainerDropResult = {
        success: false,
        containerId: null,
        position: null,
      };

      if (!dragState.draggingNodeId || dragState.draggingNodeId !== node.id) {
        setDragState({
          draggingNodeId: null,
          dropTargetId: null,
          snapPreview: null,
        });
        return result;
      }

      const { dropTargetId, snapPreview } = dragState;

      if (dropTargetId && snapPreview) {
        // Perform the drop
        setNodes(nodes =>
          nodes.map(n => {
            if (n.id === node.id) {
              return {
                ...n,
                position: snapPreview,
                parentId: dropTargetId,
                extent: 'parent' as const,
              };
            }
            return n;
          })
        );

        result.success = true;
        result.containerId = dropTargetId;
        result.position = snapPreview;
      }

      // Clear drag state
      setDragState({
        draggingNodeId: null,
        dropTargetId: null,
        snapPreview: null,
      });

      return result;
    },
    [dragState, setNodes]
  );

  /**
   * Update container isDropTarget flag based on drag state
   */
  useEffect(() => {
    if (!dragState.draggingNodeId) return;

    setNodes(nodes =>
      nodes.map(node => {
        if (!isContainer(node)) return node;

        const isDropTarget = node.id === dragState.dropTargetId;
        if (node.data.isDropTarget !== isDropTarget) {
          return {
            ...node,
            data: {
              ...node.data,
              isDropTarget,
            },
          };
        }
        return node;
      })
    );
  }, [dragState.draggingNodeId, dragState.dropTargetId, isContainer, setNodes]);

  return {
    dragState,
    onNodeDragStart,
    onNodeDrag,
    onNodeDragStop,
    isContainer,
    findContainerAtPosition,
  };
}
