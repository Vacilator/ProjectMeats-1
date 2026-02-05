/**
 * Condition If/Else Node Component
 * 
 * Branches workflow based on a condition.
 * Has two output handles: true branch and false branch.
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */
import React from 'react';
import styled from 'styled-components';
import { NodeProps, Handle, Position } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ConditionRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'is_empty' | 'is_not_empty';
  value?: any;
}

export interface ConditionIfNodeData extends BaseNodeData {
  rules?: ConditionRule[];
  logicalOperator?: 'AND' | 'OR';
}

// ============================================================================
// Styled Components
// ============================================================================

const ConditionContainer = styled.div`
  position: relative;
`;

const RuleList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
`;

const RuleItem = styled.div`
  padding: 6px 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const RuleField = styled.span`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  font-family: monospace;
  font-size: 10px;
`;

const RuleOperator = styled.span`
  margin: 0 4px;
  color: rgb(var(--color-primary));
  font-weight: 600;
`;

const RuleValue = styled.span`
  font-style: italic;
  color: rgb(var(--color-text-secondary));
`;

const LogicalOperatorBadge = styled.div`
  display: inline-block;
  padding: 2px 8px;
  background: rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 700;
  color: rgb(59, 130, 246);
  margin-top: 6px;
`;

const BranchHandles = styled.div`
  position: absolute;
  bottom: -10px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: space-around;
`;

const BranchHandle = styled(Handle)<{ $type: 'true' | 'false' }>`
  width: 12px;
  height: 12px;
  background: ${props => props.$type === 'true' 
    ? 'rgb(34, 197, 94)' 
    : 'rgb(239, 68, 68)'};
  border: 2px solid rgb(var(--color-surface));
  position: relative !important;
  transform: none !important;
  
  &:hover {
    width: 16px;
    height: 16px;
  }
  
  &::before {
    content: '${props => props.$type === 'true' ? '✓' : '✗'}';
    position: absolute;
    top: -18px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: 700;
    color: ${props => props.$type === 'true' 
      ? 'rgb(34, 197, 94)' 
      : 'rgb(239, 68, 68)'};
    white-space: nowrap;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 12px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
  font-style: italic;
`;

// ============================================================================
// Operator Labels
// ============================================================================

const OPERATOR_LABELS: Record<string, string> = {
  equals: '=',
  not_equals: '≠',
  greater_than: '>',
  less_than: '<',
  contains: '⊃',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

// ============================================================================
// Component
// ============================================================================

export const ConditionIfNode: React.FC<NodeProps<ConditionIfNodeData>> = (props) => {
  const { data, selected, id } = props;
  const nodeTypeDef = getNodeTypeDefinition('conditionIf');
  
  // Safety check: provide fallback if nodeType is undefined
  const nodeType = nodeTypeDef || {
    id: 'conditionIf',
    name: 'If Condition',
    category: 'logic' as const,
    color: 'rgb(249, 115, 22)',
    icon: 'GitBranch',
    maxInputs: 1,
    maxOutputs: 2,
    config: {},
  };
  
  const { rules = [], logicalOperator = 'AND' } = data;

  return (
    <ConditionContainer>
      <BaseNode
        id={id}
        data={{...data, label: data.label || 'If Condition'}}
        selected={selected}
        nodeType={nodeType}
      >
        <div>
          {rules.length === 0 ? (
            <EmptyState>
              Click to add conditions
            </EmptyState>
          ) : (
            <>
              <RuleList>
                {rules.slice(0, 2).map((rule, index) => (
                  <RuleItem key={index}>
                    <RuleField>{rule.field}</RuleField>
                    <RuleOperator>{OPERATOR_LABELS[rule.operator] || rule.operator}</RuleOperator>
                    {rule.value !== undefined && (
                      <RuleValue>{String(rule.value)}</RuleValue>
                    )}
                  </RuleItem>
                ))}
              </RuleList>
              
              {rules.length > 2 && (
                <div style={{ 
                  textAlign: 'center', 
                  marginTop: 6,
                  fontSize: 11,
                  color: 'rgb(var(--color-text-secondary))',
                }}>
                  +{rules.length - 2} more rule{rules.length - 2 > 1 ? 's' : ''}
                </div>
              )}
              
              {rules.length > 1 && (
                <LogicalOperatorBadge>
                  {logicalOperator}
                </LogicalOperatorBadge>
              )}
            </>
          )}
        </div>
      </BaseNode>
      
      {/* True and False branch handles */}
      <BranchHandles>
        <BranchHandle
          type="source"
          position={Position.Bottom}
          id="true"
          $type="true"
        />
        <BranchHandle
          type="source"
          position={Position.Bottom}
          id="false"
          $type="false"
        />
      </BranchHandles>
    </ConditionContainer>
  );
};

export default ConditionIfNode;
