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

type ReviewContactRole = {
  key: string;
  header: string;
  roleLabel: string;
  title?: string;
  email?: string;
  responsibilities: string[];
  detailPath?: string;
};

const departmentLabel = (value: unknown): string | undefined => {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) {
    return undefined;
  }
  const labels: Record<string, string> = {
    sales: 'Sales',
    qa: 'QA',
    shipping: 'Shipping / Loadout',
    certification: 'Certification',
    accounting: 'Accounting',
    booking: 'Booking',
  };
  return labels[normalized] ?? normalized.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
};

const uniqueStrings = (...groups: unknown[]): string[] => {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const group of groups) {
    if (!Array.isArray(group)) {
      continue;
    }
    for (const raw of group) {
      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value && !seen.has(value)) {
        seen.add(value);
        values.push(value);
      }
    }
  }
  return values;
};

const buildReviewContactRole = (
  key: string,
  payload: Record<string, unknown>,
  prefix: string,
): ReviewContactRole | null => {
  const name = firstString(payload.recipient_name, payload.name);
  const email = firstString(payload.recipient_email, payload.email);
  if (!name && !email) {
    return null;
  }

  const roleLabel =
    departmentLabel(payload.department) ||
    firstString(payload.role_label) ||
    key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  const title = firstString(payload.title);
  const company = firstString(payload.plant_name, payload.company);
  const headerBase = `${prefix} ${roleLabel} - ${name || email}`;
  const responsibilities = uniqueStrings(
    payload.matched_items,
    payload.matched_proteins,
    payload.matched_documents,
    payload.responsible_items,
    payload.responsible_proteins,
    payload.responsible_documents,
  );

  return {
    key,
    header: company ? `${headerBase} (${company})` : headerBase,
    roleLabel,
    title,
    email,
    responsibilities,
    detailPath:
      typeof payload.contact_id === 'number' || (typeof payload.contact_id === 'string' && payload.contact_id.trim())
        ? `/records/contact/${encodeURIComponent(String(payload.contact_id))}`
        : undefined,
  };
};

const appendReviewContactRoles = (
  target: ReviewContactRole[],
  payload: Record<string, unknown>,
  prefix: string,
) => {
  for (const [key, value] of Object.entries(payload)) {
    const record = asRecord(value);
    const card = buildReviewContactRole(key, record, prefix);
    if (card) {
      target.push(card);
    }
  }
};

const extractReviewContactRoles = (
  payload: Record<string, unknown>,
  initialValues: Record<string, unknown>,
): ReviewContactRole[] => {
  const cards: ReviewContactRole[] = [];

  appendReviewContactRoles(cards, asRecord(payload.contact_routing), 'Resolved');
  appendReviewContactRoles(cards, asRecord(asRecord(payload.selected_bid).contact_routing), 'Selected bid');
  appendReviewContactRoles(cards, asRecord(asRecord(payload.process_cockpit).supplier_contacts), 'Process');

  const recipientRouting = buildReviewContactRole(
    'rfq_recipient',
    asRecord(payload.recipient_routing),
    'RFQ sent to',
  );
  if (recipientRouting) {
    cards.unshift(recipientRouting);
  }

  if (cards.length === 0) {
    const fallbackName = firstString(
      initialValues.supplier_contact_name,
      initialValues.contact_name,
    );
    const fallbackEmail = firstString(
      initialValues.supplier_contact_email,
      initialValues.contact_email,
    );
    if (fallbackName || fallbackEmail) {
      cards.push({
        key: 'fallback-contact',
        header: `Draft contact - ${fallbackName || fallbackEmail}`,
        roleLabel: 'Draft Contact',
        email: fallbackEmail,
        responsibilities: [],
      });
    }
  }

  return cards;
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
  const contactRoles = useMemo(
    () => extractReviewContactRoles(payload, initialValues),
    [initialValues, payload],
  );

  const attachmentFilenames = useMemo<string[]>(() => {
    const names = payload.attachment_filenames;
    return Array.isArray(names)
      ? names.map((n) => (typeof n === 'string' ? n : String(n))).filter(Boolean)
      : [];
  }, [payload.attachment_filenames]);

  const attachmentDocTypes = useMemo<Array<{ name: string; doc_type: string }>>(() => {
    const types = payload.attachment_document_types;
    if (!Array.isArray(types)) {
      return [];
    }
    return types
      .filter((t): t is Record<string, unknown> => t != null && typeof t === 'object')
      .map((t) => ({
        name: String(t.name || ''),
        doc_type: String(t.doc_type || 'other'),
      }));
  }, [payload.attachment_document_types]);

  const attachmentCount = typeof payload.attachment_count === 'number'
    ? payload.attachment_count
    : attachmentFilenames.length;

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
            {payload.po_number ? (
              <Text type="secondary">PO #: {String(payload.po_number)}</Text>
            ) : null}
            {payload.bol_number ? (
              <Text type="secondary">BOL #: {String(payload.bol_number)}</Text>
            ) : null}
            {payload.total_amount ? (
              <Text type="secondary">Amount: {String(payload.total_amount)}</Text>
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

        {attachmentCount > 0 ? (
          <div
            style={{
              border: '1px solid rgb(var(--color-border))',
              borderRadius: 12,
              padding: 16,
              background: 'rgb(var(--color-surface))',
            }}
          >
            <Title level={5} style={{ marginTop: 0 }}>
              Attachments ({attachmentCount})
            </Title>
            <div style={{ display: 'grid', gap: 6 }}>
              {(attachmentDocTypes.length > 0 ? attachmentDocTypes : attachmentFilenames.map((n) => ({ name: n, doc_type: '' }))).map(
                (att, idx) => (
                  <div
                    key={att.name || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '4px 0',
                    }}
                  >
                    <Text style={{ fontSize: 13 }}>{att.name || `Attachment ${idx + 1}`}</Text>
                    {att.doc_type && att.doc_type !== 'other' ? (
                      <Tag color="geekblue" style={{ margin: 0 }}>
                        {att.doc_type.replace(/_/g, ' ')}
                      </Tag>
                    ) : null}
                  </div>
                ),
              )}
            </div>
          </div>
        ) : null}

        {contactRoles.length > 0 ? (
          <div
            style={{
              border: '1px solid rgb(var(--color-border))',
              borderRadius: 12,
              padding: 16,
              background: 'rgb(var(--color-surface))',
            }}
          >
            <Title level={5} style={{ marginTop: 0 }}>
              Contact Routing
            </Title>
            <div style={{ display: 'grid', gap: 10 }}>
              {contactRoles.map((role) => (
                <div
                  key={role.key}
                  style={{
                    border: '1px solid rgb(var(--color-border))',
                    borderRadius: 10,
                    padding: 12,
                    background: 'rgb(var(--color-background))',
                    display: 'grid',
                    gap: 6,
                  }}
                >
                  <Space size={8} wrap>
                    <Tag color="blue">{role.roleLabel}</Tag>
                    {role.title ? <Text type="secondary">{role.title}</Text> : null}
                  </Space>
                  <Text strong>{role.header}</Text>
                  {role.email ? <Text type="secondary">{role.email}</Text> : null}
                  {role.responsibilities.length > 0 ? (
                    <Space size={[4, 4]} wrap>
                      {role.responsibilities.slice(0, 4).map((value) => (
                        <Tag key={value}>{value}</Tag>
                      ))}
                    </Space>
                  ) : null}
                  {role.detailPath ? (
                    <Button type="link" style={{ paddingLeft: 0 }} onClick={() => navigate(role.detailPath!)}>
                      Open contact
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

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
