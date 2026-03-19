/**
 * Container Styling Utilities - Unit Tests
 * 
 * Tests for container theming, sizing, and positioning utilities.
 * 
 * Phase 7.2: Enhanced Container Management
 */

import {
  getContainerTheme,
  calculateContainerSize,
  getContainerIcon,
  isNodeInsideContainer,
  getContainerTransform,
  getContainerBadge,
  getContainerSnapPoints,
} from '../utils/containerStyling';

describe('Container Styling Utilities', () => {
  describe('getContainerTheme', () => {
    it('should return base theme for expanded container', () => {
      const theme = getContainerTheme(true, false, false);
      
      expect(theme.background).toBe('rgb(var(--color-surface))');
      expect(theme.border).toBe('rgb(var(--color-border))');
      expect(theme.shadow).toBe('0 2px 8px rgba(0, 0, 0, 0.1)');
    });

    it('should return lighter theme for collapsed container', () => {
      const theme = getContainerTheme(false, false, false);
      
      expect(theme.background).toBe('rgba(var(--color-surface), 0.95)');
      expect(theme.shadow).toBe('0 1px 4px rgba(0, 0, 0, 0.08)');
    });

    it('should emphasize shadow when dragging', () => {
      const theme = getContainerTheme(true, true, false);
      
      expect(theme.shadow).toBe('0 8px 24px rgba(102, 126, 234, 0.3)');
      expect(theme.border).toBe('rgb(102, 126, 234)');
    });

    it('should highlight as drop target', () => {
      const theme = getContainerTheme(true, false, true);
      
      expect(theme.background).toBe('rgba(102, 126, 234, 0.05)');
      expect(theme.border).toBe('rgb(34, 197, 94)');
      expect(theme.shadow).toContain('rgba(34, 197, 94, 0.2)');
    });
  });

  describe('calculateContainerSize', () => {
    it('should return collapsed size when not expanded', () => {
      const size = calculateContainerSize(5, false);
      
      expect(size.width).toBe(280);
      expect(size.height).toBe(48); // Header height only
    });

    it('should calculate expanded size based on children', () => {
      const size = calculateContainerSize(3, true);
      
      expect(size.width).toBe(280);
      expect(size.height).toBeGreaterThan(200); // Min height
      expect(size.height).toBe(48 + (3 * 100 + 32)); // Header + content
    });

    it('should use minimum height for containers with no children', () => {
      const size = calculateContainerSize(0, true);
      
      expect(size.height).toBe(48 + 200); // Header + min content
    });
  });

  describe('getContainerIcon', () => {
    it('should return correct icon for known container types', () => {
      expect(getContainerIcon('formBook')).toBe('Book');
      expect(getContainerIcon('formProcessGroup')).toBe('Layers');
      expect(getContainerIcon('subWorkflow')).toBe('GitBranch');
      expect(getContainerIcon('parallelPath')).toBe('GitMerge');
    });

    it('should return default icon for unknown type', () => {
      expect(getContainerIcon('unknownType')).toBe('Box');
    });
  });

  describe('isNodeInsideContainer', () => {
    const containerPos = { x: 100, y: 100 };
    const containerSize = { width: 300, height: 400 };

    it('should detect node inside container bounds', () => {
      const nodePos = { x: 200, y: 200 };
      const nodeSize = { width: 80, height: 60 };

      const result = isNodeInsideContainer(
        nodePos,
        nodeSize,
        containerPos,
        containerSize
      );

      expect(result).toBe(true);
    });

    it('should detect node outside container bounds', () => {
      const nodePos = { x: 50, y: 50 }; // Outside left/top
      const nodeSize = { width: 80, height: 60 };

      const result = isNodeInsideContainer(
        nodePos,
        nodeSize,
        containerPos,
        containerSize
      );

      expect(result).toBe(false);
    });

    it('should respect header exclusion zone', () => {
      const nodePos = { x: 200, y: 110 }; // In header area
      const nodeSize = { width: 80, height: 60 };

      const result = isNodeInsideContainer(
        nodePos,
        nodeSize,
        containerPos,
        containerSize
      );

      expect(result).toBe(false); // Header not a valid drop zone
    });

    it('should respect threshold parameter', () => {
      const nodePos = { x: 105, y: 155 }; // Just inside with default threshold
      const nodeSize = { width: 80, height: 60 };

      const result = isNodeInsideContainer(
        nodePos,
        nodeSize,
        containerPos,
        containerSize,
        50 // Larger threshold
      );

      expect(result).toBe(false); // Too close to edge with large threshold
    });
  });

  describe('getContainerTransform', () => {
    it('should return normal scale when not dragging', () => {
      const transform = getContainerTransform(true, false);
      expect(transform).toBe('scale(1)');
    });

    it('should return scaled up when dragging', () => {
      const transform = getContainerTransform(true, true);
      expect(transform).toBe('scale(1.02)');
    });
  });

  describe('getContainerBadge', () => {
    it('should return null for empty container', () => {
      const badge = getContainerBadge(0, true);
      expect(badge).toBeNull();
    });

    it('should return badge text when collapsed with children', () => {
      const badge = getContainerBadge(3, false);
      expect(badge).toBe('3 steps');
    });

    it('should use singular form for one child', () => {
      const badge = getContainerBadge(1, false);
      expect(badge).toBe('1 step');
    });

    it('should return null when expanded (children visible)', () => {
      const badge = getContainerBadge(5, true);
      expect(badge).toBeNull();
    });
  });

  describe('getContainerSnapPoints', () => {
    it('should generate snap points along container centerline', () => {
      const containerPos = { x: 100, y: 100 };
      const containerSize = { width: 300, height: 400 };
      const gridSize = 20;

      const snapPoints = getContainerSnapPoints(
        containerPos,
        containerSize,
        gridSize
      );

      // Should have points along vertical axis
      expect(snapPoints.length).toBeGreaterThan(0);
      
      // All points should be at container center horizontally
      const centerX = containerPos.x + containerSize.width / 2;
      snapPoints.forEach(point => {
        expect(point.x).toBe(centerX);
      });

      // Points should be evenly spaced vertically
      if (snapPoints.length > 1) {
        const spacing = snapPoints[1].y - snapPoints[0].y;
        expect(spacing).toBe(gridSize);
      }
    });

    it('should respect header and padding boundaries', () => {
      const containerPos = { x: 0, y: 0 };
      const containerSize = { width: 300, height: 400 };

      const snapPoints = getContainerSnapPoints(
        containerPos,
        containerSize,
        20
      );

      // First point should be below header + padding (48 + 32 = 80)
      expect(snapPoints[0].y).toBeGreaterThanOrEqual(80);

      // Last point should be above bottom padding
      const lastPoint = snapPoints[snapPoints.length - 1];
      expect(lastPoint.y).toBeLessThanOrEqual(containerSize.height - 32);
    });
  });
});
