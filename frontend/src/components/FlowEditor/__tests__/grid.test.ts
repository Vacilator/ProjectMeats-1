/**
 * Grid Utility Tests
 *
 * Tests for grid-snapping and alignment utilities used in the Flow Editor.
 *
 * Phase 7.2: Enhanced Drag-and-Drop
 */

import {
  snapCoordinate,
  snapToGrid,
  getSnapOffset,
  isGridAligned,
  snapDelta,
  getNearestGridLines,
} from '../utils/grid';

describe('Grid Utilities', () => {
  describe('snapCoordinate', () => {
    it('should snap to nearest grid point (positive)', () => {
      expect(snapCoordinate(19, 20)).toBe(20);
      expect(snapCoordinate(21, 20)).toBe(20);
      expect(snapCoordinate(30, 20)).toBe(40); // 30 rounds to 40 (closer than 20)
      expect(snapCoordinate(35, 20)).toBe(40);
    });

    it('should snap to nearest grid point (zero)', () => {
      expect(snapCoordinate(0, 20)).toBe(0);
      expect(snapCoordinate(5, 20)).toBe(0);
      expect(snapCoordinate(9, 20)).toBe(0);
    });

    it('should snap to nearest grid point (negative)', () => {
      expect(snapCoordinate(-11, 20)).toBe(-20);
      expect(snapCoordinate(-19, 20)).toBe(-20);
      expect(snapCoordinate(-21, 20)).toBe(-20);
      expect(snapCoordinate(-40, 20)).toBe(-40);
    });

    it('should handle different grid sizes', () => {
      expect(snapCoordinate(14, 15)).toBe(15);
      expect(snapCoordinate(7, 15)).toBe(0);
      expect(snapCoordinate(8, 15)).toBe(15);
      expect(snapCoordinate(45, 15)).toBe(45);
    });

    it('should handle edge cases', () => {
      expect(snapCoordinate(10, 20)).toBe(20); // Exactly halfway (round up)
      expect(snapCoordinate(-10, 20)).toBe(-0); // Exactly halfway negative
    });
  });

  describe('snapToGrid', () => {
    it('should snap position to grid (positive quadrant)', () => {
      expect(snapToGrid(19, 21, 20)).toEqual({ x: 20, y: 20 });
      expect(snapToGrid(35, 45, 20)).toEqual({ x: 40, y: 40 });
    });

    it('should snap position to grid (origin)', () => {
      expect(snapToGrid(5, 5, 20)).toEqual({ x: 0, y: 0 });
      expect(snapToGrid(0, 0, 20)).toEqual({ x: 0, y: 0 });
    });

    it('should snap position to grid (negative quadrants)', () => {
      expect(snapToGrid(-11, 45, 20)).toEqual({ x: -20, y: 40 });
      expect(snapToGrid(19, -21, 20)).toEqual({ x: 20, y: -20 });
      expect(snapToGrid(-15, -25, 20)).toEqual({ x: -20, y: -20 });
    });

    it('should handle already aligned positions', () => {
      expect(snapToGrid(20, 40, 20)).toEqual({ x: 20, y: 40 });
      expect(snapToGrid(0, 0, 20)).toEqual({ x: 0, y: 0 });
      expect(snapToGrid(-40, -60, 20)).toEqual({ x: -40, y: -60 });
    });

    it('should use default grid size of 20', () => {
      expect(snapToGrid(19, 21)).toEqual({ x: 20, y: 20 });
      expect(snapToGrid(5, 5)).toEqual({ x: 0, y: 0 });
    });
  });

  describe('getSnapOffset', () => {
    it('should calculate offset to nearest grid point', () => {
      expect(getSnapOffset(19, 21, 20)).toEqual({ x: 1, y: -1 });
      expect(getSnapOffset(25, 18, 20)).toEqual({ x: -5, y: 2 });
    });

    it('should return zero offset for aligned positions', () => {
      expect(getSnapOffset(20, 40, 20)).toEqual({ x: 0, y: 0 });
      expect(getSnapOffset(0, 0, 20)).toEqual({ x: 0, y: 0 });
      expect(getSnapOffset(-40, -60, 20)).toEqual({ x: 0, y: 0 });
    });

    it('should handle negative coordinates', () => {
      expect(getSnapOffset(-15, -25, 20)).toEqual({ x: -5, y: 5 });
      expect(getSnapOffset(-11, 45, 20)).toEqual({ x: -9, y: -5 });
    });
  });

  describe('isGridAligned', () => {
    it('should detect aligned positions', () => {
      expect(isGridAligned(20, 40, 20)).toBe(true);
      expect(isGridAligned(0, 0, 20)).toBe(true);
      expect(isGridAligned(-40, -60, 20)).toBe(true);
    });

    it('should detect misaligned positions', () => {
      expect(isGridAligned(19, 40, 20)).toBe(false);
      expect(isGridAligned(20, 41, 20)).toBe(false);
      expect(isGridAligned(25, 30, 20)).toBe(false);
    });

    it('should respect tolerance parameter', () => {
      expect(isGridAligned(21, 20, 20, 2)).toBe(true); // Within tolerance
      expect(isGridAligned(19, 20, 20, 2)).toBe(true); // Within tolerance
      expect(isGridAligned(23, 20, 20, 2)).toBe(false); // Outside tolerance
    });

    it('should use default tolerance of 0', () => {
      expect(isGridAligned(21, 20, 20)).toBe(false);
      expect(isGridAligned(20, 20, 20)).toBe(true);
    });
  });

  describe('snapDelta', () => {
    it('should snap delta to grid increments', () => {
      expect(snapDelta(25, 20)).toBe(20);
      expect(snapDelta(35, 20)).toBe(20); // Snaps to single grid increment
      expect(snapDelta(45, 20)).toBe(20); // Also snaps to single increment
    });

    it('should snap negative deltas', () => {
      expect(snapDelta(-15, 20)).toBe(-20);
      expect(snapDelta(-25, 20)).toBe(-20);
      expect(snapDelta(-45, 20)).toBe(-20); // Also snaps to single increment
    });

    it('should return zero for small deltas', () => {
      expect(snapDelta(5, 20)).toBe(0);
      expect(snapDelta(9, 20)).toBe(0);
      expect(snapDelta(-5, 20)).toBe(0);
      expect(snapDelta(-9, 20)).toBe(0);
    });

    it('should handle boundary cases (exactly half grid size)', () => {
      expect(snapDelta(10, 20)).toBe(20); // Exactly halfway - snaps to grid
      expect(snapDelta(11, 20)).toBe(20); // Just over halfway
      expect(snapDelta(-10, 20)).toBe(-20); // Negative halfway
      expect(snapDelta(-11, 20)).toBe(-20);
    });
  });

  describe('getNearestGridLines', () => {
    it('should get grid lines for positive coordinates', () => {
      const lines = getNearestGridLines(25, 35, 20);
      expect(lines).toEqual({
        left: 20,
        right: 40,
        top: 40,
        bottom: 60,
      });
    });

    it('should get grid lines for origin', () => {
      const lines = getNearestGridLines(5, 5, 20);
      expect(lines).toEqual({
        left: 0,
        right: 20,
        top: 0,
        bottom: 20,
      });
    });

    it('should get grid lines for negative coordinates', () => {
      const lines = getNearestGridLines(-15, -25, 20);
      expect(lines).toEqual({
        left: -20,
        right: 0,
        top: -20,
        bottom: 0,
      });
    });

    it('should handle already aligned positions', () => {
      const lines = getNearestGridLines(20, 40, 20);
      expect(lines).toEqual({
        left: 20,
        right: 40,
        top: 40,
        bottom: 60,
      });
    });

    it('should use default grid size of 20', () => {
      const lines = getNearestGridLines(25, 35);
      expect(lines).toEqual({
        left: 20,
        right: 40,
        top: 40,
        bottom: 60,
      });
    });
  });
});
