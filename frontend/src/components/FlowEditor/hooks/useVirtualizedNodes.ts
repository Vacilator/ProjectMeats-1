/**
 * @fileoverview Custom hook for virtualized node rendering in large workflows
 * @module FlowEditor/hooks/useVirtualizedNodes
 * 
 * Implements viewport-based virtualization to handle 1000+ node workflows efficiently.
 * Only nodes within viewport + buffer zone are rendered, dramatically reducing DOM nodes.
 * 
 * Performance targets:
 * - < 16ms render time (60fps)
 * - < 100MB memory for 1000 nodes
 * - < 50ms scroll/pan response
 * 
 * @see Phase 7.5: Performance Optimization
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Node, Viewport } from '@xyflow/react';
import { logger } from '@/utils/logger';

/**
 * Configuration for virtualization behavior
 */
export interface VirtualizationConfig {
  /**
   * Buffer area around viewport to pre-render nodes (prevents pop-in)
   * @default 200
   */
  bufferPx?: number;

  /**
   * Minimum number of nodes before virtualization kicks in
   * Below this threshold, render all nodes normally
   * @default 100
   */
  threshold?: number;

  /**
   * Debounce delay for viewport updates (ms)
   * Prevents excessive recalculations during fast pan/zoom
   * @default 50
   */
  debounceMs?: number;

  /**
   * Whether to enable virtualization
   * @default true
   */
  enabled?: boolean;
}

/**
 * Result object from useVirtualizedNodes hook
 */
export interface VirtualizedNodesResult<T extends Node = Node> {
  /**
   * Filtered array of nodes currently visible in viewport
   */
  visibleNodes: T[];

  /**
   * Total count of all nodes in workflow
   */
  totalNodes: number;

  /**
   * Count of currently rendered (visible) nodes
   */
  renderedNodes: number;

  /**
   * Whether virtualization is currently active
   */
  isVirtualized: boolean;

  /**
   * Performance metrics
   */
  metrics: {
    /**
     * Time taken to calculate visible nodes (ms)
     */
    lastCalculationTime: number;

    /**
     * Percentage of nodes currently rendered
     */
    renderRatio: number;
  };
}

/**
 * Calculate if a node is within the viewport bounds
 * 
 * @param node - React Flow node
 * @param viewport - Current viewport state
 * @param bufferPx - Buffer zone around viewport (pixels)
 * @returns true if node should be rendered
 */
function isNodeInViewport(
  node: Node,
  viewport: Viewport,
  bufferPx: number
): boolean {
  // Node position is in flow coordinates
  const nodeX = node.position.x;
  const nodeY = node.position.y;
  
  // Approximate node dimensions (can be overridden with node.width/height if available)
  const nodeWidth = (node as any).width ?? 200;
  const nodeHeight = (node as any).height ?? 100;
  
  // Transform viewport bounds to flow coordinates
  const viewportLeft = (-viewport.x) / viewport.zoom - bufferPx;
  const viewportTop = (-viewport.y) / viewport.zoom - bufferPx;
  const viewportRight = (window.innerWidth - viewport.x) / viewport.zoom + bufferPx;
  const viewportBottom = (window.innerHeight - viewport.y) / viewport.zoom + bufferPx;
  
  // Check if node intersects with viewport (with buffer)
  return (
    nodeX + nodeWidth >= viewportLeft &&
    nodeX <= viewportRight &&
    nodeY + nodeHeight >= viewportTop &&
    nodeY <= viewportBottom
  );
}

