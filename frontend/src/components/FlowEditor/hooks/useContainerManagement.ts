/**
 * Container Management Hook
 * Phase 7.2: Container Nesting Management
 * 
 * Manages container nodes and their child relationships:
 * - Create containers from selection
 * - Add/remove nodes from containers
 * - Ungroup containers
 * - Nest containers (parent/child hierarchy)
 * - Auto-resize containers to fit children
 * - Maintain spatial relationships
 * 
 * Created: 2026-02-27
 */

import { useCallback } from 'react';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { v4 as uuidv4 } from 'uuid';
import { ContainerNodeData } from '../nodes/ContainerNode';

// ============================================================================
// Types
// ============================================================================

interface CreateContainerOptions {
  /** Custom label for the container */
  label?: string;
  /** Optional description */
  description?: string;
  /** Background color */
  backgroundColor?: string;
  /** Border color */
  borderColor?: string;
  /** Padding around children nodes */
  padding?: number;
}

interface ContainerManagementResult {
  /** Create a container from currently selected nodes */
  createContainerFromSelection: (options?: CreateContainerOptions) => Node | null;
  /** Add nodes to an existing container */
  addNodesToContainer: (containerNodeId: string, nodeIds: string[]) => void;
  /** Remove nodes from a container */
  removeNodesFromContainer: (containerNodeId: string, nodeIds: string[]) => void;
  /** Ungroup a container (delete container, keep children) */
  ungroupContainer: (containerNodeId: string) => void;
  /** Get all nodes inside a container */
  getContainerChildren: (containerNodeId: string) => Node[];
  /** Check if a node is a container */
  isContainer: (node: Node) => boolean;
  /** Update container to fit its children */
  fitContainerToChildren: (containerNodeId: string) => void;
}

// ============================================================================
// Constants
// ============================================================================

const CONTAINER_PADDING = 30; // Default padding around children
const MIN_CONTAINER_WIDTH = 400;
const MIN_CONTAINER_HEIGHT = 300;

// ============================================================================
// Hook Implementation
// ============================================================================

/**
 * Hook for managing container nodes and their children.
 * Provides functions to create, modify, and organize containers.
 * 
 * @example
 * ```tsx
 * const {
 *   createContainerFromSelection,
 *   addNodesToContainer,
 *   ungroupContainer
 * } = useContainerManagement();
 * 
 * // Group selected nodes
 * const container = createContainerFromSelection({
 *   label: 'Login Flow',
 *   backgroundColor: 'rgba(103, 126, 234, 0.05)'
 * });
 * ```
 */
