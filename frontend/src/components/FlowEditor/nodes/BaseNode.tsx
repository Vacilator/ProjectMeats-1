/**
 * Base Node Component
 * 
 * Foundation for all flow editor nodes.
 * Provides consistent styling, status indicators, and connection handles.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */
import React from 'react';
import styled from 'styled-components';
import { Handle, Position } from '@xyflow/react';
import { NodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface BaseNodeData {
  label?: string;
  status?: 'draft' | 'active' | 'error' | 'disabled';
  stepNumber?: number;
  errorMessage?: string;
  config?: Record<string, any>;
}

export interface BaseNodeProps {
  id: string;
  data: BaseNodeData;
  selected?: boolean;
  nodeType: NodeTypeDefinition;
}

// ============================================================================
// Styled Components
// ============================================================================

const NodeContainer = styled.div<{ 
  $color: string; 
  $selected: boolean; 
  $status: string;
}>`
  min-width: 180px;
  background: rgb(var(--color-surface));
  border: 2px solid ${props => {
    if (props.$selected) return props.$color;
    if (props.$status === 'error') return 'rgb(239, 68, 68)';
    return 'rgb(var(--color-border))';
  }};
  border-radius: var(--radius-lg);
  padding: 0;
  box-shadow: ${props => props.$selected 
    ? '0 4px 12px rgba(0, 0, 0, 0.15)' 
    : '0 2px 6px rgba(0, 0, 0, 0.1)'};
  transition: all 0.2s ease;
  
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

const NodeHeader = styled.div<{ $color: string }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: ${props => props.$color};
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  color: white;
  font-weight: 600;
  font-size: 13px;
`;

const NodeIcon = styled.span`
  font-size: 16px;
  line-height: 1;
`;

const NodeTitle = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StepNumber = styled.span`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: rgba(255, 255, 255, 0.3);
  border-radius: 50%;
  font-size: 11px;
  font-weight: 700;
`;

const NodeBody = styled.div`
  padding: 12px;
`;

const NodeContent = styled.div`
  color: rgb(var(--color-text-primary));
  font-size: 12px;
`;

const ConfigPreview = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const StatusIndicator = styled.div<{ $status: string }>`
  position: absolute;
  top: -6px;
  right: -6px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid rgb(var(--color-surface));
  background: ${props => {
    switch (props.$status) {
      case 'active': return 'rgb(34, 197, 94)'; // green
      case 'error': return 'rgb(239, 68, 68)'; // red
      case 'disabled': return 'rgb(148, 163, 184)'; // gray
      default: return 'rgb(234, 179, 8)'; // yellow (draft)
    }
  }};
`;

const ErrorMessage = styled.div`
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgb(239, 68, 68);
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: rgb(239, 68, 68);
`;

const StyledHandle = styled(Handle)<{ $color: string }>`
  width: 10px;
  height: 10px;
  background: ${props => props.$color};
  border: 2px solid rgb(var(--color-surface));
  
  &:hover {
    width: 14px;
    height: 14px;
  }
`;

// ============================================================================
// Component
// ============================================================================

export const BaseNode: React.FC<BaseNodeProps & { children?: React.ReactNode }> = ({
  id,
  data,
  selected = false,
  nodeType,
  children,
}) => {
  const {
    label = nodeType.name,
    status = 'draft',
    stepNumber,
    errorMessage,
    config,
  } = data;

  const showInputHandle = nodeType.maxInputs !== 0;
  const showOutputHandle = nodeType.maxOutputs !== 0;

  return (
    <NodeContainer 
      $color={nodeType.color} 
      $selected={selected}
      $status={status}
    >
      {/* Input Handle */}
      {showInputHandle && (
        <StyledHandle
          type="target"
          position={Position.Top}
          id="input"
          $color={nodeType.color}
        />
      )}

      {/* Status Indicator */}
      <StatusIndicator $status={status} />

      {/* Header */}
      <NodeHeader $color={nodeType.color}>
        <NodeIcon>{nodeType.icon}</NodeIcon>
        <NodeTitle>{label}</NodeTitle>
        {stepNumber && <StepNumber>{stepNumber}</StepNumber>}
      </NodeHeader>

      {/* Body */}
      <NodeBody>
        <NodeContent>
          {children || (
            <>
              <div>{nodeType.description}</div>
              
              {config && Object.keys(config).length > 0 && (
                <ConfigPreview>
                  {Object.entries(config).slice(0, 2).map(([key, value]) => (
                    <div key={key}>
                      <strong>{key}:</strong> {String(value).substring(0, 30)}
                      {String(value).length > 30 ? '...' : ''}
                    </div>
                  ))}
                </ConfigPreview>
              )}
              
              {errorMessage && (
                <ErrorMessage>{errorMessage}</ErrorMessage>
              )}
            </>
          )}
        </NodeContent>
      </NodeBody>

      {/* Output Handle */}
      {showOutputHandle && (
        <StyledHandle
          type="source"
          position={Position.Bottom}
          id="output"
          $color={nodeType.color}
        />
      )}
      
      {/* Error Route Handle (if applicable) */}
      {nodeType.hasErrorRoute && (
        <StyledHandle
          type="source"
          position={Position.Right}
          id="error"
          $color="rgb(239, 68, 68)"
          style={{ top: '50%' }}
        />
      )}
    </NodeContainer>
  );
};

export default BaseNode;
