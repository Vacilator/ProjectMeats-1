/**
 * @fileoverview Keyboard navigation utilities for workflow editor
 * @module FlowEditor/utils/keyboardNavigation
 *
 * Implements WCAG 2.1 AAA-compliant keyboard navigation:
 * - Arrow keys for node traversal
 * - Tab/Shift+Tab for focus management
 * - Enter/Space for activation
 * - Escape for dismissal
 * - Home/End for first/last node
 *
 * @see Phase 7.6: Accessibility & i18n
 */

import type { Node, Edge } from '@xyflow/react';

/**
 * Keyboard event handler result
 */
export interface KeyboardNavigationResult {
  /**
   * ID of node that should receive focus
   */
  focusNodeId: string | null;

  /**
   * Whether event was handled (preventDefault should be called)
   */
  handled: boolean;

  /**
   * Action to perform ('select' | 'activate' | 'dismiss' | null)
   */
  action: 'select' | 'activate' | 'dismiss' | null;
}

/**
 * Direction for arrow key navigation
 */
export type NavigationDirection = 'up' | 'down' | 'left' | 'right';

/**
 * Configuration for keyboard navigation behavior
 */
export interface KeyboardNavigationConfig {
  /**
   * Whether to wrap around at edges (first ↔ last)
   * @default true
   */
  wrapAround?: boolean;

  /**
   * Whether to follow edges for directional navigation
   * If false, uses spatial proximity instead
   * @default true
   */
  followEdges?: boolean;

  /**
   * Whether to enable vim-style hjkl keys
   * @default false
   */
  vimBindings?: boolean;
}

/**
 * Find the closest node in a given direction
 *
 * Uses spatial proximity when followEdges is false.
 * Prioritizes nodes that are roughly in the direction indicated.
 *
 * @param currentNode - Currently focused node
 * @param direction - Direction to search
 * @param allNodes - All nodes in workflow
 * @returns Closest node in that direction, or null
 */
function findClosestNodeInDirection(
  currentNode: Node,
  direction: NavigationDirection,
  allNodes: Node[]
): Node | null {
  const currentX = currentNode.position.x;
  const currentY = currentNode.position.y;

  // Filter candidates based on direction
  const candidates = allNodes.filter((node) => {
    if (node.id === currentNode.id) return false;

    const dx = node.position.x - currentX;
    const dy = node.position.y - currentY;

    // Check if node is roughly in the target direction
    switch (direction) {
      case 'up':
        return dy < -50; // Above current (negative Y)
      case 'down':
        return dy > 50; // Below current (positive Y)
      case 'left':
        return dx < -50; // Left of current (negative X)
      case 'right':
        return dx > 50; // Right of current (positive X)
    }
  });

  if (candidates.length === 0) return null;

  // Find closest candidate
  const distances = candidates.map((node) => {
    const dx = node.position.x - currentX;
    const dy = node.position.y - currentY;

    // Weight distance more heavily in the primary axis
    let weight;
    switch (direction) {
      case 'up':
      case 'down':
        weight = Math.abs(dy) + Math.abs(dx) * 0.3;
        break;
      case 'left':
      case 'right':
        weight = Math.abs(dx) + Math.abs(dy) * 0.3;
        break;
    }

    return { node, distance: weight };
  });

  distances.sort((a, b) => a.distance - b.distance);
  return distances[0].node;
}

/**
 * Find connected node via edges
 *
 * Follows actual workflow connections when navigating.
 * For right/down: follows outgoing edges (targets)
 * For left/up: follows incoming edges (sources)
 *
 * @param currentNode - Currently focused node
 * @param direction - Direction to search
 * @param allNodes - All nodes in workflow
 * @param edges - All edges in workflow
 * @returns Connected node in that direction, or null
 */
function findConnectedNode(
  currentNode: Node,
  direction: NavigationDirection,
  allNodes: Node[],
  edges: Edge[]
): Node | null {
  const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

  // Determine if we should follow outgoing or incoming edges
  const isForward = direction === 'right' || direction === 'down';

  const connectedEdges = edges.filter((edge) =>
    isForward
      ? edge.source === currentNode.id
      : edge.target === currentNode.id
  );

  if (connectedEdges.length === 0) {
    // No connected edges, fall back to spatial proximity
    return findClosestNodeInDirection(currentNode, direction, allNodes);
  }

  // Get all connected node IDs
  const connectedNodeIds = connectedEdges.map((edge) =>
    isForward ? edge.target : edge.source
  );

  // Get actual node objects
  const connectedNodes = connectedNodeIds
    .map((id) => nodeMap.get(id))
    .filter((node): node is Node => node !== undefined);

  if (connectedNodes.length === 0) return null;

  // If multiple connections, find closest in the primary axis
  if (connectedNodes.length === 1) {
    return connectedNodes[0];
  }

  // Multiple connections: choose based on position
  return findClosestNodeInDirection(currentNode, direction, connectedNodes);
}

