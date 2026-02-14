/**
 * OutlookEmailNode - Node for sending emails via Microsoft Outlook
 */
import React from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { Mail } from 'lucide-react';
import styled from 'styled-components';

const NodeContainer = styled.div`
  background: white;
  border: 2px solid rgb(var(--color-primary));
  border-radius: 8px;
  padding: 12px;
  min-width: 200px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  
  &.selected {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 0 0 2px rgba(var(--color-primary), 0.2);
  }
`;

const NodeHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const NodeIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgb(var(--color-primary));
  color: white;
  border-radius: 6px;
`;

const NodeTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const NodeBody = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const RecipientsList = styled.div`
  margin-top: 4px;
  padding: 6px;
  background: rgb(var(--color-background-secondary));
  border-radius: 4px;
  font-size: 11px;
`;

export interface OutlookEmailNodeData {
  label?: string;
  to: string[];
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  importance?: 'low' | 'normal' | 'high';
}

export const OutlookEmailNode: React.FC<NodeProps<OutlookEmailNodeData>> = ({ 
  data, 
  selected 
}) => {
  const displayRecipients = data.to?.slice(0, 2).join(', ') || 'No recipients';
  const hasMoreRecipients = data.to?.length > 2;
  
  return (
    <NodeContainer className={selected ? 'selected' : ''}>
      <Handle type="target" position={Position.Top} />
      
      <NodeHeader>
        <NodeIcon>
          <Mail size={18} />
        </NodeIcon>
        <NodeTitle>{data.label || 'Send Email'}</NodeTitle>
      </NodeHeader>
      
      <NodeBody>
        <div>
          <strong>Subject:</strong> {data.subject || 'No subject'}
        </div>
        <RecipientsList>
          <strong>To:</strong> {displayRecipients}
          {hasMoreRecipients && ` +${data.to.length - 2} more`}
        </RecipientsList>
        {data.importance && data.importance !== 'normal' && (
          <div style={{ marginTop: '4px', fontSize: '10px' }}>
            <strong>Importance:</strong> {data.importance}
          </div>
        )}
      </NodeBody>
      
      <Handle type="source" position={Position.Bottom} />
    </NodeContainer>
  );
};

export default OutlookEmailNode;
