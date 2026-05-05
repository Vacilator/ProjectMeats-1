/**
 * MessageList Component
 *
 * Displays a list of chat messages with proper formatting and styling.
 */
import React from 'react';
import styled from 'styled-components';
import {
  ChatMessage,
  DocumentLineageSummary,
  DocumentProcessingMetadata,
  DocumentSourceMetadata,
} from '../../types';
import DocumentAuditBadges from '@/components/AIAssistant/DocumentAuditBadges';

interface MessageListProps {
  messages: ChatMessage[];
}

interface MessageMetadataType {
  model?: string;
  processing_time?: number;
  tokens_used?: number;
  content_type?: string;
  processing_status?: string;
  source_metadata?: DocumentSourceMetadata;
  processing_metadata?: DocumentProcessingMetadata;
  lineage_summary?: DocumentLineageSummary | null;
  control_plane?: {
    approval_required?: boolean;
    tool_name?: string;
  };
  original_filename?: string;
  file_url?: string;
}

const MessageList: React.FC<MessageListProps> = ({ messages }) => {
  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return date.toLocaleDateString();
  };

  const getMessageIcon = (type: string): string => {
    switch (type) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return '⚙️';
      case 'document':
        return '📄';
      default:
        return '💬';
    }
  };

  return (
    <MessageContainer>
      {messages.map((message) => (
        <MessageItem key={message.id} $messageType={message.message_type}>
          <MessageHeader>
            <MessageTypeIcon>{getMessageIcon(message.message_type)}</MessageTypeIcon>
            <MessageInfo>
              <MessageType>
                {message.message_type === 'user'
                  ? 'You'
                  : message.message_type === 'assistant'
                    ? 'AI Assistant'
                    : message.message_type === 'system'
                      ? 'System'
                      : 'Document'}
              </MessageType>
              <MessageTime>{formatTimestamp(message.created_on)}</MessageTime>
            </MessageInfo>
          </MessageHeader>

          {message.message_type === 'document' ? (
            <>
              <MessageContent>
                {(message.metadata as MessageMetadataType | undefined)?.original_filename || message.content}
              </MessageContent>
              <DocumentDetail>
                {(message.metadata as MessageMetadataType | undefined)?.content_type || 'Document'}
              </DocumentDetail>
              <DocumentAuditBadges
                processingStatus={(message.metadata as MessageMetadataType | undefined)?.processing_status}
                sourceMetadata={(message.metadata as MessageMetadataType | undefined)?.source_metadata}
                processingMetadata={(message.metadata as MessageMetadataType | undefined)?.processing_metadata}
                lineageSummary={(message.metadata as MessageMetadataType | undefined)?.lineage_summary}
              />
            </>
          ) : (
            <MessageContent>{message.content}</MessageContent>
          )}

          {message.metadata && Object.keys(message.metadata).length > 0 && (
            <MessageMetadata>
              {(message.metadata as MessageMetadataType).model && (
                <MetadataItem>
                  Model: {(message.metadata as MessageMetadataType).model}
                </MetadataItem>
              )}
              {(message.metadata as MessageMetadataType).processing_time && (
                <MetadataItem>
                  Processing: {(message.metadata as MessageMetadataType).processing_time}s
                </MetadataItem>
              )}
              {(message.metadata as MessageMetadataType).tokens_used && (
                <MetadataItem>
                  Tokens: {(message.metadata as MessageMetadataType).tokens_used}
                </MetadataItem>
              )}
              {(message.metadata as MessageMetadataType).control_plane?.approval_required && (
                <MetadataItem>
                  Approval pending
                  {(message.metadata as MessageMetadataType).control_plane?.tool_name
                    ? ` • ${(message.metadata as MessageMetadataType).control_plane?.tool_name}`
                    : ''}
                </MetadataItem>
              )}
            </MessageMetadata>
          )}
        </MessageItem>
      ))}
    </MessageContainer>
  );
};

// Styled Components
const MessageContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const MessageItem = styled.div<{ $messageType: string }>`
  padding: 16px;
  border-radius: 12px;
  background: ${(props) =>
    props.$messageType === 'user'
      ? 'rgba(var(--color-info), 0.12)'
      : props.$messageType === 'assistant'
        ? 'rgb(var(--color-surface))'
        : 'rgb(var(--color-surface))7ed'};
  border: 1px solid
    ${(props) =>
      props.$messageType === 'user'
        ? 'rgba(var(--color-info), 0.14)'
        : props.$messageType === 'assistant'
          ? 'rgb(var(--color-border))'
          : 'rgba(var(--color-warning), 0.18)'};

  ${(props) =>
    props.$messageType === 'user' &&
    `
    margin-left: 20%;
  `}

  ${(props) =>
    props.$messageType === 'assistant' &&
    `
    margin-right: 20%;
  `}
`;

const MessageHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
`;

const MessageTypeIcon = styled.span`
  font-size: 16px;
`;

const MessageInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
`;

const MessageType = styled.span`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
`;

const MessageTime = styled.span`
  font-size: 12px;
  color: rgb(var(--color-text-muted));
`;

const MessageContent = styled.div`
  font-size: 14px;
  line-height: 1.6;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
  word-wrap: break-word;
`;

const MessageMetadata = styled.div`
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgb(var(--color-border));
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
`;

const DocumentDetail = styled.div`
  margin-top: 6px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const MetadataItem = styled.span`
  font-size: 11px;
  color: rgb(var(--color-text-muted));
  background: rgb(var(--color-surface-hover));
  padding: 2px 6px;
  border-radius: 4px;
`;

export default MessageList;
