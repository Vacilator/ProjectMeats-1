/**
 * Grid Utility Functions
 * 
 * Provides grid-snapping and alignment utilities for the Flow Editor.
 * 
 * Features:
 * - Snap coordinates to grid (configurable grid size)
 * - Calculate grid alignment offsets
 * - Detect if position is grid-aligned
 * 
 * Phase 7.2: Enhanced Drag-and-Drop
 */

export interface GridPosition {
  x: number;
  y: number;
}

/**
 * Snap a coordinate to the nearest grid point
 * 
 * @param value - The coordinate value (x or y)
 * @param gridSize - Size of each grid cell (default: 20)
 * @returns Snapped coordinate value
 * 
 * @example
 * snapCoordinate(19, 20) // Returns 20
 * snapCoordinate(5, 20)  // Returns 0
 * snapCoordinate(-11, 20) // Returns -20
 */
export function snapCoordinate(value: number, gridSize: number = 20): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Snap a position (x, y) to the nearest grid point
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param gridSize - Size of each grid cell (default: 20)
 * @returns Snapped position
 * 
 * @example
 * snapToGrid(19, 21, 20) // Returns { x: 20, y: 20 }
 * snapToGrid(5, 5, 20)   // Returns { x: 0, y: 0 }
 */
export function snapToGrid(
  x: number,
  y: number,
  gridSize: number = 20
): GridPosition {
  return {
    x: snapCoordinate(x, gridSize),
    y: snapCoordinate(y, gridSize),
  };
}

/**
 * Calculate the offset needed to align a position to grid
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param gridSize - Size of each grid cell (default: 20)
 * @returns Offset from current position to nearest grid point
 * 
 * @example
 * getSnapOffset(19, 21, 20) // Returns { x: 1, y: -1 }
 * getSnapOffset(20, 20, 20) // Returns { x: 0, y: 0 }
 */
export function getSnapOffset(
  x: number,
  y: number,
  gridSize: number = 20
): GridPosition {
  const snapped = snapToGrid(x, y, gridSize);
  return {
    x: snapped.x - x,
    y: snapped.y - y,
  };
}

/**
 * Check if a position is aligned to the grid
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param gridSize - Size of each grid cell (default: 20)
 * @param tolerance - Tolerance in pixels for "close enough" (default: 0)
 * @returns True if position is on grid (within tolerance)
 * 
 * @example
 * isGridAligned(20, 20, 20) // Returns true
 * isGridAligned(21, 20, 20, 2) // Returns true (within tolerance)
 * isGridAligned(25, 20, 20) // Returns false
 */
export function isGridAligned(
  x: number,
  y: number,
  gridSize: number = 20,
  tolerance: number = 0
): boolean {
  const offset = getSnapOffset(x, y, gridSize);
  return Math.abs(offset.x) <= tolerance && Math.abs(offset.y) <= tolerance;
}

/**
 * Snap a delta (change) value to grid increments
 * 
 * Useful for keyboard navigation (arrow keys move by grid increments)
 * 
 * @param delta - Change in position
 * @param gridSize - Size of each grid cell (default: 20)
 * @returns Snapped delta value
 * 
 * @example
 * snapDelta(25, 20) // Returns 20
 * snapDelta(-15, 20) // Returns -20
 * snapDelta(5, 20) // Returns 0
 */
export function snapDelta(delta: number, gridSize: number = 20): number {
  if (Math.abs(delta) < gridSize / 2) return 0;
  return Math.sign(delta) * gridSize;
}

/**
 * Get the nearest grid lines to a position
 * 
 * Useful for drawing grid alignment indicators
 * 
 * @param x - X coordinate
 * @param y - Y coordinate
 * @param gridSize - Size of each grid cell (default: 20)
 * @returns Grid line positions (left, right, top, bottom)
 */
export function getNearestGridLines(
  x: number,
  y: number,
  gridSize: number = 20
): {
  left: number;
  right: number;
  top: number;
  bottom: number;
} {
  const snappedX = snapCoordinate(x, gridSize);
  const snappedY = snapCoordinate(y, gridSize);

  return {
    left: snappedX,
    right: snappedX + gridSize,
    top: snappedY,
    bottom: snappedY + gridSize,
  };
}
