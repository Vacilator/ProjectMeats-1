import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Button, Collapse, Modal, Space, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import {
  AIInboxFeedbackActions,
  type AIInboxFeedbackSubmission,
} from '@/components/AIAssistant/AIInboxFeedbackActions';
import { MissingDependencyQuickCreate, type DependencyType } from '@/components/Cockpit/MissingDependencyQuickCreate';
import { UnifiedForm } from '@/components/UnifiedForm';
import { aiStaffApi, type PendingReviewItem } from '@/services/aiService';
import {
  mapDraftToInitialValues,
  resolveDraftEntityType,
} from '@/utils/aiDraftFormMapping';
import { buildReviewDetailsPathFromItem } from '@/utils/reviewDetailsPath';
import { getErrorMessage } from '@/utils/errorHelpers';

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

/**
 * Dependency ordering for entity creation.
 * Lower number = created first (dependencies before dependents).
 */
const ENTITY_CREATION_ORDER: Record<string, number> = {
  contact: 1,
  supplier: 2,
  customer: 2,
  plant: 3,
  inquiry: 4,
  purchase_order: 5,
  sales_order: 5,
  'carrier-pos': 6,
  invoice: 7,
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
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    entityType: DependencyType;
    suggestedName?: string;
    suggestedEmail?: string;
  } | null>(null);
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

  const relatedEntityDrafts = useMemo<Array<{
    entity_type: string;
    status: string;
    existing_id: string | null;
    proposed_data: Record<string, unknown>;
    confidence: number;
    source: string;
  }>>(() => {
    const drafts = payload.related_entity_drafts;
    if (!Array.isArray(drafts)) {
      return [];
    }
    return drafts
      .filter((d): d is Record<string, unknown> => d != null && typeof d === 'object')
      .map((d) => ({
        entity_type: String(d.entity_type || ''),
        status: String(d.status || 'proposed'),
        existing_id: d.existing_id ? String(d.existing_id) : null,
        proposed_data: asRecord(d.proposed_data),
        confidence: typeof d.confidence === 'number' ? d.confidence : 0,
        source: String(d.source || ''),
      }));
  }, [payload.related_entity_drafts]);

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
      } catch (error: unknown) {
        message.error(
          getErrorMessage(error, 'The draft saved, but the AI review queue could not be updated.'),
        );
      } finally {
        resolvingAfterSaveRef.current = false;
        setResolvingState(false);
      }
    },
    [closeOnResolved, item?.id, onClose, onResolved, setResolvingState],
  );

  const handleRejected = useCallback(
    async () => {
      if (!item?.id) {
        return;
      }

      setResolvingState(true);
      try {
        await aiStaffApi.resolvePendingReview(item.id, {
          user_corrected_data: { _rejected: true },
        });
        message.info('Rejected all drafts from this review.');
        onResolved?.(item.id);
        if (closeOnResolved) {
          onClose?.();
        }
      } catch (error: unknown) {
        message.error(
          getErrorMessage(error, 'Failed to reject the review item.'),
        );
      } finally {
        setResolvingState(false);
      }
    },
    [closeOnResolved, item?.id, onClose, onResolved, setResolvingState],
  );

  const [draftStatuses, setDraftStatuses] = useState<Record<string, 'pending' | 'approved' | 'rejected' | 'error'>>({});
  const [approveProgress, setApproveProgress] = useState<{
    running: boolean;
    current: number;
    total: number;
    currentLabel: string;
  } | null>(null);

  /** Sort related drafts by dependency order */
  const orderedDrafts = useMemo(() => {
    return [...relatedEntityDrafts]
      .map((d, idx) => ({ ...d, originalIndex: idx }))
      .sort((a, b) => {
        const orderA = ENTITY_CREATION_ORDER[a.entity_type] ?? 99;
        const orderB = ENTITY_CREATION_ORDER[b.entity_type] ?? 99;
        return orderA - orderB;
      });
  }, [relatedEntityDrafts]);

  /** Approve a single related entity draft (local state — saved when main record is resolved) */
  const handleApproveDraft = useCallback((idx: number, typeLabel: string) => {
    setDraftStatuses((prev) => ({ ...prev, [idx]: 'approved' }));
    message.success(`Marked ${typeLabel} as approved. Save the main record to apply.`);
  }, []);

  /** Reject a single related entity draft (local state — excluded when main record is resolved) */
  const handleRejectDraft = useCallback((idx: number, typeLabel: string) => {
    setDraftStatuses((prev) => ({ ...prev, [idx]: 'rejected' }));
    message.info(`Marked ${typeLabel} as rejected.`);
  }, []);

  /** Created records from sequential approve — maps index to entity info */
  const [createdRecords, setCreatedRecords] = useState<Record<number, { id: string; type: string; label: string }>>({});

  /** Sequential approve-all: mark all drafts as approved in order, then resolve main with combined data */
  const handleSequentialApproveAll = useCallback(async () => {
    const pendingDrafts = orderedDrafts.filter(
      (d) => d.status === 'proposed' && draftStatuses[d.originalIndex] !== 'approved' && draftStatuses[d.originalIndex] !== 'rejected',
    );
    const total = pendingDrafts.length + 1; // +1 for main resolve

    setApproveProgress({ running: true, current: 0, total, currentLabel: 'Starting...' });

    // Step through each draft in dependency order — mark as approved with visual feedback
    const approvedDraftsData: Record<string, unknown>[] = [];
    for (let i = 0; i < pendingDrafts.length; i++) {
      const draft = pendingDrafts[i];
      const typeLabel = draft.entity_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      setApproveProgress({ running: true, current: i + 1, total, currentLabel: `Approving ${typeLabel}...` });
      setDraftStatuses((prev) => ({ ...prev, [draft.originalIndex]: 'approved' }));
      approvedDraftsData.push({
        entity_type: draft.entity_type,
        ...asRecord(draft.proposed_data),
      });
      // Small delay for visual feedback
      await new Promise((r) => setTimeout(r, 200));
    }

    // Final step: resolve the main item with all approved draft data
    setApproveProgress({ running: true, current: total, total, currentLabel: 'Saving all records...' });

    try {
      const result = await aiStaffApi.resolvePendingReview(item!.id, {
        user_corrected_data: {
          approved_drafts: approvedDraftsData,
        },
      });
      const createdId = String((result as Record<string, unknown>)?.created_id || (result as Record<string, unknown>)?.id || '');
      if (createdId) {
        setCreatedRecords((prev) => ({
          ...prev,
          [-1]: { id: createdId, type: entityType || 'record', label: 'Main Record' },
        }));
      }
      message.success(`✅ All ${total} items approved and saved.`);
      setApproveProgress(null);
      onResolved?.(item!.id);
      if (closeOnResolved) {
        onClose?.();
      }
    } catch (error: unknown) {
      message.error(
        getErrorMessage(error, 'Failed to save the main record after approving drafts.'),
      );
      setApproveProgress(null);
    }
  }, [orderedDrafts, draftStatuses, item, entityType, onResolved, closeOnResolved, onClose]);

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
    <div style={{ display: 'grid', gap: 16 }} role="region" aria-label="AI Draft Review">
      {/* Intent Banner */}
      {item.intent_label && (
        <div
          role="banner"
          aria-label={`Intent: ${item.intent_label}${typeof item.confidence_score === 'number' ? ` — ${Math.round(item.confidence_score * 100)}% confidence` : ''}`}
          style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 8,
          background: 'rgba(var(--color-primary), 0.08)',
          border: '1px solid rgba(var(--color-primary), 0.2)',
          color: 'rgb(var(--color-text-primary))',
          fontSize: 14,
          fontWeight: 500,
        }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <span>Intent: {item.intent_label}</span>
          {typeof item.confidence_score === 'number' && (
            <Tag color={
              item.confidence_score >= 0.8 ? 'green' :
              item.confidence_score >= 0.5 ? 'orange' : 'red'
            } style={{ marginLeft: 'auto' }}>
              {Math.round(item.confidence_score * 100)}% confidence
            </Tag>
          )}
        </div>
      )}

      {/* Top-level batch actions */}
      <div
        role="toolbar"
        aria-label="Draft approval actions"
        style={{
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 8,
        padding: '8px 0',
        borderBottom: '1px solid rgb(var(--color-border))',
      }}>
        {approveProgress?.running ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flex: 1,
          }}>
            <div
              role="progressbar"
              aria-valuenow={approveProgress.current}
              aria-valuemax={approveProgress.total}
              aria-label={`Approving ${approveProgress.currentLabel}`}
              style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: 'rgba(var(--color-primary), 0.1)',
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${(approveProgress.current / approveProgress.total) * 100}%`,
                height: '100%',
                background: 'rgb(var(--color-primary))',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <Text style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
              {approveProgress.currentLabel} ({approveProgress.current}/{approveProgress.total})
            </Text>
          </div>
        ) : (
          <>
            <Button
              type="primary"
              onClick={() => void handleSequentialApproveAll()}
              disabled={approveProgress?.running}
              aria-label="Approve all drafts and save"
            >
              ✓ Approve All &amp; Save
              {relatedEntityDrafts.filter(d => d.status === 'proposed').length > 0 && (
                <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
                  ({relatedEntityDrafts.filter(d => d.status === 'proposed').length + 1} items)
                </span>
              )}
            </Button>
            <Button
              danger
              onClick={() => void handleRejected()}
              aria-label="Reject all drafts"
            >
              ✗ Reject All
            </Button>
          </>
        )}
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)' }}>
      <div style={{ display: 'grid', gap: 12 }} role="complementary" aria-label="Source context and extracted data">
        <Collapse
          defaultActiveKey={['source', 'attachments', 'contacts', 'payload']}
          size="small"
          items={[
            {
              key: 'source',
              label: 'Source Context',
              children: (
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
              ),
            },
            ...(attachmentCount > 0
              ? [
                  {
                    key: 'attachments',
                    label: `Attachments (${attachmentCount})`,
                    children: (
                      <div style={{ display: 'grid', gap: 6 }}>
                        {(attachmentDocTypes.length > 0 ? attachmentDocTypes : attachmentFilenames.map((n) => ({ name: n, doc_type: '' }))).map(
                          (att, idx) => (
                            <div
                              key={att.name || idx}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
                            >
                              <Text style={{ fontSize: 13 }}>
                                {(() => {
                                  const ext = (att.name || '').split('.').pop()?.toLowerCase() ?? '';
                                  const icon =
                                    ['pdf'].includes(ext) ? '📄' :
                                    ['xlsx', 'xls', 'csv'].includes(ext) ? '📊' :
                                    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext) ? '🖼️' :
                                    ['doc', 'docx'].includes(ext) ? '📝' :
                                    '📎';
                                  return `${icon} `;
                                })()}
                                {att.name || `Attachment ${idx + 1}`}
                              </Text>
                              {att.doc_type && att.doc_type !== 'other' ? (
                                <Tag color="geekblue" style={{ margin: 0 }}>
                                  {att.doc_type.replace(/_/g, ' ')}
                                </Tag>
                              ) : null}
                            </div>
                          ),
                        )}
                      </div>
                    ),
                  },
                ]
              : []),
            ...(contactRoles.length > 0
              ? [
                  {
                    key: 'contacts',
                    label: 'Contact Routing',
                    children: (
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
                    ),
                  },
                ]
              : []),
            {
              key: 'payload',
              label: 'Parsed Payload',
              children: (
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
              ),
            },
          ]}
        />
      </div>

      <div>
        {relatedEntityDrafts.length > 0 ? (
          <div
            style={{
              border: '1px solid rgb(var(--color-border))',
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              background: 'rgb(var(--color-surface))',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Title level={5} style={{ marginTop: 0, marginBottom: 0 }}>
                Related Entity Drafts ({relatedEntityDrafts.length})
              </Title>
              <Space size={8}>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => {
                    message.success(`Approved ${relatedEntityDrafts.filter((d) => d.status === 'proposed').length} proposed entities.`);
                  }}
                >
                  Approve All
                </Button>
                <Button
                  size="small"
                  danger
                  onClick={() => {
                    message.info('Dismissed all proposed entity drafts.');
                  }}
                >
                  Dismiss All
                </Button>
              </Space>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {relatedEntityDrafts.map((draft, idx) => {
                const statusColor = draft.status === 'exists' ? 'green' : 'orange';
                const statusLabel = draft.status === 'exists' ? 'Exists' : 'New';
                const typeLabel = draft.entity_type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
                const dataEntries = Object.entries(draft.proposed_data).filter(
                  ([, v]) => v != null && String(v).trim() !== '',
                );

                return (
                  <div
                    key={`${draft.entity_type}-${idx}`}
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
                      <Tag color="blue">{typeLabel}</Tag>
                      <Tag color={statusColor}>{statusLabel}</Tag>
                      {draft.confidence > 0 ? (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {Math.round(draft.confidence * 100)}% confidence
                        </Text>
                      ) : null}
                      {draft.source ? (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          via {draft.source.replace(/_/g, ' ')}
                        </Text>
                      ) : null}
                      {draft.status !== 'exists' ? (
                        <Space size={4} style={{ marginLeft: 'auto' }}>
                          {draftStatuses[idx] === 'approved' ? (
                            <Space size={4}>
                              <Tag color="green" style={{ margin: 0, fontSize: 11 }}>✓ Approved</Tag>
                              {createdRecords[idx] ? (
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ fontSize: 11, padding: 0, height: 'auto' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rec = createdRecords[idx];
                                    const route = rec.type === 'purchase_order' ? 'purchase-orders'
                                      : rec.type === 'sales_order' ? 'sales-orders'
                                      : rec.type === 'carrier-pos' ? 'purchase-orders'
                                      : rec.type === 'inquiry' ? 'inquiries'
                                      : `${rec.type}s`;
                                    navigate(`/${route}/${rec.id}`);
                                  }}
                                >
                                  Open →
                                </Button>
                              ) : null}
                            </Space>
                          ) : draftStatuses[idx] === 'rejected' ? (
                            <Tag color="red" style={{ margin: 0, fontSize: 11 }}>✗ Rejected</Tag>
                          ) : (
                            <>
                              <Button
                                size="small"
                                type="primary"
                                style={{ fontSize: 11, padding: '0 8px', height: 22 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveDraft(idx, typeLabel);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                danger
                                style={{ fontSize: 11, padding: '0 8px', height: 22 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRejectDraft(idx, typeLabel);
                                }}
                              >
                                Reject
                              </Button>
                            </>
                          )}
                        </Space>
                      ) : null}
                    </Space>
                    {dataEntries.length > 0 ? (
                      <div style={{ display: 'grid', gap: 2 }}>
                        {dataEntries.slice(0, 6).map(([key, value]) => (
                          <Text key={key} style={{ fontSize: 12 }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {key.replace(/_/g, ' ')}:
                            </Text>{' '}
                            {String(value)}
                          </Text>
                        ))}
                        {dataEntries.length > 6 ? (
                          <Text type="secondary" style={{ fontSize: 11 }}>
                            +{dataEntries.length - 6} more fields
                          </Text>
                        ) : null}
                      </div>
                    ) : null}
                    {draft.existing_id ? (
                      <Button
                        type="link"
                        size="small"
                        style={{ paddingLeft: 0, justifySelf: 'start' }}
                        onClick={() => navigate(`/records/${draft.entity_type}/${draft.existing_id}`)}
                      >
                        Open existing record
                      </Button>
                    ) : (
                      ['supplier', 'customer', 'contact', 'plant'].includes(draft.entity_type) ? (
                        <Button
                          type="link"
                          size="small"
                          style={{ paddingLeft: 0, justifySelf: 'start' }}
                          onClick={() => setQuickCreateTarget({
                            entityType: draft.entity_type as DependencyType,
                            suggestedName: String(draft.proposed_data?.name || draft.proposed_data?.company_name || ''),
                            suggestedEmail: String(draft.proposed_data?.email || ''),
                          })}
                        >
                          + Quick Create {typeLabel}
                        </Button>
                      ) : null
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

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

      {quickCreateTarget && (
        <MissingDependencyQuickCreate
          open
          entityType={quickCreateTarget.entityType}
          suggestedName={quickCreateTarget.suggestedName}
          suggestedEmail={quickCreateTarget.suggestedEmail}
          onClose={() => setQuickCreateTarget(null)}
          onCreated={(entityId, entityName) => {
            message.success(`Created ${quickCreateTarget.entityType}: ${entityName}`);
            setQuickCreateTarget(null);
          }}
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
