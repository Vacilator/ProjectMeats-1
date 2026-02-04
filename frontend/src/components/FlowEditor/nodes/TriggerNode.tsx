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
import { NodeProps } from '@xyflow/react';
import { BaseNode, BaseNodeData } from './BaseNode';
import { getNodeTypeDefinition } from '../nodeTypes';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

export interface TriggerNodeData extends BaseNodeData {
  triggerType: 'manual' | 'schedule' | 'webhook' | 'event' | 'form';
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
  background: rgba(0, 0, 0, 0.05);
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
      case 'manual': return 'rgba(34, 197, 94, 0.2)';
      case 'schedule': return 'rgba(59, 130, 246, 0.2)';
      case 'webhook': return 'rgba(168, 85, 247, 0.2)';
      case 'event': return 'rgba(234, 179, 8, 0.2)';
      case 'form': return 'rgba(236, 72, 153, 0.2)';
      default: return 'rgba(148, 163, 184, 0.2)';
    }
  }};
  color: ${props => {
    switch (props.$type) {
      case 'manual': return 'rgb(34, 197, 94)';
      case 'schedule': return 'rgb(59, 130, 246)';
      case 'webhook': return 'rgb(168, 85, 247)';
      case 'event': return 'rgb(234, 179, 8)';
      case 'form': return 'rgb(236, 72, 153)';
      default: return 'rgb(148, 163, 184)';
    }
  }};
`;

// ============================================================================
// Component
// ============================================================================

export const TriggerNode: React.FC<NodeProps<TriggerNodeData>> = (props) => {
  const { data, selected, id } = props;
  const {
    triggerType,
    schedule,
    webhookUrl,
    eventEntity,
    eventType,
    formId,
  } = data;
  
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
    color: 'rgb(34, 197, 94)',
    icon: 'Play',
    maxInputs: 0,
    maxOutputs: 1,
    config: {},
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
          {triggerType.toUpperCase()}
        </TriggerBadge>
        
        {(schedule || webhookUrl || eventEntity || formId) && (
          <TriggerConfig>
            {triggerType === 'schedule' && schedule && (
              <ConfigRow>
                <ConfigLabel>Schedule:</ConfigLabel>
                <ConfigValue>{schedule}</ConfigValue>
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
};

export default TriggerNode;