/**
 * Handle keyboard navigation event
 *
 * Implements comprehensive keyboard navigation for workflow editor.
 * Supports arrow keys, Home/End, Enter/Space, Escape, and optional vim bindings.
 *
 * @example
 * ```typescript
 * const handleKeyDown = (event: React.KeyboardEvent) => {
 *   const result = handleKeyboardNavigation(
 *     event.nativeEvent,
 *     selectedNodeId,
 *     nodes,
 *     edges,
 *     { followEdges: true, vimBindings: false }
 *   );
 *
 *   if (result.handled) {
 *     event.preventDefault();
 *
 *     if (result.focusNodeId) {
 *       setSelectedNodeId(result.focusNodeId);
 *       // Focus DOM element for screen readers
 *       document.getElementById(result.focusNodeId)?.focus();
 *     }
 *
 *     if (result.action === 'activate') {
 *       openNodeConfig(selectedNodeId);
 *     }
 *   }
 * };
 * ```
 *
 * @param event - Keyboard event
 * @param currentNodeId - ID of currently focused node
 * @param nodes - All nodes in workflow
 * @param edges - All edges in workflow
 * @param config - Navigation configuration
 * @returns Navigation result with focus target and action
 */
export function handleKeyboardNavigation(
  event: KeyboardEvent,
  currentNodeId: string | null,
  nodes: Node[],
  edges: Edge[],
  config: KeyboardNavigationConfig = {}
): KeyboardNavigationResult {
  const {
    wrapAround = true,
    followEdges = true,
    vimBindings = false,
  } = config;

  const currentNode = currentNodeId
    ? nodes.find((n) => n.id === currentNodeId)
    : null;

  // Default result (no action)
  const noAction: KeyboardNavigationResult = {
    focusNodeId: null,
    handled: false,
    action: null,
  };

  // No nodes or not focused on a node
  if (nodes.length === 0) return noAction;

  // Get key pressed
  const key = event.key.toLowerCase();
  const isShift = event.shiftKey;
  const isCtrl = event.ctrlKey || event.metaKey;

  // Home key: Jump to first node
  if (key === 'home') {
    return {
      focusNodeId: nodes[0].id,
      handled: true,
      action: 'select',
    };
  }

  // End key: Jump to last node
  if (key === 'end') {
    return {
      focusNodeId: nodes[nodes.length - 1].id,
      handled: true,
      action: 'select',
    };
  }

  // Escape: Clear selection/dismiss
  if (key === 'escape') {
    return {
      focusNodeId: null,
      handled: true,
      action: 'dismiss',
    };
  }

  // No current node selected - use first node for Enter/Space
  if (!currentNode) {
    if (key === 'enter' || key === ' ') {
      return {
        focusNodeId: nodes[0].id,
        handled: true,
        action: 'select',
      };
    }
    return noAction;
  }

  // Enter: Activate node (open config)
  if (key === 'enter' && !isShift && !isCtrl) {
    return {
      focusNodeId: currentNodeId,
      handled: true,
      action: 'activate',
    };
  }

  // Space: Toggle selection
  if (key === ' ') {
    return {
      focusNodeId: currentNodeId,
      handled: true,
      action: 'select',
    };
  }

  // Tab: Next node (Shift+Tab: Previous node)
  if (key === 'tab') {
    const currentIndex = nodes.findIndex((n) => n.id === currentNodeId);
    let nextIndex;

    if (isShift) {
      // Previous node
      nextIndex = currentIndex - 1;
      if (nextIndex < 0) {
        nextIndex = wrapAround ? nodes.length - 1 : 0;
      }
    } else {
      // Next node
      nextIndex = currentIndex + 1;
      if (nextIndex >= nodes.length) {
        nextIndex = wrapAround ? 0 : nodes.length - 1;
      }
    }

    return {
      focusNodeId: nodes[nextIndex].id,
      handled: true,
      action: 'select',
    };
  }

  // Arrow keys (+ optional vim bindings)
  let direction: NavigationDirection | null = null;

  if (key === 'arrowup' || (vimBindings && key === 'k')) {
    direction = 'up';
  } else if (key === 'arrowdown' || (vimBindings && key === 'j')) {
    direction = 'down';
  } else if (key === 'arrowleft' || (vimBindings && key === 'h')) {
    direction = 'left';
  } else if (key === 'arrowright' || (vimBindings && key === 'l')) {
    direction = 'right';
  }

  if (!direction) return noAction;

  // Find next node in direction
  const nextNode = followEdges
    ? findConnectedNode(currentNode, direction, nodes, edges)
    : findClosestNodeInDirection(currentNode, direction, nodes);

  if (!nextNode) {
    // No node found - wrap around to opposite edge?
    if (wrapAround) {
      // Find furthest node in opposite direction
      const oppositeDirection: NavigationDirection =
        direction === 'up' ? 'down' :
        direction === 'down' ? 'up' :
        direction === 'left' ? 'right' : 'left';

      const furthestNode = findClosestNodeInDirection(
        currentNode,
        oppositeDirection,
        nodes
      );

      if (furthestNode) {
        return {
          focusNodeId: furthestNode.id,
          handled: true,
          action: 'select',
        };
      }
    }

    return noAction;
  }

  return {
    focusNodeId: nextNode.id,
    handled: true,
    action: 'select',
  };
}

