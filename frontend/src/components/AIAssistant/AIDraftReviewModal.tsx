import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Button, Modal, Space, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import {
  AIInboxFeedbackActions,
  type AIInboxFeedbackSubmission,
} from '@/components/AIAssistant/AIInboxFeedbackActions';
import { UnifiedForm } from '@/components/UnifiedForm';
import { aiStaffApi, type PendingReviewItem } from '@/services/aiService';
import {
  mapDraftToInitialValues,
  resolveDraftEntityType,
} from '@/utils/aiDraftFormMapping';
import { buildReviewDetailsPathFromItem } from '@/utils/reviewDetailsPath';

const { Paragraph, Text, Title } = Typography;

type AIDraftReviewModalProps = {
  open: boolean;
  item: PendingReviewItem | null;
  onClose: () => void;
  onResolved?: (reviewId: string) => void;
  onFeedbackSubmitted?: (reviewId: string, submission: AIInboxFeedbackSubmission) => void;
};

type AIDraftReviewContentProps = {
  open: boolean;
  item: PendingReviewItem | null;
  onClose?: () => void;
  onResolved?: (reviewId: string) => void;
  onFeedbackSubmitted?: (reviewId: string, submission: AIInboxFeedbackSubmission) => void;
  closeOnResolved?: boolean;
  onResolvingChange?: (resolving: boolean) => void;
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
);

const firstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
};

export {
  resolveDraftEntityType as resolveReviewEntityType,
  mapDraftToInitialValues,
};

export const AIDraftReviewContent: React.FC<AIDraftReviewContentProps> = ({
  open,
  item,
  onClose,
  onResolved,
  onFeedbackSubmitted,
  closeOnResolved = false,
  onResolvingChange,
}) => {
  const navigate = useNavigate();
  const resolvingAfterSaveRef = useRef(false);
  const entityType = useMemo(() => resolveDraftEntityType(item), [item]);
  const initialValues = useMemo(() => mapDraftToInitialValues(item), [item]);
  const payload = useMemo(() => asRecord(item?.original_extracted_data), [item]);
  const reviewDetailsPath = useMemo(() => buildReviewDetailsPathFromItem(item), [item]);
  const sourcePreview = useMemo(
    () =>
      firstString(
        item?.source_summary,
        payload.email_body,
        payload.body,
        payload.text,
      ),
    [item?.source_summary, payload],
  );

  const setResolvingState = useCallback(
    (next: boolean) => {
      onResolvingChange?.(next);
    },
    [onResolvingChange],
  );

  const handleResolved = useCallback(
    async (result: unknown) => {
      if (!item?.id) {
        return;
      }

      resolvingAfterSaveRef.current = true;
      setResolvingState(true);
      try {
        await aiStaffApi.resolvePendingReview(item.id, {
          user_corrected_data: asRecord(result),
        });
        message.success('Draft saved and removed from the AI review queue.');
        onResolved?.(item.id);
        if (closeOnResolved) {
          onClose?.();
        }
      } catch (error: any) {
        message.error(
          error?.response?.data?.error ||
            'The draft saved, but the AI review queue could not be updated.',
        );
      } finally {
        resolvingAfterSaveRef.current = false;
        setResolvingState(false);
      }
    },
    [closeOnResolved, item?.id, onClose, onResolved, setResolvingState],
  );

  const handleSurfaceClose = useCallback(() => {
    if (resolvingAfterSaveRef.current) {
      return;
    }
    onClose?.();
  }, [onClose]);

  const unsupported = !entityType;

  if (!item) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div
          style={{
            border: '1px solid rgb(var(--color-border))',
            borderRadius: 12,
            padding: 16,
            background: 'rgb(var(--color-surface))',
          }}
        >
          <Title level={5} style={{ marginTop: 0 }}>
            Source Context
          </Title>
          <div style={{ display: 'grid', gap: 8 }}>
            <Text strong>{item.source_subject || item.intent_label || 'Untitled AI draft'}</Text>
            <div>
              <Tag color="blue">{item.intent_label || 'AI Draft'}</Tag>
              {item.sender ? <Tag>{item.sender}</Tag> : null}
            </div>
            <Text type="secondary">
              Received {item.created_on ? new Date(item.created_on).toLocaleString() : 'recently'}
            </Text>
            {item.source_document_name ? (
              <Text type="secondary">Attachment: {item.source_document_name}</Text>
            ) : null}
            {sourcePreview ? (
              <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {sourcePreview}
              </Paragraph>
            ) : (
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                Showing the extracted payload because the original email body was not included in this draft.
              </Paragraph>
            )}
            {reviewDetailsPath ? (
              <Space size={8} wrap>
                <Button type="primary" onClick={() => navigate(reviewDetailsPath)}>
                  Review Details
                </Button>
                <Text type="secondary">
                  Opens the canonical record with the workflow view selected.
                </Text>
              </Space>
            ) : null}
            <AIInboxFeedbackActions
              item={item}
              onSubmitted={(submission) => {
                if (!item?.id) {
                  return;
                }
                onFeedbackSubmitted?.(item.id, submission);
              }}
            />
          </div>
        </div>

        <div
          style={{
            border: '1px solid rgb(var(--color-border))',
            borderRadius: 12,
            padding: 16,
            background: 'rgb(var(--color-surface))',
          }}
        >
          <Title level={5} style={{ marginTop: 0 }}>
            Parsed Payload
          </Title>
          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              fontSize: 12,
              color: 'rgb(var(--color-text-secondary))',
            }}
          >
            {JSON.stringify(payload, null, 2)}
          </pre>
        </div>
      </div>

      <div>
        {unsupported ? (
          <Alert
            type="warning"
            showIcon
            message="This AI draft does not map to a supported entity form yet."
            description="The extracted payload is preserved on the left so an operator can review it manually."
          />
        ) : (
          <UnifiedForm
            entityType={entityType}
            mode="draft"
            variant="inline"
            isOpen={open}
            onClose={handleSurfaceClose}
            onSuccess={(result) => {
              void handleResolved(result);
            }}
            initialValues={initialValues}
            draftKey={item.id}
          />
        )}
      </div>
    </div>
  );
};

export const AIDraftReviewModal: React.FC<AIDraftReviewModalProps> = ({
  open,
  item,
  onClose,
  onResolved,
  onFeedbackSubmitted,
}) => {
  const [resolving, setResolving] = useState(false);

  return (
    <Modal
      open={open}
      onCancel={resolving ? undefined : onClose}
      footer={null}
      title="AI Inbox Review"
      width={1100}
      destroyOnHidden
      mask={{ closable: !resolving }}
      keyboard={!resolving}
    >
      <AIDraftReviewContent
        open={open}
        item={item}
        onClose={onClose}
        onResolved={onResolved}
        onFeedbackSubmitted={onFeedbackSubmitted}
        closeOnResolved
        onResolvingChange={setResolving}
      />
    </Modal>
  );
};

export default AIDraftReviewModal;
