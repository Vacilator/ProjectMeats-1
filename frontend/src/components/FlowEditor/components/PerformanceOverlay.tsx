/**
 * @fileoverview Development overlay for performance monitoring
 * @module FlowEditor/components/PerformanceOverlay
 * 
 * Displays real-time performance metrics during development.
 * Automatically hidden in production builds.
 * 
 * @see Phase 7.5: Performance Optimization
 */

import React, { useState, useEffect } from 'styled';
import styled, { keyframes } from 'styled-components';
import { usePerformanceMetrics } from '../hooks/useVirtualizedNodes';

/**
 * Props for PerformanceOverlay component
 */
export interface PerformanceOverlayProps {
  /**
   * Current node count in workflow
   */
  totalNodes: number;

  /**
   * Number of nodes currently rendered (after virtualization)
   */
  renderedNodes: number;

  /**
   * Whether to show detailed metrics
   * @default false
   */
  showDetailed?: boolean;

  /**
   * Position of overlay
   * @default 'top-right'
   */
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

  /**
   * Whether overlay is visible
   * @default true in development, false in production
   */
  visible?: boolean;
}

// Pulse animation for warning indicators
const pulse = keyframes`
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.6;
  }
`;

// Styled components
const OverlayContainer = styled.div<{
  $position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}>`
  position: fixed;
  ${(props) => {
    switch (props.$position) {
      case 'top-left':
        return 'top: 16px; left: 16px;';
      case 'top-right':
        return 'top: 16px; right: 16px;';
      case 'bottom-left':
        return 'bottom: 16px; left: 16px;';
      case 'bottom-right':
        return 'bottom: 16px; right: 16px;';
    }
  }}
  
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 12px 16px;
  font-family: 'SF Mono', 'Monaco', 'Cascadia Code', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: rgb(var(--color-text-primary, 255, 255, 255));
  z-index: 9999;
  min-width: 200px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  user-select: none;
  
  /* Prevent overlay from blocking interactions */
  pointer-events: auto;
`;

const MetricRow = styled.div<{ $warning?: boolean }>`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  
  &:last-child {
    margin-bottom: 0;
  }
  
  ${(props) => props.$warning && `
    animation: ${pulse} 1.5s ease-in-out infinite;
  `}
`;

const MetricLabel = styled.span`
  color: rgba(255, 255, 255, 0.7);
  margin-right: 16px;
`;

const MetricValue = styled.span<{ $color?: string }>`
  font-weight: 600;
  color: ${(props) => props.$color || 'rgb(var(--color-success, 34, 197, 94))'};
`;

const Divider = styled.div`
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin: 12px 0;
`;

const Badge = styled.span<{ $type: 'success' | 'warning' | 'error' }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  
  ${(props) => {
    switch (props.$type) {
      case 'success':
        return `
          background: rgba(34, 197, 94, 0.2);
          color: rgb(34, 197, 94);
          border: 1px solid rgba(34, 197, 94, 0.4);
        `;
      case 'warning':
        return `
          background: rgba(234, 179, 8, 0.2);
          color: rgb(234, 179, 8);
          border: 1px solid rgba(234, 179, 8, 0.4);
        `;
      case 'error':
        return `
          background: rgba(239, 68, 68, 0.2);
          color: rgb(239, 68, 68);
          border: 1px solid rgba(239, 68, 68, 0.4);
        `;
    }
  }}
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
`;

const Title = styled.div`
  font-weight: 700;
  font-size: 13px;
  color: rgb(var(--color-primary, 102, 126, 234));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const ToggleButton = styled.button`
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  font-size: 18px;
  cursor: pointer;
  padding: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s;
  
  &:hover {
    color: rgba(255, 255, 255, 0.9);
  }
`;

/**
 * Get performance status badge based on FPS
 */
function getPerformanceBadge(fps: number): { type: 'success' | 'warning' | 'error'; label: string } {
  if (fps >= 55) {
    return { type: 'success', label: 'Excellent' };
  } else if (fps >= 30) {
    return { type: 'warning', label: 'Good' };
  } else {
    return { type: 'error', label: 'Poor' };
  }
}

/**
 * Format number with appropriate suffix (K, M)
 */
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Performance overlay component for development monitoring
 * 
 * Displays real-time metrics:
 * - FPS (frames per second)
 * - Memory usage (MB)
 * - Node rendering stats
 * - Average render time
 * 
 * Automatically hidden in production builds unless explicitly enabled.
 * 
 * @example
 * ```typescript
 * <ReactFlow nodes={nodes} edges={edges}>
 *   <PerformanceOverlay
 *     totalNodes={nodes.length}
 *     renderedNodes={visibleNodes.length}
 *     position="top-right"
 *     showDetailed={true}
 *   />
 * </ReactFlow>
 * ```
 */
