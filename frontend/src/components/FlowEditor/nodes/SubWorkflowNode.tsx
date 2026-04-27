/**
 * Sub-Workflow Node Component
 * 
 * Container node that references existing workflows.
 * Enables workflow reusability and composition.
 * 
 * Use Cases:
 * - Call shared approval workflows
 * - Reuse common data validation flows
 * - Compose complex workflows from smaller ones
 * - Implement workflow libraries
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

export interface SubWorkflowNodeData extends BaseNodeData {
  /**
   * ID of the workflow to execute
   */
  workflowId?: string;
  
  /**
   * Name of the referenced workflow (for display)
   */
  workflowName?: string;
  
  /**
   * Input mapping: Map parent workflow variables to sub-workflow inputs
   */
  inputMapping?: Record<string, string>;
  
  /**
   * Output mapping: Map sub-workflow outputs back to parent variables
   */
  outputMapping?: Record<string, string>;
  
  /**
   * Pass all parent context to sub-workflow
   */
  inheritContext?: boolean;
  
  /**
   * Wait for sub-workflow completion
   */
  waitForCompletion?: boolean;
  
  /**
   * Timeout in seconds (optional)
   */
  timeout?: number;
  
  /**
   * Error handling:
   * - 'fail': Fail parent workflow if sub-workflow fails
   * - 'continue': Continue parent workflow even if sub-workflow fails
   * - 'retry': Retry sub-workflow on failure
   */
  errorHandling?: 'fail' | 'continue' | 'retry';
  
  /**
   * Number of retry attempts (if errorHandling is 'retry')
   */
  retryCount?: number;
  
  /**
   * Workflow version (optional, defaults to latest)
   */
  version?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const WorkflowContainer = styled.div`
  margin-top: 8px;
  padding: 10px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  border: 1px dashed rgb(var(--color-border));
`;

const WorkflowHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const WorkflowIcon = styled.div`
  width: 24px;
  height: 24px;
  border-radius: 4px;
  background: linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary)) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-inverse));
  font-size: 14px;
  font-weight: 700;
`;

const WorkflowName = styled.div`
  flex: 1;
  font-weight: 600;
  font-size: 12px;
  color: rgb(var(--color-text-primary));
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const VersionBadge = styled.span`
  padding: 2px 6px;
  background: rgba(var(--color-primary), 0.15);
  color: rgb(var(--color-primary));
  font-size: 9px;
  font-weight: 600;
  border-radius: var(--radius-sm);
`;

const MappingSection = styled.div`
  margin-top: 8px;
`;

const MappingLabel = styled.div`
  font-size: 10px;
  font-weight: 600;
  color: rgb(var(--color-text-tertiary));
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
`;

const MappingList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const MappingItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  padding: 3px 6px;
  background: rgba(var(--color-primary), 0.05);
  border-radius: 3px;
`;

const MappingKey = styled.span`
  font-weight: 600;
  color: rgb(var(--color-text-secondary));
  font-family: monospace;
`;

const MappingArrow = styled.span`
  color: rgb(var(--color-text-tertiary));
  font-size: 10px;
`;

const MappingValue = styled.span`
  flex: 1;
  color: rgb(var(--color-text-secondary));
  font-family: monospace;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 6px;
  padding-top: 6px;
  border-top: 1px solid rgb(var(--color-border));
`;

const ConfigOption = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  color: rgb(var(--color-text-secondary));
`;

const ConfigIcon = styled.span<{ $active: boolean }>`
  color: ${props => props.$active 
    ? 'rgb(var(--color-success))' 
    : 'rgb(var(--color-text-tertiary))'};
  font-size: 11px;
`;

const ErrorStrategyBadge = styled.span<{ $strategy: string }>`
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 9px;
  font-weight: 600;
  background: ${props => {
    switch (props.$strategy) {
      case 'fail': return 'rgba(var(--color-error), 0.15)';
      case 'continue': return 'rgba(var(--color-warning), 0.15)';
      case 'retry': return 'rgba(var(--color-info), 0.15)';
      default: return 'rgba(var(--color-overlay), 0.05)';
    }
  }};
  color: ${props => {
    switch (props.$strategy) {
      case 'fail': return 'rgb(var(--color-error))';
      case 'continue': return 'rgb(var(--color-warning))';
      case 'retry': return 'rgb(var(--color-info))';
      default: return 'rgb(var(--color-text-secondary))';
    }
  }};
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 16px 12px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
  font-style: italic;
