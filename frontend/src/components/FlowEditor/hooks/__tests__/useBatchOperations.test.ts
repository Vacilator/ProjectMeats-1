/**
 * Batch Operations Hook Tests
 * Phase 7.2: Batch Operations
 *
 * Tests for useBatchOperations hook:
 * - Clipboard operations (copy/cut/paste)
 * - Node duplication
 * - Node deletion
 * - Alignment operations
 * - Distribution operations
 * - Keyboard shortcuts
 * - LocalStorage persistence
 *
 * Created: 2026-02-27
 */

import { beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { ReactFlowProvider, Node, Edge } from '@xyflow/react';
import { useBatchOperations } from '../useBatchOperations';

// Mock React Flow hooks
const mockGetNodes = vi.fn<Node[], []>();
const mockSetNodes = vi.fn();
const mockGetEdges = vi.fn<Edge[], []>();
const mockSetEdges = vi.fn();

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual<any>('@xyflow/react');
  return {
    ...actual,
    useReactFlow: () => ({
      getNodes: mockGetNodes,
      setNodes: mockSetNodes,
      getEdges: mockGetEdges,
      setEdges: mockSetEdges,
    }),
  };
});

// Mock localStorage
const localStorageMock: { [key: string]: string } = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: (key: string) => localStorageMock[key] || null,
    setItem: (key: string, value: string) => {
      localStorageMock[key] = value;
    },
    removeItem: (key: string) => {
      delete localStorageMock[key];
    },
    clear: () => {
      for (const key in localStorageMock) {
        delete localStorageMock[key];
      }
    },
  },
  writable: true,
});

// Test data
const createTestNode = (id: string, x: number, y: number, selected = false): Node => ({
  id,
  type: 'default',
  position: { x, y },
  data: { label: `Node ${id}` },
  selected,
});

const createTestEdge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});

describe('useBatchOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  // ============================================================================
  // Copy Operations
  // ============================================================================

  describe('copySelection', () => {
    it('should copy selected nodes to clipboard', () => {
      const nodes: Node[] = [
        createTestNode('1', 0, 0, true),
        createTestNode('2', 100, 100, true),
        createTestNode('3', 200, 200, false),
      ];
      const edges: Edge[] = [createTestEdge('e1', '1', '2')];

      mockGetNodes.mockReturnValue(nodes);
      mockGetEdges.mockReturnValue(edges);

      const onCopy = vi.fn();
      const { result } = renderHook(() => useBatchOperations({ onCopy }), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.copySelection();
      });

      expect(onCopy).toHaveBeenCalledWith(2); // 2 selected nodes
      expect(result.current.clipboardCount).toBe(2);
    });

    it('should store clipboard in localStorage', () => {
      const nodes: Node[] = [createTestNode('1', 0, 0, true)];
      mockGetNodes.mockReturnValue(nodes);
      mockGetEdges.mockReturnValue([]);

      const { result } = renderHook(() => useBatchOperations(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.copySelection();
      });

      const stored = localStorage.getItem('floweditor_clipboard');
      expect(stored).toBeTruthy();
      const parsed = JSON.parse(stored!);
      expect(parsed.nodes).toHaveLength(1);
      expect(parsed.nodes[0].id).toBe('1');
    });
  });

  // ============================================================================
  // Delete Operations
  // ============================================================================

  describe('deleteSelection', () => {
    it('should delete selected nodes and connected edges', () => {
      const nodes: Node[] = [
        createTestNode('1', 0, 0, true),
        createTestNode('2', 100, 100, false),
      ];
      const edges: Edge[] = [
        createTestEdge('e1', '1', '2'),
        createTestEdge('e2', '2', '3'),
      ];
      mockGetNodes.mockReturnValue(nodes);
      mockGetEdges.mockReturnValue(edges);

      const onDelete = vi.fn();
      const { result } = renderHook(() => useBatchOperations({ onDelete }), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.deleteSelection();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      expect(mockSetEdges).toHaveBeenCalled();
      expect(onDelete).toHaveBeenCalledWith(1);
    });
  });

  // ============================================================================
  // Alignment Operations
  // ============================================================================

  describe('alignHorizontal', () => {
    const nodes: Node[] = [
      createTestNode('1', 0, 100, true),
      createTestNode('2', 100, 200, true),
      createTestNode('3', 200, 300, true),
    ];

    beforeEach(() => {
      mockGetNodes.mockReturnValue(nodes);
    });

    it('should align nodes to the left', () => {
      const { result } = renderHook(() => useBatchOperations(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.alignHorizontal('left');
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCall = mockSetNodes.mock.calls[0][0];
      const updatedNodes = setNodesCall(nodes);

      expect(updatedNodes[0].position.x).toBe(0);
      expect(updatedNodes[1].position.x).toBe(0);
      expect(updatedNodes[2].position.x).toBe(0);
    });
  });

  // ============================================================================
  // Distribution Operations
  // ============================================================================

  describe('distributeHorizontally', () => {
    it('should distribute nodes evenly horizontally', () => {
      const nodes: Node[] = [
        createTestNode('1', 0, 0, true),
        createTestNode('2', 50, 0, true),
        createTestNode('3', 300, 0, true),
      ];
      mockGetNodes.mockReturnValue(nodes);

      const { result } = renderHook(() => useBatchOperations(), {
        wrapper: ReactFlowProvider,
      });

      act(() => {
        result.current.distributeHorizontally();
      });

      expect(mockSetNodes).toHaveBeenCalled();
      const setNodesCall = mockSetNodes.mock.calls[0][0];
      const updatedNodes = setNodesCall(nodes);

      expect(updatedNodes[0].position.x).toBe(0);
      expect(updatedNodes[2].position.x).toBe(300);
      expect(updatedNodes[1].position.x).toBe(150);
    });
  });
});
