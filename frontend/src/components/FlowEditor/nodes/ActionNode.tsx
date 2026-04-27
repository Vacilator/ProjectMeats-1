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
import type { Node, NodeProps } from '@xyflow/react';
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

const ConfigValue = styled.span<{ $empty?: boolean }>`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  color: ${(p) => (p.$empty ? 'rgb(var(--color-text-tertiary))' : 'rgb(var(--color-text-secondary))')};
  font-style: ${(p) => (p.$empty ? 'italic' : 'normal')};
  font-family: monospace;
  font-size: 10px;
  background: rgba(var(--color-overlay), 0.05);
  padding: 2px 4px;
  border-radius: 2px;
`;

const ActionBadge = styled.span<{ $type: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  background: rgba(var(--color-primary), 0.2);
  color: rgb(var(--color-primary));
  margin-bottom: 6px;
`;


// ============================================================================
// Helper Functions
// ============================================================================

type ActionDetailItem = { label: string; value?: unknown };

function getActionDetails(data: ActionNodeData): { mainItems: ActionDetailItem[]; extraItems: ActionDetailItem[] } {
  const { actionType } = data;

  const asList = (items: ActionDetailItem[]) => items.filter((i) => i.value !== undefined && i.value !== null && i.value !== '');

  switch (actionType) {
    case 'email': {
      const mainItems = [
        { label: 'To', value: data.to },
        { label: 'Subject', value: data.subject },
        { label: 'Template', value: data.template },
      ];
      return { mainItems, extraItems: [] };
    }

    case 'notify': {
      const mainItems = [
        { label: 'User', value: data.userId },
        { label: 'Message', value: data.message },
        { label: 'Priority', value: data.priority },
      ];
      return { mainItems, extraItems: [] };
    }

    case 'createRecord':
    case 'updateRecord':
    case 'deleteRecord': {
      const fieldsValue = (data.fields ?? (data as any).fieldMappings) as any;

      const fieldSummary = Array.isArray(fieldsValue)
        ? `${fieldsValue.length} mapping(s)`
        : fieldsValue && typeof fieldsValue === 'object'
          ? Object.keys(fieldsValue).join(', ')
          : undefined;

      const mainItems = [
        { label: 'Entity', value: (data.entity ?? (data as any).entityType) as any },
        { label: 'Record ID', value: data.recordId },
        { label: 'Fields', value: fieldSummary },
      ];
      return { mainItems, extraItems: [] };
    }

    case 'http': {
      const mainItems = [
        { label: 'Method', value: data.method },
        { label: 'URL', value: data.url },
        { label: 'Headers', value: data.headers ? `${Object.keys(data.headers).length} header(s)` : undefined },
      ];
      const extraItems = asList([
        { label: 'Body', value: data.body ? 'Set' : undefined },
      ]);
      return { mainItems, extraItems };
    }

    case 'script': {
      const mainItems = [
        { label: 'Language', value: data.language },
        { label: 'Lines', value: data.code ? `${data.code.split('\n').length} lines` : undefined },
      ];
      return { mainItems, extraItems: [] };
    }

    default:
      return { mainItems: [], extraItems: [] };
  }
}

// ============================================================================
// Component
// ============================================================================

export const ActionNode = React.memo<NodeProps<Node<ActionNodeData>>>((props) => {
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
  
  const nodeTypeDef = getNodeTypeDefinition(nodeTypeMap[actionType]) || getNodeTypeDefinition('actionEmail');
  
  // Safety check: if nodeType is still undefined, provide a fallback
  const nodeType = nodeTypeDef || {
    id: 'actionEmail',
    name: 'Send Email',
    category: 'action' as const,
    color: 'rgb(var(--color-primary))',
    icon: '✉️',
    description: 'Send an email',
    maxInputs: 1,
    maxOutputs: 1,
  };
  
  const { mainItems, extraItems } = getActionDetails(data);

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
        
        <ActionConfig>
          {mainItems.slice(0, 3).map((item, index) => {
            const empty = item.value === undefined || item.value === null || item.value === '';
            return (
              <ConfigRow key={index}>
                <ConfigLabel>{item.label}:</ConfigLabel>
                <ConfigValue $empty={empty}>{empty ? 'Not set' : String(item.value)}</ConfigValue>
              </ConfigRow>
            );
          })}
          {extraItems.length > 0 && (
            <ConfigRow>
              <span
                style={{
                  fontSize: 10,
                  color: 'rgb(var(--color-text-tertiary))',
                  fontStyle: 'italic',
                }}
              >
                +{extraItems.length} more setting{extraItems.length > 1 ? 's' : ''}
              </span>
            </ConfigRow>
          )}
        </ActionConfig>
      </div>
    </BaseNode>
  );
});

export default ActionNode;
