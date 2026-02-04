/**
 * Action Node Component
 * 
 * Generic action node that can be configured for different action types:
 * - Send Email
 * - Create/Update/Delete Record
 * - HTTP Request
 * - Notify User
 * - Run Script
 * 
 * Created: 2026-02-04 - Phase 2.1 Visual Editor Foundation
 */
import React from 'react';
import styled from 'styled-components';
import { NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface ActionNodeData extends BaseNodeData {
  actionType: 'email' | 'notify' | 'createRecord' | 'updateRecord' | 'deleteRecord' | 'http' | 'script';
  
  // Email-specific
  to?: string;
  subject?: string;
  template?: string;
  
  // Record-specific
  entity?: string;
  recordId?: string;
  fields?: Record<string, any>;
  
  // HTTP-specific
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  
  // Script-specific
  language?: 'javascript' | 'python';
  code?: string;
  
  // Notification-specific
  userId?: string;
  message?: string;
  priority?: 'low' | 'normal' | 'high';
}

// ============================================================================
// Styled Components
// ============================================================================

const ActionConfig = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const ConfigRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 11px;
`;

const ConfigLabel = styled.span`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  min-width: 50px;
`;

const ConfigValue = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: rgb(var(--color-text-secondary));
  font-family: monospace;
  font-size: 10px;
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 4px;
  border-radius: 2px;
`;

const ActionBadge = styled.span<{ $type: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  background: rgba(139, 92, 246, 0.2);
  color: rgb(139, 92, 246);
  margin-bottom: 6px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 12px;
  color: rgb(var(--color-text-tertiary));
  font-size: 11px;
  font-style: italic;
`;

// ============================================================================
// Helper Functions
// ============================================================================

function getActionDetails(data: ActionNodeData) {
  const { actionType } = data;
  
  switch (actionType) {
    case 'email':
      return {
        items: [
          { label: 'To', value: data.to },
          { label: 'Subject', value: data.subject },
          { label: 'Template', value: data.template },
        ].filter(item => item.value),
      };
      
    case 'notify':
      return {
        items: [
          { label: 'User', value: data.userId },
          { label: 'Message', value: data.message },
          { label: 'Priority', value: data.priority },
        ].filter(item => item.value),
      };
      
    case 'createRecord':
    case 'updateRecord':
    case 'deleteRecord':
      return {
        items: [
          { label: 'Entity', value: data.entity },
          ...(data.recordId ? [{ label: 'Record ID', value: data.recordId }] : []),
          ...(data.fields ? [{ label: 'Fields', value: Object.keys(data.fields).join(', ') }] : []),
        ],
      };
      
    case 'http':
      return {
        items: [
          { label: 'Method', value: data.method },
          { label: 'URL', value: data.url },
          ...(data.headers ? [{ label: 'Headers', value: `${Object.keys(data.headers).length} header(s)` }] : []),
        ].filter(item => item.value),
      };
      
    case 'script':
      return {
        items: [
          { label: 'Language', value: data.language },
          ...(data.code ? [{ label: 'Lines', value: `${data.code.split('\n').length} lines` }] : []),
        ].filter(item => item.value),
      };
      
    default:
      return { items: [] };
  }
}

// ============================================================================
// Component
// ============================================================================

export const ActionNode: React.FC<NodeProps<ActionNodeData>> = (props) => {
  const { data, selected, id } = props;
  const { actionType = 'email' } = data; // Default to 'email' if undefined
  
  // Get the appropriate node type definition
  const nodeTypeMap = {
    email: 'actionEmail',
    notify: 'actionNotify',
    createRecord: 'actionCreateRecord',
    updateRecord: 'actionUpdateRecord',
    deleteRecord: 'actionDeleteRecord',
    http: 'actionHTTP',
    script: 'actionScript',
  };
  
  const nodeType = getNodeTypeDefinition(nodeTypeMap[actionType]) || getNodeTypeDefinition('actionEmail')!;
  const { items } = getActionDetails(data);

  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeType={nodeType}
    >
      <div>
        <ActionBadge $type={actionType}>
          {(actionType || 'email').replace(/([A-Z])/g, ' $1').trim().toUpperCase()}
        </ActionBadge>
        
        {items.length === 0 ? (
          <EmptyState>
            Click to configure action
          </EmptyState>
        ) : (
          <ActionConfig>
            {items.slice(0, 3).map((item, index) => (
              <ConfigRow key={index}>
                <ConfigLabel>{item.label}:</ConfigLabel>
                <ConfigValue>{String(item.value)}</ConfigValue>
              </ConfigRow>
            ))}
            {items.length > 3 && (
              <ConfigRow>
                <span style={{ 
                  fontSize: 10, 
                  color: 'rgb(var(--color-text-tertiary))',
                  fontStyle: 'italic',
                }}>
                  +{items.length - 3} more setting{items.length - 3 > 1 ? 's' : ''}
                </span>
              </ConfigRow>
            )}
          </ActionConfig>
        )}
      </div>
    </BaseNode>
  );
};

export default ActionNode;