`;

// ============================================================================
// Component
// ============================================================================

export const SubWorkflowNode: React.FC<NodeProps<Node<SubWorkflowNodeData>>> = (props) => {
  const { data } = props;
  const nodeTypeDef = getNodeTypeDefinition('subWorkflow');
  
  const errorHandling = data.errorHandling || 'fail';
  const waitForCompletion = data.waitForCompletion !== false; // Default true
  const inheritContext = data.inheritContext || false;
  
  const errorStrategyLabel = {
    fail: 'Fail Parent',
    continue: 'Continue',
    retry: `Retry (${data.retryCount || 3}x)`
  }[errorHandling];
  
  const renderContent = () => {
    if (!data.workflowId && !data.workflowName) {
      return (
        <EmptyState>
          Select a workflow to execute
        </EmptyState>
      );
    }
    
    const inputMappings = Object.entries(data.inputMapping || {});
    const outputMappings = Object.entries(data.outputMapping || {});
    
    return (
      <WorkflowContainer>
        <WorkflowHeader>
          <WorkflowIcon>⚡</WorkflowIcon>
          <WorkflowName>{data.workflowName || 'Unnamed Workflow'}</WorkflowName>
          {data.version && <VersionBadge>v{data.version}</VersionBadge>}
        </WorkflowHeader>
        
        {inputMappings.length > 0 && (
          <MappingSection>
            <MappingLabel>Inputs</MappingLabel>
            <MappingList>
              {inputMappings.slice(0, 3).map(([key, value]) => (
                <MappingItem key={key}>
                  <MappingKey>{key}</MappingKey>
                  <MappingArrow>←</MappingArrow>
                  <MappingValue>{value}</MappingValue>
                </MappingItem>
              ))}
              {inputMappings.length > 3 && (
                <MappingItem>
                  <span style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: '10px' }}>
                    +{inputMappings.length - 3} more
                  </span>
                </MappingItem>
              )}
            </MappingList>
          </MappingSection>
        )}
        
        {outputMappings.length > 0 && (
          <MappingSection>
            <MappingLabel>Outputs</MappingLabel>
            <MappingList>
              {outputMappings.slice(0, 3).map(([key, value]) => (
                <MappingItem key={key}>
                  <MappingKey>{key}</MappingKey>
                  <MappingArrow>→</MappingArrow>
                  <MappingValue>{value}</MappingValue>
                </MappingItem>
              ))}
              {outputMappings.length > 3 && (
                <MappingItem>
                  <span style={{ color: 'rgb(var(--color-text-tertiary))', fontSize: '10px' }}>
                    +{outputMappings.length - 3} more
                  </span>
                </MappingItem>
              )}
            </MappingList>
          </MappingSection>
        )}
        
        <ConfigRow>
          <div style={{ display: 'flex', gap: '8px' }}>
            <ConfigOption>
              <ConfigIcon $active={waitForCompletion}>●</ConfigIcon>
              <span>Wait</span>
            </ConfigOption>
            <ConfigOption>
              <ConfigIcon $active={inheritContext}>●</ConfigIcon>
              <span>Context</span>
            </ConfigOption>
          </div>
          <ErrorStrategyBadge $strategy={errorHandling}>
            {errorStrategyLabel}
          </ErrorStrategyBadge>
        </ConfigRow>
        
        {data.timeout && (
          <ConfigRow style={{ borderTop: 'none', marginTop: '2px', paddingTop: '2px' }}>
            <span style={{ fontSize: '10px', color: 'rgb(var(--color-text-tertiary))' }}>
              Timeout: {data.timeout}s
            </span>
          </ConfigRow>
        )}
      </WorkflowContainer>
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
