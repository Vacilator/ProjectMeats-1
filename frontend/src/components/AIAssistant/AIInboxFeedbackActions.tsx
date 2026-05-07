import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Input, Modal, Space, Tooltip, Typography, message } from 'antd';
import { DislikeOutlined, LikeOutlined } from '@ant-design/icons';

import {
  aiFeedbackApi,
  type AIInboxFeedbackSignal,
  type AIInboxFeedbackSubmitResponse,
  type PendingReviewItem,
} from '@/services/aiService';

const { Text } = Typography;

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
);

export type AIInboxFeedbackSubmission = {
  feedbackSignal: AIInboxFeedbackSignal;
  feedbackComment: string;
  retrainingStatus?: string;
  retrainingQueuedAt?: string | null;
};

type AIInboxFeedbackActionsProps = {
  item: PendingReviewItem | null;
  onSubmitted?: (submission: AIInboxFeedbackSubmission) => void;
};

const getFeedbackLabel = (signal: AIInboxFeedbackSignal | null | undefined): string => {
  if (signal === 'thumbs_up') {
    return 'Thumbs up saved';
  }
  if (signal === 'thumbs_down') {
    return 'Thumbs down saved';
  }
  return '';
};

export const AIInboxFeedbackActions: React.FC<AIInboxFeedbackActionsProps> = ({
  item,
  onSubmitted,
}) => {
  const [submittingSignal, setSubmittingSignal] = useState<AIInboxFeedbackSignal | null>(null);
  const [negativeOpen, setNegativeOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [savedSignal, setSavedSignal] = useState<AIInboxFeedbackSignal | null>(null);
  const [savedComment, setSavedComment] = useState('');

  useEffect(() => {
    setSavedSignal(item?.feedback_signal ?? null);
    setSavedComment(item?.feedback_comment ?? '');
    setCommentDraft(item?.feedback_signal === 'thumbs_down' ? item.feedback_comment ?? '' : '');
    setNegativeOpen(false);
    setSubmittingSignal(null);
  }, [item?.feedback_comment, item?.feedback_signal, item?.id]);

  const trimmedComment = useMemo(() => commentDraft.trim(), [commentDraft]);

  const submitFeedback = useCallback(
    async (signal: AIInboxFeedbackSignal, comment: string) => {
      if (!item?.document_id) {
        message.error('This draft cannot accept feedback yet.');
        return;
      }

      setSubmittingSignal(signal);
      try {
        const response: AIInboxFeedbackSubmitResponse = await aiFeedbackApi.submit({
          document_id: item.document_id,
          document_type: item.document_type,
          original_extracted_data: asRecord(item.original_extracted_data),
          confidence_score: Number(item.confidence_score || 0),
          feedback_signal: signal,
          feedback_comment: comment,
          feedback_source: 'ai_inbox',
        });

        setSavedSignal(signal);
        setSavedComment(comment);
        if (signal === 'thumbs_down') {
          setNegativeOpen(false);
        }

        message.success(
          signal === 'thumbs_up'
            ? 'Feedback saved and queued for retraining.'
            : 'Thanks. Your note was saved and queued for retraining.',
        );
        onSubmitted?.({
          feedbackSignal: signal,
          feedbackComment: comment,
          retrainingStatus: response.retraining_status,
          retrainingQueuedAt: response.retraining_queued_at,
        });
      } catch (error: any) {
        message.error(error?.response?.data?.feedback_comment?.[0] || 'Unable to save AI Inbox feedback.');
      } finally {
        setSubmittingSignal(null);
      }
    },
    [item, onSubmitted],
  );

  return (
    <>
      <Space size={8} wrap>
        <Tooltip title="Helpful parse">
          <Button
            aria-label="Thumbs up feedback"
            icon={<LikeOutlined />}
            size="small"
            type={savedSignal === 'thumbs_up' ? 'primary' : 'default'}
            onClick={() => void submitFeedback('thumbs_up', '')}
            loading={submittingSignal === 'thumbs_up'}
            disabled={Boolean(submittingSignal) || !item}
          >
            Helpful
          </Button>
        </Tooltip>
        <Tooltip title="Needs improvement">
          <Button
            aria-label="Thumbs down feedback"
            danger={savedSignal === 'thumbs_down'}
            icon={<DislikeOutlined />}
            size="small"
            type={savedSignal === 'thumbs_down' ? 'primary' : 'default'}
            onClick={() => setNegativeOpen(true)}
            disabled={Boolean(submittingSignal) || !item}
          >
            Needs work
          </Button>
        </Tooltip>
        {savedSignal ? (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getFeedbackLabel(savedSignal)}. Queued for retraining.
          </Text>
        ) : null}
      </Space>

      <Modal
        destroyOnHidden
        open={negativeOpen}
        onCancel={submittingSignal ? undefined : () => setNegativeOpen(false)}
        title="Tell us what the AI missed"
        okText="Submit feedback"
        onOk={() => void submitFeedback('thumbs_down', trimmedComment)}
        okButtonProps={{
          danger: true,
          disabled: !trimmedComment || Boolean(submittingSignal),
          loading: submittingSignal === 'thumbs_down',
        }}
        cancelButtonProps={{ disabled: Boolean(submittingSignal) }}
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text type="secondary">
            Thumbs down requires a short explanation so the retraining queue has the missing context.
          </Text>
          <Input.TextArea
            aria-label="Thumbs down reason"
            autoSize={{ minRows: 4, maxRows: 8 }}
            maxLength={4000}
            placeholder="What should the AI have understood here?"
            value={commentDraft}
            onChange={(event) => setCommentDraft(event.target.value)}
          />
          {savedSignal === 'thumbs_down' && savedComment ? (
            <Text type="secondary" style={{ fontSize: 12 }}>
              Latest note: {savedComment}
            </Text>
          ) : null}
        </Space>
      </Modal>
    </>
  );
};

export default AIInboxFeedbackActions;
