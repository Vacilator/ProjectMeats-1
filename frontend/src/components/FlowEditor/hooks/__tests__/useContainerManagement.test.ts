/**
 * Container Management Hook Tests
 * Phase 7.2: Container Nesting Management
 *
 * Tests for useContainerManagement hook:
 * - Creating containers from selection
 * - Adding/removing nodes from containers
 * - Ungrouping containers
 * - Fitting containers to children
 * - Nested container handling
 *
 * Created: 2026-02-27
 */

import { beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactFlowProvider, Node } from '@xyflow/react';
import { useContainerManagement } from '../useContainerManagement';

// Mock React Flow hooks
const mockGetNodes = vi.fn<Node[], []>();
const mockSetNodes = vi.fn();
const mockGetEdges = vi.fn();

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<any>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      getNodes: mockGetNodes,
      setNodes: mockSetNodes,
      getEdges: mockGetEdges,
    }),
  };
});

// Test data
const createTestNode = (id: string, x: number, y: number, selected = false): Node => ({
  id,
  type: 'default',
  position: { x, y },
  data: { label: `Node ${id}` },
  selected,
  width: 200,
  height: 100,
});

const createContainerNode = (
  id: string,
  x: number,
  y: number,
  childNodeIds: string[]
): Node => ({
  id,
  type: 'container',
  position: { x, y },
  data: {
    label: 'Container',
    childNodeIds,
  },
  width: 400,
  height: 300,
});

describe('useContainerManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================================================
  // Create Container
  // ============================================================================

  describe('createContainerFromSelection', () => {
    it('should create container from selected nodes', () => {
      const nodes: Node[] = [
        createTestNode('1', 100, 100, true),
        createTestNode('2', 300, 200, true),
        createTestNode('3', 500, 300, false),
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      let containerNode: Node | null = null;
      act(() => {
        containerNode = result.current.createContainerFromSelection({
          label: 'Test Container',
        });
      });

      expect(containerNode).toBeTruthy();
      expect(containerNode?.type).toBe('container');
      expect(mockSetNodes).toHaveBeenCalled();
    });

    it('should return null if no nodes selected', () => {
      const nodes: Node[] = [createTestNode('1', 0, 0, false)];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      let containerNode: Node | null = null;
      act(() => {
        containerNode = result.current.createContainerFromSelection();
      });

      expect(containerNode).toBeNull();
      expect(mockSetNodes).not.toHaveBeenCalled();
    });

    it('should set child nodes as relative to container', () => {
      const nodes: Node[] = [
        createTestNode('1', 100, 100, true),
        createTestNode('2', 200, 200, true),
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.createContainerFromSelection();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCall = mockSetNodes.mock.calls[0][0];
      const updatedNodes = setNodesCall(nodes);

      // Check that child nodes have parentId set (React Flow sub-flow parenting)
      const childNode = updatedNodes.find((n: Node) => n.id === '1');
      expect(childNode.parentId).toBeTruthy();
      expect(childNode.extent).toBe('parent');
    });
  });

  // ============================================================================
  // Add/Remove Nodes
  // ============================================================================

  describe('addNodesToContainer', () => {
    it('should add nodes to existing container', () => {
      const nodes: Node[] = [
        createContainerNode('c1', 0, 0, ['1']),
        createTestNode('1', 50, 50),
        createTestNode('2', 200, 200),
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.addNodesToContainer('c1', ['2']);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });
  });

  describe('removeNodesFromContainer', () => {
    it('should remove nodes from container', () => {
      const nodes: Node[] = [
        createContainerNode('c1', 0, 0, ['1', '2']),
        createTestNode('1', 50, 50),
        createTestNode('2', 100, 100),
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.removeNodesFromContainer('c1', ['2']);
      });

      expect(mockSetNodes).toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Ungroup Container
  // ============================================================================

  describe('ungroupContainer', () => {
    it('should ungroup container and restore children', () => {
      const nodes: Node[] = [
        createContainerNode('c1', 100, 100, ['1', '2']),
        { ...createTestNode('1', 50, 50), parentId: 'c1' },
        { ...createTestNode('2', 100, 100), parentId: 'c1' },
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.ungroupContainer('c1');
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCall = mockSetNodes.mock.calls[0][0];
      const updatedNodes = setNodesCall(nodes);

      // Container should be removed
      expect(updatedNodes.find((n: Node) => n.id === 'c1')).toBeUndefined();

      // Children should have no parent
      const child1 = updatedNodes.find((n: Node) => n.id === '1');
      expect(child1.parentId).toBeUndefined();
    });
  });

  // ============================================================================
  // Utility Functions
  // ============================================================================

  describe('isContainer', () => {
    it('should identify container nodes', () => {
      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      const containerNode = createContainerNode('c1', 0, 0, []);
      const regularNode = createTestNode('1', 0, 0);

      expect(result.current.isContainer(containerNode)).toBe(true);
      expect(result.current.isContainer(regularNode)).toBe(false);
    });
  });

  describe('getContainerChildren', () => {
    it('should return child nodes of container', () => {
      const nodes: Node[] = [
        createContainerNode('c1', 0, 0, ['1', '2']),
        createTestNode('1', 50, 50),
        createTestNode('2', 100, 100),
        createTestNode('3', 200, 200),
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useContainerManagement(), {
        wrapper: ReactFlowProvider,
      });

      const children = result.current.getContainerChildren('c1');

      expect(children).toHaveLength(2);
      expect(children.map((n) => n.id)).toEqual(['1', '2']);
    });
  });
});
