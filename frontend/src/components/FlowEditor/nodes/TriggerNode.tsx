/**
 * Trigger Node Component
 * 
 * Entry point for workflows. Supports multiple trigger types:
 * - Manual (button click)
 * - Schedule (cron/time-based)
 * - Webhook (external API)
 * - Event (record changes)
 * - Form submit
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

export interface TriggerNodeData extends BaseNodeData {
  // `formSubmit` is legacy drift from earlier editor defaults; normalize it to `form` at runtime.
  triggerType: 'manual' | 'schedule' | 'webhook' | 'event' | 'form' | 'formSubmit';
  schedule?: string; // cron expression
  webhookUrl?: string;
  eventEntity?: string;
  eventType?: 'create' | 'update' | 'delete';
  formId?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const TriggerConfig = styled.div`
  margin-top: 8px;
  padding: 8px;
  background: rgb(var(--color-background));
  border-radius: var(--radius-sm);
`;

const ConfigRow = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  
  & + & {
    margin-top: 4px;
  }
`;

const ConfigLabel = styled.span`
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const ConfigValue = styled.span`
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: monospace;
  font-size: 10px;
  background: rgba(var(--color-overlay), 0.05);
  padding: 2px 4px;
  border-radius: 2px;
`;

const TriggerBadge = styled.span<{ $type: string }>`
  display: inline-block;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 600;
  background: ${props => {
    switch (props.$type) {
      case 'manual': return 'rgba(var(--color-success), 0.2)';
      case 'schedule': return 'rgba(var(--color-info), 0.2)';
      case 'webhook': return 'rgba(var(--color-info), 0.2)';
      case 'event': return 'rgba(var(--color-warning), 0.2)';
      case 'form': return 'rgba(var(--color-primary), 0.2)';
      default: return 'rgba(var(--color-border), 0.2)';
    }
  }};
  color: ${props => {
    switch (props.$type) {
      case 'manual': return 'rgb(var(--color-success))';
      case 'schedule': return 'rgb(var(--color-info))';
      case 'webhook': return 'rgb(var(--color-info))';
      case 'event': return 'rgb(var(--color-warning))';
      case 'form': return 'rgb(var(--color-primary))';
      default: return 'rgb(var(--color-text-tertiary))';
    }
  }};
`;

// ============================================================================
// Component
// ============================================================================

export const TriggerNode = React.memo<NodeProps<Node<TriggerNodeData>>>((props) => {
  const { data, selected, id } = props;
  const {
    triggerType: rawTriggerType,
    schedule,
    webhookUrl,
    eventEntity,
    eventType,
    formId,
  } = data;

  const triggerType = rawTriggerType === 'formSubmit' ? 'form' : rawTriggerType;

  const scheduleSummary = (data as any)?.scheduleSummary as string | undefined;
  
  // Get the appropriate node type definition
  const nodeTypeMap = {
    manual: 'triggerManual',
    schedule: 'triggerSchedule',
    webhook: 'triggerWebhook',
    event: 'triggerEvent',
    form: 'triggerForm',
  };
  
  const nodeTypeDef = getNodeTypeDefinition(nodeTypeMap[triggerType]);
  
  // Safety check: provide fallback if nodeType is undefined
  const nodeType = nodeTypeDef || {
    id: 'triggerManual',
    name: 'Manual Trigger',
    category: 'trigger' as const,
    color: 'rgb(var(--color-success))',
    icon: '▶️',
    description: 'User starts the workflow manually',
    maxInputs: 0,
    maxOutputs: 1,
  };

  return (
    <BaseNode
      id={id}
      data={data}
      selected={selected}
      nodeType={nodeType}
    >
      <div>
        <TriggerBadge $type={triggerType}>
          {(triggerType || 'trigger').toUpperCase()}
        </TriggerBadge>
        
        {(schedule || webhookUrl || eventEntity || formId) && (
          <TriggerConfig>
            {triggerType === 'schedule' && (scheduleSummary || schedule) && (
              <ConfigRow>
                <ConfigLabel>Schedule:</ConfigLabel>
                <ConfigValue title={schedule || scheduleSummary}>
                  {scheduleSummary || schedule}
                </ConfigValue>
              </ConfigRow>
            )}
            
            {triggerType === 'webhook' && webhookUrl && (
              <ConfigRow>
                <ConfigLabel>URL:</ConfigLabel>
                <ConfigValue>{webhookUrl}</ConfigValue>
              </ConfigRow>
            )}
            
            {triggerType === 'event' && eventEntity && (
              <>
                <ConfigRow>
                  <ConfigLabel>Entity:</ConfigLabel>
                  <ConfigValue>{eventEntity}</ConfigValue>
                </ConfigRow>
                {eventType && (
                  <ConfigRow>
                    <ConfigLabel>Event:</ConfigLabel>
                    <ConfigValue>{eventType}</ConfigValue>
                  </ConfigRow>
                )}
              </>
            )}
            
            {triggerType === 'form' && formId && (
              <ConfigRow>
                <ConfigLabel>Form ID:</ConfigLabel>
                <ConfigValue>{formId}</ConfigValue>
              </ConfigRow>
            )}
          </TriggerConfig>
        )}
      </div>
    </BaseNode>
  );
});

export default TriggerNode;
