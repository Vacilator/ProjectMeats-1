/**
 * Parallel Path Node Component
 * 
 * Allows parallel execution branches in workflows.
 * Splits execution into multiple paths that run concurrently.
 * 
 * Use Cases:
 * - Send notifications to multiple channels simultaneously
 * - Process multiple records in parallel
 * - Execute independent tasks concurrently
 * 
 * Created: 2026-02-27 - Phase 7.4 Advanced Node Types (Task 6)
 */
import React from 'react';
import styled from 'styled-components';
import type { Node, NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ParallelPathNodeData extends BaseNodeData {
  /**
   * Number of parallel execution paths (2-10)
   */
  pathCount: number;
  
  /**
   * Path labels for better organization
   */
  pathLabels?: string[];
  
  /**
   * Wait strategy:
   * - 'all': Wait for all paths to complete before continuing
   * - 'any': Continue when any path completes
   * - 'none': Fire and forget (don't wait)
   */
  waitStrategy: 'all' | 'any' | 'none';
  
  /**
   * Timeout in seconds (optional)
   */
  timeout?: number;
  
  /**
   * Error handling:
   * - 'stop': Stop all paths if any fails
   * - 'continue': Continue other paths even if one fails
   */
  errorStrategy: 'stop' | 'continue';
}

// ============================================================================
// Styled Components
// ============================================================================

const PathsContainer = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const PathIndicator = styled.div<{ $index: number }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: rgba(139, 92, 246, 0.1);
  border-left: 3px solid rgb(139, 92, 246);
  border-radius: 4px;
  font-size: 11px;
`;

const PathNumber = styled.span`
  font-weight: 700;
  color: rgb(139, 92, 246);
  min-width: 24px;
`;

const PathLabel = styled.span`
  flex: 1;
  color: rgb(var(--color-text-secondary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StrategyBadge = styled.span<{ $type: 'wait' | 'error' }>`
  display: inline-block;
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  background: ${props => props.$type === 'wait' 
    ? 'rgba(59, 130, 246, 0.15)' 
    : 'rgba(239, 68, 68, 0.15)'};
  color: ${props => props.$type === 'wait' 
    ? 'rgb(59, 130, 246)' 
    : 'rgb(239, 68, 68)'};
`;

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
`;

const ConfigLabel = styled.span`
  font-size: 10px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 12px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
  font-style: italic;
`;

// ============================================================================
// Component
// ============================================================================

export const ParallelPathNode: React.FC<NodeProps<Node<ParallelPathNodeData>>> = (props) => {
  const { data } = props;
  const nodeTypeDef = getNodeTypeDefinition('parallelPath');
  
  const pathCount = data.pathCount || 2;
  const pathLabels = data.pathLabels || [];
  const waitStrategy = data.waitStrategy || 'all';
  const errorStrategy = data.errorStrategy || 'stop';
  
  // Generate default path labels if not provided
  const displayLabels = Array.from({ length: pathCount }, (_, i) => 
    pathLabels[i] || `Path ${i + 1}`
  );
  
  const waitStrategyLabel = {
    all: 'Wait for All',
    any: 'Wait for Any',
    none: 'Fire & Forget'
  }[waitStrategy];
  
  const errorStrategyLabel = {
    stop: 'Stop on Error',
    continue: 'Continue on Error'
  }[errorStrategy];
  
  const renderContent = () => {
    if (!data.label && pathCount === 2) {
      return (
        <EmptyState>
          Configure parallel execution paths
        </EmptyState>
      );
    }
    
    return (
      <PathsContainer>
        <ConfigRow>
          <ConfigLabel>Paths ({pathCount})</ConfigLabel>
          <div style={{ display: 'flex', gap: '4px' }}>
            <StrategyBadge $type="wait">{waitStrategyLabel}</StrategyBadge>
            <StrategyBadge $type="error">{errorStrategyLabel}</StrategyBadge>
          </div>
        </ConfigRow>
        
        {displayLabels.map((label, index) => (
          <PathIndicator key={index} $index={index}>
            <PathNumber>#{index + 1}</PathNumber>
            <PathLabel>{label}</PathLabel>
          </PathIndicator>
        ))}
        
        {data.timeout && (
          <ConfigRow style={{ marginTop: '4px' }}>
            <ConfigLabel>Timeout</ConfigLabel>
            <span style={{ fontSize: '10px', color: 'rgb(var(--color-text-secondary))' }}>
              {data.timeout}s
            </span>
          </ConfigRow>
        )}
      </PathsContainer>
    );
  };
  
  return (
    <BaseNode
      {...props}
      nodeType={nodeTypeDef}
    >
      {renderContent()}
    </BaseNode>
  );
};
