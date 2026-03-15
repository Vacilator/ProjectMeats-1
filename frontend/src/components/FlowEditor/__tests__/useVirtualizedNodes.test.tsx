/**
 * @fileoverview Tests for virtualization performance hooks
 * @module FlowEditor/__tests__/useVirtualizedNodes
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useVirtualizedNodes,
  usePerformanceMetrics,
  useOptimisticUpdate,
  type VirtualizationConfig,
} from '../hooks/useVirtualizedNodes';
import type { Node, Viewport } from '@xyflow/react';

// Mock performance.now for consistent timing
const mockNow = vi.spyOn(performance, 'now');
let currentTime = 0;

beforeEach(() => {
  currentTime = 0;
  mockNow.mockImplementation(() => currentTime);
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  mockNow.mockRestore();
});

describe('useVirtualizedNodes', () => {
  // Helper to create test nodes
  const createNode = (id: string, x: number, y: number): Node => ({
    id,
    type: 'default',
    position: { x, y },
    data: { label: `Node ${id}` },
  });

  // Helper to create viewport
  const createViewport = (x = 0, y = 0, zoom = 1): Viewport => ({ x, y, zoom });

  describe('Basic functionality', () => {
    it('should return all nodes when below threshold', () => {
      const nodes: Node[] = [
        createNode('1', 0, 0),
        createNode('2', 100, 100),
        createNode('3', 200, 200),
      ];
      const viewport = createViewport();

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 10 })
      );

      expect(result.current.visibleNodes).toHaveLength(3);
      expect(result.current.isVirtualized).toBe(false);
      expect(result.current.totalNodes).toBe(3);
      expect(result.current.renderedNodes).toBe(3);
    });

    it('should return all nodes when virtualization is disabled', () => {
      const nodes: Node[] = Array.from({ length: 150 }, (_, i) =>
        createNode(`node-${i}`, i * 300, i * 200)
      );
      const viewport = createViewport();

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { enabled: false })
      );

      expect(result.current.visibleNodes).toHaveLength(150);
      expect(result.current.isVirtualized).toBe(false);
    });

    it('should activate virtualization above threshold', () => {
      const nodes: Node[] = Array.from({ length: 150 }, (_, i) =>
        createNode(`node-${i}`, i * 300, i * 200)
      );
      const viewport = createViewport();

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 100 })
      );

      expect(result.current.isVirtualized).toBe(true);
      expect(result.current.visibleNodes.length).toBeLessThan(150);
    });
  });

  describe('Viewport filtering', () => {
    it('should only return nodes in viewport', () => {
      // Create grid of nodes: 10x10 at 300px spacing
      const nodes: Node[] = [];
      for (let x = 0; x < 10; x++) {
        for (let y = 0; y < 10; y++) {
          nodes.push(createNode(`node-${x}-${y}`, x * 300, y * 300));
        }
      }

      // Viewport showing top-left corner (0, 0) at zoom 1
      // Assuming window size 1920x1080
      global.window.innerWidth = 1920;
      global.window.innerHeight = 1080;
      
      const viewport = createViewport(0, 0, 1);

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, {
          threshold: 50,
          bufferPx: 0, // No buffer for precise testing
        })
      );

      // Should only see nodes within viewport bounds
      // At 300px spacing, ~6-7 nodes horizontally, ~3-4 vertically
      expect(result.current.visibleNodes.length).toBeGreaterThan(10);
      expect(result.current.visibleNodes.length).toBeLessThan(40);
    });

    it('should include buffer zone nodes', () => {
      const nodes: Node[] = [
        createNode('center', 1000, 500),
        createNode('far-right', 3000, 500), // Beyond viewport
        createNode('buffer-right', 2200, 500), // In buffer zone
      ];

      global.window.innerWidth = 1920;
      global.window.innerHeight = 1080;
      
      const viewport = createViewport(0, 0, 1);

      // Without buffer
      const { result: noBuffer } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, {
          threshold: 1,
          bufferPx: 0,
        })
      );

      // With 500px buffer
      const { result: withBuffer } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, {
          threshold: 1,
          bufferPx: 500,
        })
      );

      expect(noBuffer.current.visibleNodes).not.toContainEqual(
        expect.objectContaining({ id: 'buffer-right' })
      );
      expect(withBuffer.current.visibleNodes).toContainEqual(
        expect.objectContaining({ id: 'buffer-right' })
      );
    });

    it('should handle zoom transformations', () => {
      const nodes: Node[] = [
        createNode('node-1', 0, 0),
        createNode('node-2', 1000, 1000),
      ];

      global.window.innerWidth = 1920;
      global.window.innerHeight = 1080;

      // Zoom out (0.5x) - see more nodes
      const { result: zoomedOut } = renderHook(() =>
        useVirtualizedNodes(nodes, createViewport(0, 0, 0.5), {
          threshold: 1,
          bufferPx: 0,
        })
      );

      // Zoom in (2x) - see fewer nodes
      const { result: zoomedIn } = renderHook(() =>
        useVirtualizedNodes(nodes, createViewport(0, 0, 2), {
          threshold: 1,
          bufferPx: 0,
        })
      );

      // Both nodes visible when zoomed out
      expect(zoomedOut.current.visibleNodes).toHaveLength(2);
      
      // Fewer nodes visible when zoomed in (node-2 is far away)
      expect(zoomedIn.current.visibleNodes.length).toBeLessThanOrEqual(1);
    });
  });

  describe('Performance tracking', () => {
    it('should measure calculation time', () => {
      const nodes: Node[] = Array.from({ length: 200 }, (_, i) =>
        createNode(`node-${i}`, i * 300, i * 200)
      );
      const viewport = createViewport();

      currentTime = 0;
      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 100 })
      );

      // Advance time to simulate calculation
      currentTime = 5;

      expect(result.current.metrics.lastCalculationTime).toBeGreaterThanOrEqual(0);
      expect(result.current.metrics.lastCalculationTime).toBeLessThan(100);
    });

    it('should calculate render ratio', () => {
      const nodes: Node[] = Array.from({ length: 100 }, (_, i) =>
        createNode(`node-${i}`, i * 300, i * 200)
      );
      const viewport = createViewport();

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, viewport, { threshold: 50 })
      );

      const { renderRatio } = result.current.metrics;
      
      expect(renderRatio).toBeGreaterThan(0);
      expect(renderRatio).toBeLessThanOrEqual(1);
      expect(renderRatio).toBe(result.current.renderedNodes / result.current.totalNodes);
    });
  });

  describe('Viewport debouncing', () => {
    it('should debounce viewport updates', async () => {
      const nodes: Node[] = Array.from({ length: 150 }, (_, i) =>
        createNode(`node-${i}`, i * 300, i * 200)
      );

      const { result, rerender } = renderHook(
        ({ viewport }) => useVirtualizedNodes(nodes, viewport, { debounceMs: 100 }),
        { initialProps: { viewport: createViewport(0, 0, 1) } }
      );

      const initialCount = result.current.visibleNodes.length;

      // Change viewport rapidly
      rerender({ viewport: createViewport(-500, 0, 1) });
      rerender({ viewport: createViewport(-1000, 0, 1) });
      rerender({ viewport: createViewport(-1500, 0, 1) });

      // Should not update immediately
      expect(result.current.visibleNodes.length).toBe(initialCount);

      // Advance timers past debounce period
      act(() => {
        vi.advanceTimersByTime(150);
      });

      // Flush debounce timer + react updates
      await act(async () => {
        await vi.runOnlyPendingTimersAsync();
      });

      expect(result.current.visibleNodes.length).not.toBe(initialCount);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty node array', () => {
      const { result } = renderHook(() =>
        useVirtualizedNodes([], createViewport())
      );

      expect(result.current.visibleNodes).toHaveLength(0);
      expect(result.current.totalNodes).toBe(0);
      expect(result.current.renderedNodes).toBe(0);
      expect(result.current.metrics.renderRatio).toBe(1);
    });

    it('should handle negative viewport coordinates', () => {
      const nodes: Node[] = [
        createNode('node-1', 0, 0),
        createNode('node-2', 1000, 1000),
      ];

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, createViewport(-500, -500, 1), {
          threshold: 1,
        })
      );

      // Should still calculate correctly
      expect(result.current.visibleNodes.length).toBeGreaterThan(0);
    });

    it('should handle nodes with custom dimensions', () => {
      const nodes: Node[] = [
        { ...createNode('small', 0, 0), width: 100, height: 50 },
        { ...createNode('large', 500, 0), width: 400, height: 300 },
      ];

      global.window.innerWidth = 1920;
      global.window.innerHeight = 1080;

      const { result } = renderHook(() =>
        useVirtualizedNodes(nodes, createViewport(0, 0, 1), {
          threshold: 1,
          bufferPx: 0,
        })
      );

      // Both should be visible given viewport size
      expect(result.current.visibleNodes).toHaveLength(2);
    });
  });
});

describe('usePerformanceMetrics', () => {
  it('should initialize with default values', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    expect(result.current.fps).toBe(60);
    expect(result.current.memoryMB).toBe(0);
    expect(result.current.avgRenderTime).toBe(0);
    expect(typeof result.current.recordRenderTime).toBe('function');
  });

  it('should calculate FPS from frame times', async () => {
    const originalRAF = globalThis.requestAnimationFrame;
    const originalCAF = globalThis.cancelAnimationFrame;

    let rafCallback: FrameRequestCallback | null = null;

    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallback = cb;
      return 1;
    });

    vi.stubGlobal('cancelAnimationFrame', () => {
      rafCallback = null;
    });

    const { result, unmount } = renderHook(() => usePerformanceMetrics());

    // Flush React effects so the hook schedules its first rAF
    await act(async () => {});
    expect(rafCallback).not.toBeNull();

    // Simulate ~30fps (33.33ms per frame)
    act(() => {
      for (let i = 0; i < 60; i++) {
        currentTime += 33.33;
        rafCallback?.(currentTime);
      }
    });

    // Flush state updates from rAF callbacks
    await act(async () => {});

    expect(result.current.fps).toBeGreaterThan(25);
    expect(result.current.fps).toBeLessThan(35);

    unmount();

    // Restore globals without nuking unrelated stubs (e.g. matchMedia)
    if (originalRAF) vi.stubGlobal('requestAnimationFrame', originalRAF);
    if (originalCAF) vi.stubGlobal('cancelAnimationFrame', originalCAF);
  });

  it('should record average render times', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    act(() => {
      result.current.recordRenderTime(10);
      result.current.recordRenderTime(20);
      result.current.recordRenderTime(30);
    });

    expect(result.current.avgRenderTime).toBe(20); // (10+20+30)/3
  });

  it('should limit render time history', () => {
    const { result } = renderHook(() => usePerformanceMetrics());

    act(() => {
      // Record 15 times (limit is 10)
      for (let i = 1; i <= 15; i++) {
        result.current.recordRenderTime(i);
      }
    });

    // Should average only last 10 values (6-15)
    const expectedAvg = (6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15) / 10;
    expect(result.current.avgRenderTime).toBe(expectedAvg);
  });
});

describe('useOptimisticUpdate', () => {
  it('should update local state immediately', () => {
    const saveFunction = vi.fn().mockResolvedValue({ value: 'saved' });
    const initialData = { value: 'initial' };

    const { result } = renderHook(() =>
      useOptimisticUpdate({
        initialData,
        saveFunction,
        debounceMs: 500,
      })
    );

    expect(result.current.localData).toEqual({ value: 'initial' });

    act(() => {
      result.current.updateLocal({ value: 'updated' });
    });

    // Local state updates immediately
    expect(result.current.localData).toEqual({ value: 'updated' });
    expect(result.current.hasPendingChanges).toBe(true);
    expect(saveFunction).not.toHaveBeenCalled(); // Not saved yet
  });

  it('should auto-save after debounce period', async () => {
    const saveFunction = vi.fn().mockResolvedValue({ value: 'saved' });
    const initialData = { value: 'initial' };

    const { result } = renderHook(() =>
      useOptimisticUpdate({
        initialData,
        saveFunction,
        debounceMs: 500,
      })
    );

    act(() => {
      result.current.updateLocal({ value: 'updated' });
    });

    expect(saveFunction).not.toHaveBeenCalled();

    // Advance past debounce period and flush the async save
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(saveFunction).toHaveBeenCalledWith({ value: 'updated' });

    // Flush promise resolution / state updates
    await act(async () => {});
    expect(result.current.remoteData).toEqual({ value: 'saved' });
  });

  it('should cancel previous save on rapid updates', async () => {
    const saveFunction = vi.fn().mockResolvedValue({ value: 'saved' });
    const initialData = { value: 'initial' };

    const { result } = renderHook(() =>
      useOptimisticUpdate({
        initialData,
        saveFunction,
        debounceMs: 500,
      })
    );

    // Rapid updates
    act(() => {
      result.current.updateLocal({ value: 'update1' });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.updateLocal({ value: 'update2' });
    });

    act(() => {
      vi.advanceTimersByTime(200);
    });

    act(() => {
      result.current.updateLocal({ value: 'update3' });
    });

    // Advance past final debounce and flush the async save
    await act(async () => {
      vi.advanceTimersByTime(600);
      await vi.runOnlyPendingTimersAsync();
    });

    // Should only save once with final value
    expect(saveFunction).toHaveBeenCalledTimes(1);
    expect(saveFunction).toHaveBeenCalledWith({ value: 'update3' });
  });

  it('should force immediate save', async () => {
    const saveFunction = vi.fn().mockResolvedValue({ value: 'saved' });
    const initialData = { value: 'initial' };

    const { result } = renderHook(() =>
      useOptimisticUpdate({
        initialData,
        saveFunction,
        debounceMs: 5000, // Long debounce
      })
    );

    act(() => {
      result.current.updateLocal({ value: 'updated' });
    });

    // Force save immediately
    await act(async () => {
      await result.current.forceSave();
    });

    expect(saveFunction).toHaveBeenCalledWith({ value: 'updated' });
    expect(result.current.isSaving).toBe(false);
  });

  it('should handle save conflicts with resolver', async () => {
    const saveFunction = vi.fn().mockRejectedValue({ status: 409 });
    const onConflict = vi.fn((local, remote) => ({ ...local, resolved: true }));
    const initialData = { value: 'initial' };

    const { result } = renderHook(() =>
      useOptimisticUpdate({
        initialData,
        saveFunction,
        debounceMs: 100,
        onConflict,
      })
    );

    act(() => {
      result.current.updateLocal({ value: 'updated' });
    });

    await act(async () => {
      vi.advanceTimersByTime(150);
      await vi.runOnlyPendingTimersAsync();
    });

    // Flush promise resolution / state updates
    await act(async () => {});

    expect(result.current.hasConflict).toBe(true);
    expect(onConflict).toHaveBeenCalled();
    expect(result.current.localData).toHaveProperty('resolved', true);
  });

  it('should set isSaving flag during save', async () => {
    let resolveSave: (value: any) => void;
    const saveFunction = vi.fn(() => new Promise((resolve) => {
      resolveSave = resolve;
    }));
    
    const initialData = { value: 'initial' };

    const { result } = renderHook(() =>
      useOptimisticUpdate({
        initialData,
        saveFunction,
        debounceMs: 100,
      })
    );

    act(() => {
      result.current.updateLocal({ value: 'updated' });
    });

    await act(async () => {
      vi.advanceTimersByTime(150);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.isSaving).toBe(true);

    // Resolve save
    await act(async () => {
      resolveSave!({ value: 'saved' });
    });

    await act(async () => {});
    expect(result.current.isSaving).toBe(false);
  });
});