export function useContainerManagement(): ContainerManagementResult {
  const { getNodes, setNodes, getEdges } = useReactFlow();

  /**
   * Check if a node is a container type
   */
  const isContainer = useCallback((node: Node): boolean => {
    return node.type === 'container';
  }, []);

  /**
   * Get all nodes that are children of a container
   */
  const getContainerChildren = useCallback(
    (containerNodeId: string): Node[] => {
      const nodes = getNodes();
      const containerNode = nodes.find((n) => n.id === containerNodeId);

      if (!containerNode || !isContainer(containerNode)) {
        return [];
      }

      const containerData = containerNode.data as ContainerNodeData;
      const childNodeIds = containerData.childNodeIds || [];

      return nodes.filter((node) => childNodeIds.includes(node.id));
    },
    [getNodes, isContainer]
  );

  /**
   * Calculate bounding box of selected nodes
   */
  const calculateBoundingBox = useCallback((nodes: Node[]) => {
    if (nodes.length === 0) {
      return { x: 0, y: 0, width: MIN_CONTAINER_WIDTH, height: MIN_CONTAINER_HEIGHT };
    }

    const positions = nodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      // Estimate node width/height (default 200x100 if not specified)
      width: (n.width as number) || 200,
      height: (n.height as number) || 100,
    }));

    const minX = Math.min(...positions.map((p) => p.x));
    const minY = Math.min(...positions.map((p) => p.y));
    const maxX = Math.max(...positions.map((p) => p.x + p.width));
    const maxY = Math.max(...positions.map((p) => p.y + p.height));

    return {
      x: minX,
      y: minY,
      width: Math.max(maxX - minX, MIN_CONTAINER_WIDTH),
      height: Math.max(maxY - minY, MIN_CONTAINER_HEIGHT),
    };
  }, []);

  /**
   * Create a container from currently selected nodes
   */
  const createContainerFromSelection = useCallback(
    (options: CreateContainerOptions = {}): Node | null => {
      const {
        label = 'Container',
        description,
        backgroundColor,
        borderColor,
        padding = CONTAINER_PADDING,
      } = options;

      const nodes = getNodes();
      const selectedNodes = nodes.filter((node) => node.selected && !isContainer(node));

      if (selectedNodes.length === 0) {
        return null;
      }

      // Calculate bounding box
      const bbox = calculateBoundingBox(selectedNodes);

      // Create container node
      const containerId = uuidv4();
      const containerNode: Node<ContainerNodeData> = {
        id: containerId,
        type: 'container',
        position: { x: bbox.x - padding, y: bbox.y - padding },
        data: {
          label,
          description,
          backgroundColor,
          borderColor,
          childNodeIds: selectedNodes.map((n) => n.id),
          autoResize: true,
          minWidth: bbox.width + padding * 2,
          minHeight: bbox.height + padding * 2,
        },
        // Container dimensions
        width: bbox.width + padding * 2,
        height: bbox.height + padding * 2,
        // Make draggable but not selectable (select children instead)
        draggable: true,
        selectable: true,
      };

      // Update child nodes to be relative to container
      const updatedNodes = nodes.map((node) => {
        if (selectedNodes.find((n) => n.id === node.id)) {
          return {
            ...node,
            selected: false,
            // Make positions relative to container
            position: {
              x: node.position.x - containerNode.position.x,
              y: node.position.y - containerNode.position.y,
            },
            // Set parent reference
            parentId: containerId,
            extent: 'parent' as const,
          };
        }
        return node;
      });

      // Add container node
      setNodes(() => [...updatedNodes, containerNode]);

      return containerNode;
    },
    [getNodes, setNodes, isContainer, calculateBoundingBox]
  );

  /**
   * Add nodes to an existing container
   */
  const addNodesToContainer = useCallback(
    (containerNodeId: string, nodeIds: string[]) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          // Update container data
          if (node.id === containerNodeId && isContainer(node)) {
            const containerData = node.data as ContainerNodeData;
            const existingChildren = containerData.childNodeIds || [];
            const newChildren = Array.from(
              new Set([...existingChildren, ...nodeIds])
            );

            return {
              ...node,
              data: {
                ...containerData,
                childNodeIds: newChildren,
              },
            };
          }

          // Update child nodes
          if (nodeIds.includes(node.id)) {
            const containerNode = nodes.find((n) => n.id === containerNodeId);
            if (!containerNode) return node;

            return {
              ...node,
              parentId: containerNodeId,
              extent: 'parent' as const,
              position: {
                x: node.position.x - containerNode.position.x,
                y: node.position.y - containerNode.position.y,
              },
            };
          }

          return node;
        })
      );
    },
    [setNodes, isContainer]
  );

  /**
   * Remove nodes from a container
   */
  const removeNodesFromContainer = useCallback(
    (containerNodeId: string, nodeIds: string[]) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          // Update container data
          if (node.id === containerNodeId && isContainer(node)) {
            const containerData = node.data as ContainerNodeData;
            const existingChildren = containerData.childNodeIds || [];
            const newChildren = existingChildren.filter(
              (id) => !nodeIds.includes(id)
            );

            return {
              ...node,
              data: {
                ...containerData,
                childNodeIds: newChildren,
              },
            };
          }

          // Update child nodes (make absolute again)
          if (nodeIds.includes(node.id) && node.parentId === containerNodeId) {
            const containerNode = nodes.find((n) => n.id === containerNodeId);
            if (!containerNode) return node;

            return {
              ...node,
              parentId: undefined,
              extent: undefined,
              position: {
                x: node.position.x + containerNode.position.x,
                y: node.position.y + containerNode.position.y,
              },
            };
          }

          return node;
        })
      );
    },
    [setNodes, isContainer]
  );

  /**
   * Ungroup a container (delete container, restore children to canvas)
   */
  const ungroupContainer = useCallback(
    (containerNodeId: string) => {
      setNodes((nodes) => {
        const containerNode = nodes.find((n) => n.id === containerNodeId);
        if (!containerNode || !isContainer(containerNode)) {
          return nodes;
        }

        // Remove container and update children
        return nodes
          .filter((node) => node.id !== containerNodeId)
          .map((node) => {
            if (node.parentId === containerNodeId) {
              return {
                ...node,
                parentId: undefined,
                extent: undefined,
                position: {
                  x: node.position.x + containerNode.position.x,
                  y: node.position.y + containerNode.position.y,
                },
              };
            }
            return node;
          });
      });
    },
    [setNodes, isContainer]
  );

  /**
   * Update container size to fit all its children
   */
  const fitContainerToChildren = useCallback(
    (containerNodeId: string) => {
      setNodes((nodes) => {
        const containerNode = nodes.find((n) => n.id === containerNodeId);
        if (!containerNode || !isContainer(containerNode)) {
          return nodes;
        }

        const children = nodes.filter((n) => n.parentId === containerNodeId);
        if (children.length === 0) {
          return nodes;
        }

        const bbox = calculateBoundingBox(children);
        const padding = CONTAINER_PADDING;

        return nodes.map((node) => {
          if (node.id === containerNodeId) {
            return {
              ...node,
              width: bbox.width + padding * 2,
              height: bbox.height + padding * 2,
              data: {
                ...node.data,
                minWidth: bbox.width + padding * 2,
                minHeight: bbox.height + padding * 2,
              },
            };
          }
          return node;
        });
      });
    },
    [setNodes, isContainer, calculateBoundingBox]
  );

  return {
    createContainerFromSelection,
    addNodesToContainer,
    removeNodesFromContainer,
    ungroupContainer,
    getContainerChildren,
    isContainer,
    fitContainerToChildren,
  };
}
