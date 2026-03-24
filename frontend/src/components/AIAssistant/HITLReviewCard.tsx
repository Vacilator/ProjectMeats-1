import React, { useMemo, useState } from 'react';
import { Button, Card, Form, Input, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

import { businessApi } from '@/services/businessApi';

type Primitive = string | number | boolean | null;

type HITLReviewCardProps = {
  extractedData: Record<string, unknown>;
  documentId: string;
  /** Optional: direct AIFeedbackLog ID (preferred). If omitted, we attempt to find it via /review/pending. */
  feedbackId?: string;
  /** Allows the parent chat widget to append a success message into the conversation. */
  onEmitChatMessage?: (content: string) => void;
  /** Optional hook for parent to refresh state after submit. */
  onSubmitted?: () => void;
};

const isPrimitive = (v: unknown): v is Primitive =>
  v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';

export const HITLReviewCard: React.FC<HITLReviewCardProps> = ({
  extractedData,
  documentId,
  feedbackId,
  onEmitChatMessage,
  onSubmitted,
}) => {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);

  const fieldDefs = useMemo(() => {
    const entries = Object.entries(extractedData || {}).filter(([k]) => typeof k === 'string' && k.trim().length > 0);

    return entries
      .map(([key, value]) => {
        const primitive = isPrimitive(value);
        return {
          key,
          primitive,
          initialValue: primitive ? (value as Primitive) : JSON.stringify(value ?? null, null, 2),
        };
      })
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [extractedData]);

  const initialValues = useMemo(() => {
    const out: Record<string, unknown> = {};
    for (const def of fieldDefs) out[def.key] = def.initialValue;
    return out;
  }, [fieldDefs]);

  const resolveFeedbackId = async (): Promise<string | null> => {
    if (feedbackId) return feedbackId;

    try {
      const res = await businessApi.get<any>('/ai-assistant/review/pending/');
      const items = (res.data?.pending_reviews || res.data?.results || []) as any[];
      const match = items.find((it) => String(it?.document_id || '') === String(documentId));
      return match?.id ? String(match.id) : null;
    } catch {
      return null;
    }
  };

  const handleSubmit = async (values: Record<string, any>) => {
    setSubmitting(true);
    try {
      const corrected: Record<string, unknown> = {};
      for (const def of fieldDefs) {
        const raw = values[def.key];
        if (def.primitive) {
          corrected[def.key] = raw;
          continue;
        }

        if (typeof raw === 'string') {
          try {
            corrected[def.key] = JSON.parse(raw);
          } catch {
            corrected[def.key] = raw;
          }
        } else {
          corrected[def.key] = raw;
        }
      }

      // NOTE: /ai-assistant/feedback/ is staff-only read-only in this repo.
      // Resolving a pending review item is the supported write path.
      const resolvedId = await resolveFeedbackId();
      if (!resolvedId) {
        message.error('Unable to submit corrections (no review item found / insufficient permissions).');
        return;
      }

      await businessApi.post(`/ai-assistant/review/${resolvedId}/resolve/`, {
        user_corrected_data: corrected,
      });

      message.success('Thanks — saved your corrections and queued them for learning.');
      onEmitChatMessage?.('✅ Confirmed. I saved your corrections and will use them to improve future extractions.');
      onSubmitted?.();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Failed to submit corrections');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      size="small"
      style={{ marginTop: 10 }}
      title="Human review required"
      styles={{ body: { padding: 12 } }}
    >
      <div style={{ marginBottom: 10, fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
        Please confirm or correct the extracted fields below. This teaches the model over time.
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        onFinish={(vals) => void handleSubmit(vals as Record<string, any>)}
      >
        {fieldDefs.length ? (
          fieldDefs.map((f) => (
            <Form.Item key={f.key} name={f.key} label={f.key} style={{ marginBottom: 10 }}>
              {f.primitive ? (
                <Input placeholder={f.key} />
              ) : (
                <Input.TextArea autoSize={{ minRows: 2, maxRows: 8 }} placeholder={`JSON for ${f.key}`} />
              )}
            </Form.Item>
          ))
        ) : (
          <div style={{ fontSize: 12, color: 'rgb(var(--color-text-tertiary))' }}>
            No extracted fields found.
          </div>
        )}

        <Button
          htmlType="submit"
          type="primary"
          icon={<ThunderboltOutlined />}
          loading={submitting}
          disabled={!fieldDefs.length}
          block
        >
          Confirm &amp; Teach AI
        </Button>
      </Form>
    </Card>
  );
};
