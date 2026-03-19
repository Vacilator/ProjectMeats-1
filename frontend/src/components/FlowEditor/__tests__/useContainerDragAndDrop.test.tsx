/**
 * Container Drag-and-Drop Hook - Unit Tests
 * 
 * Tests for magnetic snapping and drop target detection.
 * 
 * Phase 7.2: Enhanced Container Management (Part 2/3)
 */

import { renderHook, act } from '@testing-library/react';
import { useContainerDragAndDrop } from '../hooks/useContainerDragAndDrop';
import { vi } from 'vitest';

// Mock ReactFlow hooks
const mockGetNodes = vi.fn();
const mockSetNodes = vi.fn();
const mockGetNode = vi.fn();

vi.mock('@xyflow/react', () => ({
  useReactFlow: () => ({
    getNodes: mockGetNodes,
    setNodes: mockSetNodes,
    getNode: mockGetNode,
  }),
}));

describe('useContainerDragAndDrop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mock return values
    mockGetNodes.mockReturnValue([
      {
        id: 'container-1',
        type: 'formBook',
        position: { x: 100, y: 100 },
        width: 300,
        height: 400,
        data: {},
      },
      {
        id: 'node-1',
        type: 'formInputField',
        position: { x: 50, y: 50 },
        width: 200,
        height: 100,
        data: {},
      },
    ]);

    mockGetNode.mockImplementation((id: string) => {
      if (id === 'container-1') {
        return {
          id: 'container-1',
          type: 'formBook',
          position: { x: 100, y: 100 },
          width: 300,
          height: 400,
          data: {},
        };
      }
      return null;
    });
  });

  describe('initialization', () => {
    it('should initialize with empty drag state', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      expect(result.current.dragState.draggingNodeId).toBeNull();
      expect(result.current.dragState.dropTargetId).toBeNull();
      expect(result.current.dragState.snapPreview).toBeNull();
    });

    it('should provide handler functions', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      expect(typeof result.current.onNodeDragStart).toBe('function');
      expect(typeof result.current.onNodeDrag).toBe('function');
      expect(typeof result.current.onNodeDragStop).toBe('function');
      expect(typeof result.current.isContainer).toBe('function');
      expect(typeof result.current.findContainerAtPosition).toBe('function');
    });
  });

  describe('isContainer', () => {
    it('should identify container nodes', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      const containerNode = { id: '1', type: 'formBook', position: { x: 0, y: 0 }, data: {} };
      const regularNode = { id: '2', type: 'formInputField', position: { x: 0, y: 0 }, data: {} };

      expect(result.current.isContainer(containerNode as any)).toBe(true);
      expect(result.current.isContainer(regularNode as any)).toBe(false);
    });

    it('should support custom container types', () => {
      const { result } = renderHook(
        () => useContainerDragAndDrop(['customContainer'])
      );

      const customNode = { id: '1', type: 'customContainer', position: { x: 0, y: 0 }, data: {} };
      const regularNode = { id: '2', type: 'formInputField', position: { x: 0, y: 0 }, data: {} };

      expect(result.current.isContainer(customNode as any)).toBe(true);
      expect(result.current.isContainer(regularNode as any)).toBe(false);
    });
  });

  describe('onNodeDragStart', () => {
    it('should set dragging node ID', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      const node = {
        id: 'node-1',
        type: 'formInputField',
        position: { x: 50, y: 50 },
        data: {},
      };

      act(() => {
        result.current.onNodeDragStart({} as React.MouseEvent, node as any);
      });

      expect(result.current.dragState.draggingNodeId).toBe('node-1');
    });

    it('should not track container nodes', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      const containerNode = {
        id: 'container-1',
        type: 'formBook',
        position: { x: 100, y: 100 },
        data: {},
      };

      act(() => {
        result.current.onNodeDragStart({} as React.MouseEvent, containerNode as any);
      });

      expect(result.current.dragState.draggingNodeId).toBeNull();
    });
  });

  describe('onNodeDragStop', () => {
    it('should clear drag state after drop', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      const node = {
        id: 'node-1',
        type: 'formInputField',
        position: { x: 200, y: 200 },
        width: 200,
        height: 100,
        data: {},
      };

      // Start drag
      act(() => {
        result.current.onNodeDragStart({} as React.MouseEvent, node as any);
      });

      expect(result.current.dragState.draggingNodeId).toBe('node-1');

      // Stop drag
      act(() => {
        result.current.onNodeDragStop({} as React.MouseEvent, node as any);
      });

      expect(result.current.dragState.draggingNodeId).toBeNull();
      expect(result.current.dragState.dropTargetId).toBeNull();
      expect(result.current.dragState.snapPreview).toBeNull();
    });

    it('should return drop result', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      const node = {
        id: 'node-1',
        type: 'formInputField',
        position: { x: 200, y: 200 },
        width: 200,
        height: 100,
        data: {},
      };

      act(() => {
        result.current.onNodeDragStart({} as React.MouseEvent, node as any);
      });

      let dropResult: any;
      act(() => {
        dropResult = result.current.onNodeDragStop({} as React.MouseEvent, node as any);
      });

      expect(dropResult).toBeDefined();
      expect(typeof dropResult.success).toBe('boolean');
      expect(dropResult).toHaveProperty('containerId');
      expect(dropResult).toHaveProperty('position');
    });
  });

  describe('findContainerAtPosition', () => {
    it('should find container at position', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      // Position inside container-1 (x: 100-400, y: 148-500, accounting for 48px header)
      const position = { x: 250, y: 300 };

      const container = result.current.findContainerAtPosition(position);

      expect(container).toBeDefined();
      expect(container?.id).toBe('container-1');
    });

    it('should return null for position outside containers', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      // Position outside all containers
      const position = { x: 0, y: 0 };

      const container = result.current.findContainerAtPosition(position);

      expect(container).toBeNull();
    });

    it('should exclude specified node ID', () => {
      const { result } = renderHook(() => useContainerDragAndDrop());

      const position = { x: 250, y: 300 };

      const container = result.current.findContainerAtPosition(position, 'container-1');

      expect(container).toBeNull(); // Excluded the only container
    });
  });

  describe('configuration options', () => {
    it('should accept custom snap threshold', () => {
      const { result } = renderHook(
        () => useContainerDragAndDrop(['formProcessGroup'], 50, 20)
      );

      expect(result.current).toBeDefined();
      // Snap threshold is internal, but hook should initialize successfully
    });

    it('should accept custom grid size', () => {
      const { result } = renderHook(
        () => useContainerDragAndDrop(['formProcessGroup'], 30, 40)
      );

      expect(result.current).toBeDefined();
      // Grid size is internal, but hook should initialize successfully
    });
  });
});