/**
 * Generate accessible label for node
 *
 * Creates descriptive text for screen readers including:
 * - Node type
 * - Node label/name
 * - Position in workflow (incoming/outgoing connections)
 * - Current state (selected, executing, error)
 *
 * @example
 * ```typescript
 * const ariaLabel = getNodeAriaLabel(node, nodes, edges, {
 *   isSelected: true,
 *   isExecuting: false,
 * });
 * // "Action node: Send Email. Selected. 1 incoming connection, 2 outgoing connections."
 * ```
 */
export function getNodeAriaLabel(
  node: Node,
  allNodes: Node[],
  edges: Edge[],
  state: {
    isSelected?: boolean;
    isExecuting?: boolean;
    hasError?: boolean;
  } = {}
): string {
  const parts: string[] = [];

  // Node type and label
  const nodeType = (node.type || 'default').replace(/([A-Z])/g, ' $1').trim();
  const nodeLabel = (node.data as any)?.label || node.id;

  parts.push(`${nodeType} node: ${nodeLabel}`);

  // Current state
  if (state.isSelected) parts.push('Selected');
  if (state.isExecuting) parts.push('Executing');
  if (state.hasError) parts.push('Error');

  // Connection count
  const incomingCount = edges.filter((e) => e.target === node.id).length;
  const outgoingCount = edges.filter((e) => e.source === node.id).length;

  const connectionParts: string[] = [];
  if (incomingCount > 0) {
    connectionParts.push(`${incomingCount} incoming connection${incomingCount !== 1 ? 's' : ''}`);
  }
  if (outgoingCount > 0) {
    connectionParts.push(`${outgoingCount} outgoing connection${outgoingCount !== 1 ? 's' : ''}`);
  }

  if (connectionParts.length > 0) {
    parts.push(connectionParts.join(', '));
  }

  // Position in workflow
  const nodeIndex = allNodes.findIndex((n) => n.id === node.id);
  if (nodeIndex !== -1) {
    parts.push(`Item ${nodeIndex + 1} of ${allNodes.length}`);
  }

  return parts.join('. ') + '.';
}

/**
 * Get keyboard shortcut hint for node action
 *
 * Returns human-readable keyboard shortcut string for display in tooltips.
 *
 * @param action - Action type
 * @param platform - OS platform (for Cmd vs Ctrl)
 * @returns Formatted shortcut string
 */
export function getKeyboardShortcut(
  action: 'activate' | 'select' | 'next' | 'previous' | 'first' | 'last' | 'dismiss',
  platform: 'mac' | 'windows' | 'linux' = 'windows'
): string {
  const cmdOrCtrl = platform === 'mac' ? '⌘' : 'Ctrl';

  const shortcuts: Record<string, string> = {
    activate: 'Enter',
    select: 'Space',
    next: 'Tab',
    previous: 'Shift+Tab',
    first: 'Home',
    last: 'End',
    dismiss: 'Esc',
  };

  return shortcuts[action] || '';
}