/**
 * Custom hook for virtualizing node rendering in large workflows
 * 
 * Dramatically improves performance for workflows with 100+ nodes by only
 * rendering nodes visible in the current viewport. Includes a configurable
 * buffer zone to prevent "pop-in" during pan/zoom operations.
 * 
 * @example
 * ```typescript
 * const MyFlowEditor = () => {
 *   const [nodes, setNodes] = useState<Node[]>(initialNodes);
 *   const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
 *   
 *   const { visibleNodes, metrics } = useVirtualizedNodes(nodes, viewport, {
 *     bufferPx: 300,
 *     threshold: 50,
 *   });
 *   
 *   return (
 *     <ReactFlow
 *       nodes={visibleNodes}
 *       onMove={({ viewport: vp }) => setViewport(vp)}
 *     >
 *       {metrics.renderRatio < 0.5 && (
 *         <div>Virtualized: {metrics.renderedNodes}/{metrics.totalNodes} nodes</div>
 *       )}
 *     </ReactFlow>
 *   );
 * };
 * ```
 * 
 * @param nodes - Full array of workflow nodes
 * @param viewport - Current React Flow viewport state
 * @param config - Virtualization configuration options
 * @returns Object containing visible nodes and performance metrics
 */
export function useVirtualizedNodes<T extends Node = Node>(
  nodes: T[],
  viewport: Viewport,
  config: VirtualizationConfig = {}
): VirtualizedNodesResult<T> {
  const {
    bufferPx = 200,
    threshold = 100,
    debounceMs = 50,
    enabled = true,
  } = config;

  // State for debounced viewport
  const [debouncedViewport, setDebouncedViewport] = useState<Viewport>(viewport);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce viewport updates to prevent excessive recalculations
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      setDebouncedViewport(viewport);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [viewport, debounceMs]);
  // Calculate visible nodes with performance tracking (pure computation; no setState inside render)
  const { visibleNodes, lastCalculationTime } = useMemo(() => {
    const startTime = performance.now();

    // If virtualization is disabled or below threshold, return all nodes
    if (!enabled || nodes.length < threshold) {
      const calcTime = performance.now() - startTime;
      return { visibleNodes: nodes, lastCalculationTime: calcTime };
    }

    // Filter nodes based on viewport intersection
    const filtered = nodes.filter((node) =>
      isNodeInViewport(node, debouncedViewport, bufferPx)
    );

    const calcTime = performance.now() - startTime;
    return { visibleNodes: filtered, lastCalculationTime: calcTime };
  }, [nodes, debouncedViewport, bufferPx, threshold, enabled]);

  // Calculate metrics
  const metrics = useMemo(
    () => ({
      lastCalculationTime,
      renderRatio: nodes.length > 0 ? visibleNodes.length / nodes.length : 1,
    }),
    [lastCalculationTime, visibleNodes.length, nodes.length]
  );

  // Determine if virtualization is active
  const isVirtualized = enabled && nodes.length >= threshold;

  return {
    visibleNodes,
    totalNodes: nodes.length,
    renderedNodes: visibleNodes.length,
    isVirtualized,
    metrics,
  };
}

/**
 * Hook for tracking workflow editor performance metrics
 * 
 * Monitors frame rate, memory usage, and interaction responsiveness.
 * Useful for identifying performance bottlenecks during development.
 * 
 * @example
 * ```typescript
 * const { fps, memoryMB, avgRenderTime } = usePerformanceMetrics();
 * 
 * // Display in dev tools overlay
 * logger.debug(`FPS: ${fps}, Memory: ${memoryMB}MB, Render: ${avgRenderTime}ms`);
 * ```
 */
