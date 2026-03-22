/**
 * Container Styling Utilities
 * 
 * Centralized styling for container nodes in the Flow Editor.
 * Provides theme-aware colors, shadows, and visual feedback.
 * 
 * Phase 7.2: Enhanced Container Management
 */

export interface ContainerTheme {
  background: string;
  border: string;
  shadow: string;
  hoverShadow: string;
  dragShadow: string;
  headerBackground: string;
  headerText: string;
  iconColor: string;
}

/**
 * Get container theme colors based on state
 * 
 * @param isExpanded - Whether container is expanded
 * @param isDragging - Whether container is being dragged
 * @param isDropTarget - Whether container is a valid drop target
 * @returns Theme object with all styling properties
 */
export function getContainerTheme(
  isExpanded: boolean = true,
  isDragging: boolean = false,
  isDropTarget: boolean = false
): ContainerTheme {
  // Base theme (expanded state)
  const theme: ContainerTheme = {
    background: 'rgb(var(--color-surface))',
    border: 'rgb(var(--color-border))',
    shadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    hoverShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
    dragShadow: '0 8px 24px rgba(102, 126, 234, 0.3)',
    headerBackground: 'rgba(102, 126, 234, 0.08)',
    headerText: 'rgb(var(--color-text-primary))',
    iconColor: 'rgb(var(--color-primary))',
  };

  // Collapsed state - lighter visual weight
  if (!isExpanded) {
    theme.background = 'rgba(var(--color-surface), 0.95)';
    theme.shadow = '0 1px 4px rgba(0, 0, 0, 0.08)';
    theme.headerBackground = 'rgba(102, 126, 234, 0.05)';
  }

  // Dragging state - emphasized shadow
  if (isDragging) {
    theme.shadow = theme.dragShadow;
    theme.border = 'rgb(102, 126, 234)'; // Primary color
  }

  // Drop target state - visual indicator
  if (isDropTarget) {
    theme.background = 'rgba(102, 126, 234, 0.05)';
    theme.border = 'rgb(34, 197, 94)'; // Success color
    theme.shadow = '0 0 0 2px rgba(34, 197, 94, 0.2)';
  }

  return theme;
}

/**
 * Calculate container size based on children count
 * 
 * @param childrenCount - Number of child nodes
 * @param isExpanded - Whether container is expanded
 * @returns Width and height in pixels
 */
export function calculateContainerSize(
  childrenCount: number,
  isExpanded: boolean
): { width: number; height: number } {
  const HEADER_HEIGHT = 48;
  const MIN_WIDTH = 280;
  const MIN_EXPANDED_HEIGHT = 200;
  const COLLAPSED_HEIGHT = HEADER_HEIGHT;
  const CHILD_HEIGHT_ESTIMATE = 100;
  const PADDING = 32;

  if (!isExpanded) {
    return {
      width: MIN_WIDTH,
      height: COLLAPSED_HEIGHT,
    };
  }

  // Calculate height based on children
  const contentHeight = childrenCount > 0
    ? Math.max(childrenCount * CHILD_HEIGHT_ESTIMATE + PADDING, MIN_EXPANDED_HEIGHT)
    : MIN_EXPANDED_HEIGHT;

  return {
    width: MIN_WIDTH,
    height: HEADER_HEIGHT + contentHeight,
  };
}

/**
 * Get container icon based on type
 * 
 * @param containerType - Type of container node
 * @returns Icon component name (for lucide-react)
 */
export function getContainerIcon(
  containerType: string = 'formProcessGroup'
): string {
  const iconMap: Record<string, string> = {
    formBook: 'Book',
    formProcessGroup: 'Layers',
    formMultiStepContainer: 'List',
    subWorkflow: 'GitBranch',
    parallelPath: 'GitMerge',
    default: 'Box',
  };

  return iconMap[containerType] || iconMap.default;
}

/**
 * Check if a node is inside a container's boundaries
 * 
 * @param nodePosition - Position of node to check
 * @param nodeSize - Size of node to check
 * @param containerPosition - Position of container
 * @param containerSize - Size of container
 * @param threshold - Pixels of overlap required (default: 20)
 * @returns True if node is inside container bounds
 */
export function isNodeInsideContainer(
  nodePosition: { x: number; y: number },
  nodeSize: { width: number; height: number },
  containerPosition: { x: number; y: number },
  containerSize: { width: number; height: number },
  threshold: number = 20
): boolean {
  const HEADER_HEIGHT = 48;
  
  // Calculate node center point
  const nodeCenterX = nodePosition.x + nodeSize.width / 2;
  const nodeCenterY = nodePosition.y + nodeSize.height / 2;

  // Container bounds (excluding header for drop zone)
  const containerLeft = containerPosition.x;
  const containerRight = containerPosition.x + containerSize.width;
  const containerTop = containerPosition.y + HEADER_HEIGHT;
  const containerBottom = containerPosition.y + containerSize.height;

  // Check if center is within bounds (with threshold)
  return (
    nodeCenterX >= containerLeft + threshold &&
    nodeCenterX <= containerRight - threshold &&
    nodeCenterY >= containerTop + threshold &&
    nodeCenterY <= containerBottom - threshold
  );
}

/**
 * Generate CSS transform for container animation
 * 
 * @param isExpanded - Whether container is expanded
 * @param isDragging - Whether container is being dragged
 * @returns CSS transform string
 */
export function getContainerTransform(
  isExpanded: boolean,
  isDragging: boolean
): string {
  const scale = isDragging ? 1.02 : 1.0;
  return `scale(${scale})`;
}

/**
 * Get container badge text (child count, status, etc.)
 * 
 * @param childrenCount - Number of child nodes
 * @param isExpanded - Whether container is expanded
 * @returns Badge text or null
 */
export function getContainerBadge(
  childrenCount: number,
  isExpanded: boolean
): string | null {
  if (childrenCount === 0) {
    return null;
  }

  if (!isExpanded) {
    return `${childrenCount} ${childrenCount === 1 ? 'step' : 'steps'}`;
  }

  return null; // Don't show badge when expanded (children are visible)
}

/**
 * Calculate snap points for aligning child nodes within container
 * 
 * @param containerPosition - Container position
 * @param containerSize - Container size
 * @param gridSize - Grid size for snapping (default: 20)
 * @returns Array of snap point coordinates
 */
export function getContainerSnapPoints(
  containerPosition: { x: number; y: number },
  containerSize: { width: number; height: number },
  gridSize: number = 20
): Array<{ x: number; y: number }> {
  const HEADER_HEIGHT = 48;
  const PADDING = 32;
  
  const snapPoints: Array<{ x: number; y: number }> = [];

  // Center horizontal line
  const centerX = containerPosition.x + containerSize.width / 2;

  // Vertical snap points (every grid increment)
  const startY = containerPosition.y + HEADER_HEIGHT + PADDING;
  const endY = containerPosition.y + containerSize.height - PADDING;

  for (let y = startY; y <= endY; y += gridSize) {
    snapPoints.push({ x: centerX, y });
  }

  return snapPoints;
}