export const PerformanceOverlay: React.FC<PerformanceOverlayProps> = ({
  totalNodes,
  renderedNodes,
  showDetailed = false,
  position = 'top-right',
  visible = process.env.NODE_ENV !== 'production',
}) => {
  const { fps, memoryMB, avgRenderTime } = usePerformanceMetrics();
  const [isExpanded, setIsExpanded] = useState(showDetailed);

  // Hide in production unless explicitly enabled
  if (!visible) {
    return null;
  }

  const performanceBadge = getPerformanceBadge(fps);
  const virtualizationRatio = totalNodes > 0 ? (renderedNodes / totalNodes) * 100 : 100;
  const isVirtualized = virtualizationRatio < 100;

  // Performance warnings
  const lowFps = fps < 30;
  const highMemory = memoryMB > 500;
  const slowRender = avgRenderTime > 16; // > 16ms = < 60fps

  return (
    <OverlayContainer $position={position}>
      <Header>
        <Title>⚡ Performance</Title>
        <ToggleButton
          onClick={() => setIsExpanded(!isExpanded)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </ToggleButton>
      </Header>

      {/* Always show FPS */}
      <MetricRow $warning={lowFps}>
        <MetricLabel>FPS:</MetricLabel>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MetricValue
            $color={
              fps >= 55
                ? 'rgb(34, 197, 94)'
                : fps >= 30
                ? 'rgb(234, 179, 8)'
                : 'rgb(239, 68, 68)'
            }
          >
            {fps}
          </MetricValue>
          <Badge $type={performanceBadge.type}>{performanceBadge.label}</Badge>
        </div>
      </MetricRow>

      {isExpanded && (
        <>
          <Divider />

          {/* Nodes */}
          <MetricRow>
            <MetricLabel>Nodes:</MetricLabel>
            <MetricValue>
              {formatNumber(renderedNodes)} / {formatNumber(totalNodes)}
            </MetricValue>
          </MetricRow>

          {isVirtualized && (
            <MetricRow>
              <MetricLabel>Rendered:</MetricLabel>
              <MetricValue $color="rgb(102, 126, 234)">
                {virtualizationRatio.toFixed(1)}%
              </MetricValue>
            </MetricRow>
          )}

          {/* Memory */}
          {memoryMB > 0 && (
            <MetricRow $warning={highMemory}>
              <MetricLabel>Memory:</MetricLabel>
              <MetricValue
                $color={
                  highMemory
                    ? 'rgb(239, 68, 68)'
                    : 'rgb(34, 197, 94)'
                }
              >
                {memoryMB} MB
              </MetricValue>
            </MetricRow>
          )}

          {/* Render time */}
          {avgRenderTime > 0 && (
            <MetricRow $warning={slowRender}>
              <MetricLabel>Render:</MetricLabel>
              <MetricValue
                $color={
                  slowRender
                    ? 'rgb(239, 68, 68)'
                    : avgRenderTime > 10
                    ? 'rgb(234, 179, 8)'
                    : 'rgb(34, 197, 94)'
                }
              >
                {avgRenderTime.toFixed(2)} ms
              </MetricValue>
            </MetricRow>
          )}

          {/* Warnings */}
          {(lowFps || highMemory || slowRender) && (
            <>
              <Divider />
              <MetricRow>
                <MetricLabel style={{ color: 'rgb(239, 68, 68)' }}>
                  ⚠️ Warnings:
                </MetricLabel>
              </MetricRow>
              {lowFps && (
                <MetricRow>
                  <MetricLabel style={{ fontSize: '11px', marginLeft: '8px' }}>
                    Low frame rate detected
                  </MetricLabel>
                </MetricRow>
              )}
              {highMemory && (
                <MetricRow>
                  <MetricLabel style={{ fontSize: '11px', marginLeft: '8px' }}>
                    High memory usage
                  </MetricLabel>
                </MetricRow>
              )}
              {slowRender && (
                <MetricRow>
                  <MetricLabel style={{ fontSize: '11px', marginLeft: '8px' }}>
                    Slow render times
                  </MetricLabel>
                </MetricRow>
              )}
            </>
          )}
        </>
      )}
    </OverlayContainer>
  );
};

export default PerformanceOverlay;
