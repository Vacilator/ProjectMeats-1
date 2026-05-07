/**
 * AmbientDraftAction - One-click contextual email draft button
 *
 * Renders on supplier/customer record pages. Calls the contextual draft
 * service and opens a review modal with the generated email content
 * before handing off to the Outlook send flow.
 */

import React, { useState, useCallback } from 'react';
import { Button, Modal, Input, Space, Tag, Tooltip, message } from 'antd';
import { MailOutlined, EditOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { businessApi } from '@/services/businessApi';

const { TextArea } = Input;

// -------------------------------------------------------------------
// Types
// -------------------------------------------------------------------

interface EmailDraft {
  to: string;
  subject: string;
  body: string;
  draft_purpose: string;
  confidence: number;
  context_summary: string;
  metadata: Record<string, unknown>;
}

interface DraftResponse {
  draft: EmailDraft | null;
  available: boolean;
  reason?: string;
}

export interface AmbientDraftActionProps {
  entityType: 'supplier' | 'customer';
  entityId: string;
  entityName: string;
  contactEmail?: string;
  contactName?: string;
}

// -------------------------------------------------------------------
// Component
// -------------------------------------------------------------------

export function AmbientDraftAction({
  entityType,
  entityId,
  entityName,
  contactEmail,
  contactName,
}: AmbientDraftActionProps): React.ReactElement | null {
  const [modalOpen, setModalOpen] = useState(false);
  const [draft, setDraft] = useState<EmailDraft | null>(null);
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');

  const generateMutation = useMutation({
    mutationFn: async () => {
      const res = await businessApi.post<DraftResponse>(
        '/ai-assistant/email-drafts/generate/',
        {
          entity_type: entityType,
          entity_id: entityId,
          entity_name: entityName,
          contact_email: contactEmail,
          contact_name: contactName,
        },
      );
      return res.data;
    },
    onSuccess: (data) => {
      if (data.available && data.draft) {
        setDraft(data.draft);
        setEditedSubject(data.draft.subject);
        setEditedBody(data.draft.body);
        setModalOpen(true);
      } else {
        message.info(data.reason || 'Cannot generate draft — insufficient context');
      }
    },
    onError: () => {
      message.error('Failed to generate email draft');
    },
  });

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await businessApi.post('/ai-assistant/email-drafts/send/', {
        to: draft?.to,
        subject: editedSubject,
        body: editedBody,
        entity_type: entityType,
        entity_id: entityId,
        metadata: draft?.metadata,
      });
      return res.data;
    },
    onSuccess: () => {
      message.success('Email sent successfully');
      setModalOpen(false);
      setDraft(null);
    },
    onError: () => {
      message.error('Failed to send email — please try via Outlook directly');
    },
  });

  const handleGenerate = useCallback(() => {
    generateMutation.mutate();
  }, [generateMutation]);

  const handleSend = useCallback(() => {
    sendMutation.mutate();
  }, [sendMutation]);

  // Don't show if no contact email available
  if (!contactEmail) {
    return null;
  }

  return (
    <>
      <Tooltip title={`Draft email to ${contactName || entityName}`}>
        <Button
          icon={<MailOutlined />}
          onClick={handleGenerate}
          loading={generateMutation.isPending}
          size="small"
        >
          Draft Email
        </Button>
      </Tooltip>

      <Modal
        title={
          <Space>
            <EditOutlined />
            <span>Review Email Draft</span>
            {draft && (
              <Tag color="blue" style={{ fontSize: 10 }}>
                {draft.draft_purpose.replace('_', ' ')}
              </Tag>
            )}
          </Space>
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        width={640}
        footer={[
          <Button key="cancel" onClick={() => setModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="send"
            type="primary"
            icon={<SendOutlined />}
            loading={sendMutation.isPending}
            onClick={handleSend}
          >
            Send Email
          </Button>,
        ]}
      >
        {draft && (
          <div style={{ display: 'grid', gap: 16 }}>
            <div>
              <label
                style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}
              >
                To
              </label>
              <Input value={draft.to} disabled />
            </div>

            <div>
              <label
                style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}
              >
                Subject
              </label>
              <Input
                value={editedSubject}
                onChange={(e) => setEditedSubject(e.target.value)}
              />
            </div>

            <div>
              <label
                style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 4 }}
              >
                Body
              </label>
              <TextArea
                value={editedBody}
                onChange={(e) => setEditedBody(e.target.value)}
                rows={12}
                style={{ fontFamily: 'inherit' }}
              />
            </div>

            <div
              style={{
                padding: '8px 12px',
                background: '#f9fafb',
                borderRadius: 6,
                fontSize: 12,
                color: '#6b7280',
              }}
            >
              <strong>Context:</strong> {draft.context_summary}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default AmbientDraftAction;