export function usePerformanceMetrics() {
  const [fps, setFps] = useState(60);
  const [memoryMB, setMemoryMB] = useState(0);
  const [avgRenderTime, setAvgRenderTime] = useState(0);
  
  const frameTimesRef = useRef<number[]>([]);
  const renderTimesRef = useRef<number[]>([]);
  const lastFrameTimeRef = useRef(performance.now());

  useEffect(() => {
    let animationFrameId: number;
    
    // Track FPS via requestAnimationFrame
    const measureFrame = (now: number) => {
      const delta = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      frameTimesRef.current.push(delta);
      if (frameTimesRef.current.length > 60) {
        frameTimesRef.current.shift();
      }

      // Calculate average FPS from last 60 frames
      const avgDelta = frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;

      // Guard against zero/negative deltas (can happen in tests or edge timing cases)
      if (avgDelta > 0) {
        const currentFps = Math.round(1000 / avgDelta);
        setFps(currentFps);
      }

      animationFrameId = requestAnimationFrame(measureFrame);
    };

    animationFrameId = requestAnimationFrame(measureFrame);

    // Track memory usage (if available)
    const memoryInterval = setInterval(() => {
      if ((performance as any).memory) {
        const usedMB = Math.round((performance as any).memory.usedJSHeapSize / 1048576);
        setMemoryMB(usedMB);
      }
    }, 1000);

    return () => {
      if (typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(animationFrameId);
      }
      clearInterval(memoryInterval);
    };
  }, []);

  // Public API for components to report render times
  const recordRenderTime = useCallback((time: number) => {
    renderTimesRef.current.push(time);
    if (renderTimesRef.current.length > 10) {
      renderTimesRef.current.shift();
    }
    
    const avg = renderTimesRef.current.reduce((a, b) => a + b, 0) / renderTimesRef.current.length;
    setAvgRenderTime(Math.round(avg * 100) / 100);
  }, []);

  return {
    fps,
    memoryMB,
    avgRenderTime,
    recordRenderTime,
  };
}

/**
 * Hook for optimistic UI updates with auto-save debouncing
 * 
 * Updates local state immediately for responsive UX, then syncs to backend
 * after user stops editing. Includes conflict resolution for multi-user scenarios.
 * 
 * @example
 * ```typescript
 * const { localData, updateLocal, isSaving, hasConflict } = useOptimisticUpdate({
 *   initialData: workflow,
 *   saveFunction: async (data) => workformsApi.put(`/workflows/${id}/`, data),
 *   debounceMs: 1000,
 * });
 * 
 * // User edits node
 * const handleNodeChange = (node) => {
 *   updateLocal({ ...localData, nodes: [...localData.nodes, node] });
 *   // Saves automatically after 1s of inactivity
 * };
 * ```
 */
export function useOptimisticUpdate<T>({
  initialData,
  saveFunction,
  debounceMs = 1000,
  onConflict,
}: {
  initialData: T;
  saveFunction: (data: T) => Promise<T>;
  debounceMs?: number;
  onConflict?: (local: T, remote: T) => T;
}) {
  const [localData, setLocalData] = useState<T>(initialData);
  const [remoteData, setRemoteData] = useState<T>(initialData);
  const [isSaving, setIsSaving] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingChangesRef = useRef(false);

  // Update local state immediately (optimistic)
  const updateLocal = useCallback((data: T | ((prev: T) => T)) => {
    setLocalData(data);
    pendingChangesRef.current = true;
    
    // Clear existing timer
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    // Schedule save after debounce period
    saveTimerRef.current = setTimeout(async () => {
      if (!pendingChangesRef.current) return;

      setIsSaving(true);
      try {
        const savedData = await saveFunction(
          typeof data === 'function' ? (data as any)(localData) : data
        );
        
        setRemoteData(savedData);
        pendingChangesRef.current = false;
        setHasConflict(false);
      } catch (error) {
        logger.error('Auto-save failed:', error);
        
        // Conflict detection (simplified - can be enhanced)
        if ((error as any).status === 409) {
          setHasConflict(true);
          if (onConflict) {
            const resolved = onConflict(localData, remoteData);
            setLocalData(resolved);
          }
        }
      } finally {
        setIsSaving(false);
      }
    }, debounceMs);
  }, [localData, remoteData, saveFunction, debounceMs, onConflict]);

  // Force immediate save (bypass debounce)
  const forceSave = useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    if (!pendingChangesRef.current) return;

    setIsSaving(true);
    try {
      const savedData = await saveFunction(localData);
      setRemoteData(savedData);
      pendingChangesRef.current = false;
      setHasConflict(false);
    } catch (error) {
      logger.error('Force save failed:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [localData, saveFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  return {
    localData,
    remoteData,
    updateLocal,
    forceSave,
    isSaving,
    hasConflict,
    hasPendingChanges: pendingChangesRef.current,
  };
}
