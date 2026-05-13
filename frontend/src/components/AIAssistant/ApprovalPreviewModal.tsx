/**
 * ApprovalPreviewModal — Full preview before sending external communication.
 *
 * Shows: recipient info, content preview, AI confidence badge.
 * Actions: Approve & Send, Edit Before Sending, Reject, Cancel.
 * Keyboard: Cmd/Ctrl+Enter = Approve, Escape = Cancel.
 */

import React, { useCallback, useState } from 'react';
import { Modal, Button, Input, Tag, Space, Typography, Divider, Alert } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EditOutlined,
  SendOutlined,
  ExclamationCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import styled from 'styled-components';
import type { ApprovalGateRequest } from '../../hooks/useApprovalGate';

const { Text, Title, Paragraph } = Typography;
const { TextArea } = Input;

// --- Styled Components (theme tokens only) ---

const PreviewCard = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 16px;
`;

const RecipientRow = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
`;

const ContentPreview = styled.div`
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  padding: 12px;
  max-height: 300px;
  overflow-y: auto;
  font-size: 14px;
  line-height: 1.6;
  color: rgb(var(--color-text-primary));
  white-space: pre-wrap;
`;

const ConfidenceBadge = styled.span<{ $confidence: number }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  background: ${({ $confidence }) =>
    $confidence >= 0.9
      ? 'rgba(var(--color-success), 0.1)'
      : $confidence >= 0.7
      ? 'rgba(var(--color-warning), 0.1)'
      : 'rgba(var(--color-danger), 0.1)'};
  color: ${({ $confidence }) =>
    $confidence >= 0.9
      ? 'rgb(var(--color-success))'
      : $confidence >= 0.7
      ? 'rgb(var(--color-warning))'
      : 'rgb(var(--color-danger))'};
`;

const ActionBar = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
`;

// --- Types ---

interface ApprovalPreviewModalProps {
  open: boolean;
  request: ApprovalGateRequest | null;
  onApprove: (notes?: string) => void;
  onReject: (notes?: string) => void;
  onEditApprove: (editedContent: Record<string, unknown>, notes?: string) => void;
  onCancel: () => void;
}

// --- Component ---

const ApprovalPreviewModal: React.FC<ApprovalPreviewModalProps> = ({
  open,
  request,
  onApprove,
  onReject,
  onEditApprove,
  onCancel,
}) => {
  const [notes, setNotes] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedPreview, setEditedPreview] = useState('');

  const handleApprove = useCallback(() => {
    if (isEditing) {
      onEditApprove({ content_preview: editedPreview }, notes);
    } else {
      onApprove(notes);
    }
    setNotes('');
    setIsEditing(false);
    setEditedPreview('');
  }, [isEditing, editedPreview, notes, onApprove, onEditApprove]);

  const handleReject = useCallback(() => {
    onReject(notes);
    setNotes('');
    setIsEditing(false);
  }, [notes, onReject]);

  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditedPreview(request?.contentPreview || '');
  }, [request]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleApprove();
    }
  }, [handleApprove]);

  if (!request) return null;

  const priorityColor = {
    low: 'default' as const,
    normal: 'blue' as const,
    high: 'orange' as const,
    urgent: 'red' as const,
  }[request.priority || 'normal'] || ('blue' as const);

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: 'rgb(var(--color-warning))' }} />
          <span>Review Before Sending</span>
        </Space>
      }
      onCancel={onCancel}
      footer={null}
      width={640}
      destroyOnClose
    >
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div onKeyDown={handleKeyDown}>
        {request.aiGenerated && (
          <Alert
            message="AI-Generated Content"
            description="This content was drafted by AI. Please review before approving."
            type="info"
            showIcon
            icon={<RobotOutlined />}
            style={{ marginBottom: 16 }}
          />
        )}

        <PreviewCard>
          <RecipientRow>
            <Text strong>To:</Text>
            <Text>{request.recipientName || request.recipientEmail || 'Unknown'}</Text>
            {request.recipientEmail && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                ({request.recipientEmail})
              </Text>
            )}
            <Tag color={priorityColor}>{request.priority || 'normal'}</Tag>
            {request.aiConfidence != null && (
              <ConfidenceBadge $confidence={request.aiConfidence}>
                <RobotOutlined /> {Math.round(request.aiConfidence * 100)}%
              </ConfidenceBadge>
            )}
          </RecipientRow>

          <Divider style={{ margin: '8px 0' }} />

          <Title level={5} style={{ marginBottom: 8 }}>{request.subject}</Title>

          {isEditing ? (
            <TextArea
              value={editedPreview}
              onChange={(e) => setEditedPreview(e.target.value)}
              rows={8}
              autoFocus
              style={{ fontFamily: 'inherit' }}
            />
          ) : (
            <ContentPreview>
              {request.contentPreview || '(No preview available)'}
            </ContentPreview>
          )}
        </PreviewCard>

        <div style={{ marginBottom: 12 }}>
          <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
            Notes (optional)
          </Text>
          <TextArea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add a note about your decision..."
            rows={2}
            maxLength={500}
          />
        </div>

        <ActionBar>
          <Button onClick={onCancel}>Cancel</Button>
          <Button
            icon={<CloseCircleOutlined />}
            danger
            onClick={handleReject}
          >
            Reject
          </Button>
          {!isEditing && (
            <Button
              icon={<EditOutlined />}
              onClick={handleStartEdit}
            >
              Edit
            </Button>
          )}
          <Button
            type="primary"
            icon={isEditing ? <CheckCircleOutlined /> : <SendOutlined />}
            onClick={handleApprove}
          >
            {isEditing ? 'Save & Approve' : 'Approve & Send'}
          </Button>
        </ActionBar>

        <Paragraph
          type="secondary"
          style={{ fontSize: 11, textAlign: 'center', marginTop: 12, marginBottom: 0 }}
        >
          ⌘+Enter to approve · Esc to cancel
        </Paragraph>
      </div>
    </Modal>
  );
};

export default ApprovalPreviewModal;
