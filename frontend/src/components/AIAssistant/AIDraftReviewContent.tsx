import React, { useCallback, useMemo, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { Alert, Button, Collapse, Space, Tag, Typography, message } from 'antd';
import isEqual from 'lodash/isEqual';
import { useNavigate } from 'react-router-dom';

import {
  AIInboxFeedbackActions,
  type AIInboxFeedbackSubmission,
} from '@/components/AIAssistant/AIInboxFeedbackActions';
import { DocumentAuditBadges } from '@/components/AIAssistant/DocumentAuditBadges';
import { MissingDependencyQuickCreate, type DependencyType } from '@/components/Cockpit/MissingDependencyQuickCreate';
import { UnifiedForm } from '@/components/UnifiedForm';
import { aiStaffApi, type PendingReviewItem } from '@/services/aiService';
import {
  mapDraftToInitialValues,
  resolveDraftEntityType,
} from '@/utils/aiDraftFormMapping';
import { buildReviewDetailsPathFromItem } from '@/utils/reviewDetailsPath';
import { getErrorMessage } from '@/utils/errorHelpers';
import {
  createEntitiesSequentially,
  getEntityRoute,
  type EntityDraft,
} from '@/utils/sequentialEntityCreation';

const { Paragraph, Text, Title } = Typography;

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

function useDeepStableValue<T>(value: T): T {
  const ref = useRef(value);

  if (!isEqual(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

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
  const stableItem = useDeepStableValue(item);
  const [quickCreateTarget, setQuickCreateTarget] = useState<{
    entityType: DependencyType;
    suggestedName?: string;
    suggestedEmail?: string;
  } | null>(null);
  const entityType = useMemo(() => resolveDraftEntityType(stableItem), [stableItem]);
  const initialValues = useMemo(() => mapDraftToInitialValues(stableItem), [stableItem]);
  const payload = useMemo(() => asRecord(stableItem?.original_extracted_data), [stableItem]);
  const reviewDetailsPath = useMemo(() => buildReviewDetailsPathFromItem(stableItem), [stableItem]);
  const hasDocumentAuditData = useMemo(
    () => Boolean(
      stableItem?.processing_status ||
      stableItem?.source_metadata ||
      stableItem?.processing_metadata ||
      stableItem?.lineage_summary,
    ),
    [stableItem],
  );
  const sourcePreview = useMemo(
    () =>
      firstString(
        stableItem?.source_summary,
        payload.email_body,
        payload.body,
        payload.text,
      ),
    [payload, stableItem?.source_summary],
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
      if (!stableItem?.id) {
        return;
      }

      resolvingAfterSaveRef.current = true;
      setResolvingState(true);
      try {
        await aiStaffApi.resolvePendingReview(stableItem.id, {
          user_corrected_data: asRecord(result),
        });
        message.success('Draft saved and removed from the AI review queue.');
        onResolved?.(stableItem.id);
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
    [closeOnResolved, onClose, onResolved, setResolvingState, stableItem?.id],
  );

  const handleRejected = useCallback(
    async () => {
      if (!stableItem?.id) {
        return;
      }

      setResolvingState(true);
      try {
        await aiStaffApi.resolvePendingReview(stableItem.id, {
          user_corrected_data: { _rejected: true },
        });
        message.info('Rejected all drafts from this review.');
        onResolved?.(stableItem.id);
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
    [closeOnResolved, onClose, onResolved, setResolvingState, stableItem?.id],
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

  /** Approve a single related entity draft — creates it via backend API */
  const handleApproveDraft = useCallback(async (idx: number, typeLabel: string) => {
    const draft = relatedEntityDrafts[idx];
    if (!draft || draft.status === 'exists') {
      setDraftStatuses((prev) => ({ ...prev, [idx]: 'approved' }));
      message.success(`${typeLabel} already exists.`);
      return;
    }

    setDraftStatuses((prev) => ({ ...prev, [idx]: 'approved' }));

    // Attempt real creation via the sequential service (single entity)
    try {
      const result = await createEntitiesSequentially(
        [{
          entity_type: draft.entity_type,
          status: draft.status,
          existing_id: draft.existing_id,
          proposed_data: draft.proposed_data,
          confidence: draft.confidence,
          source: draft.source,
          originalIndex: idx,
        }],
      );

      if (result.allSucceeded && result.created.length > 0) {
        const created = result.created[0];
        setCreatedRecords((prev) => ({
          ...prev,
          [idx]: { id: String(created.id), type: created.entity_type, label: created.label },
        }));
        message.success(`✅ ${typeLabel} created: ${created.label}`);
      } else if (result.errors.length > 0) {
        setDraftStatuses((prev) => ({ ...prev, [idx]: 'error' }));
        message.error(`Failed to create ${typeLabel}: ${result.errors[0].error}`);
      }
    } catch (error: unknown) {
      setDraftStatuses((prev) => ({ ...prev, [idx]: 'error' }));
      message.error(getErrorMessage(error, `Failed to create ${typeLabel}`));
    }
  }, [relatedEntityDrafts]);

  /** Reject a single related entity draft (local state — excluded when main record is resolved) */
  const handleRejectDraft = useCallback((idx: number, typeLabel: string) => {
    setDraftStatuses((prev) => ({ ...prev, [idx]: 'rejected' }));
    message.info(`Marked ${typeLabel} as rejected.`);
  }, []);

  /** Created records from sequential approve — maps index to entity info */
  const [createdRecords, setCreatedRecords] = useState<Record<number, { id: string; type: string; label: string }>>({});

  /**
   * Sequential approve-all: create entities via backend APIs in dependency order,
   * propagate FKs, then resolve the main review item.
   */
  const handleSequentialApproveAll = useCallback(async () => {
    if (!stableItem?.id) return;

    const pendingDrafts = orderedDrafts.filter(
      (d) => d.status === 'proposed' && draftStatuses[d.originalIndex] !== 'rejected',
    );
    // Total steps = pending drafts + 1 final resolve
    const total = pendingDrafts.length + 1;

    setApproveProgress({ running: true, current: 0, total, currentLabel: 'Starting...' });

    // Convert to EntityDraft format for the sequential creation service
    const entityDrafts: EntityDraft[] = pendingDrafts.map((d) => ({
      entity_type: d.entity_type,
      status: d.status,
      existing_id: d.existing_id,
      proposed_data: d.proposed_data,
      confidence: d.confidence,
      source: d.source,
      originalIndex: d.originalIndex,
    }));

    // Execute sequential entity creation with real backend calls
    const result = await createEntitiesSequentially(entityDrafts, (step) => {
      setApproveProgress({
        running: true,
        current: step.current,
        total,
        currentLabel: step.label,
      });
      // Mark each draft as approved in UI as it's processed
      const matchingDraft = pendingDrafts.find(
        (d) => d.entity_type === step.entity_type && draftStatuses[d.originalIndex] !== 'approved',
      );
      if (matchingDraft) {
        setDraftStatuses((prev) => ({ ...prev, [matchingDraft.originalIndex]: 'approved' }));
      }
    });

    // Update created records for success links
    for (const created of result.created) {
      setCreatedRecords((prev) => ({
        ...prev,
        [created.index]: { id: String(created.id), type: created.entity_type, label: created.label },
      }));
      setDraftStatuses((prev) => ({ ...prev, [created.index]: 'approved' }));
    }

    // Mark errors
    for (const err of result.errors) {
      setDraftStatuses((prev) => ({ ...prev, [err.index]: 'error' }));
    }

    // Show error summary if partial failure
    if (result.errors.length > 0) {
      const errorSummary = result.errors
        .map((e) => `${e.entity_type}: ${e.error}`)
        .join('; ');
      message.warning(
        `⚠️ ${result.created.length} created, ${result.errors.length} failed: ${errorSummary}`,
        6,
      );
    }

    // Final step: resolve the main review item in the AI queue
    setApproveProgress({ running: true, current: total, total, currentLabel: 'Finalizing review...' });

    try {
      const resolvePayload = {
        user_corrected_data: {
          approved_drafts: result.created.map((c) => ({
            entity_type: c.entity_type,
            created_id: c.id,
            label: c.label,
          })),
          rejected_drafts: result.errors.map((e) => ({
            entity_type: e.entity_type,
            error: e.error,
          })),
        },
      };
      await aiStaffApi.resolvePendingReview(stableItem.id, resolvePayload);

      if (result.allSucceeded) {
        message.success(`✅ All ${result.created.length} entities created successfully.`);
      }
      setApproveProgress(null);
      onResolved?.(stableItem.id);
      if (closeOnResolved) {
        onClose?.();
      }
    } catch (error: unknown) {
      message.error(
        getErrorMessage(error, 'Entities were created but failed to mark the review as resolved.'),
      );
      setApproveProgress(null);
    }
  }, [orderedDrafts, draftStatuses, stableItem?.id, onResolved, closeOnResolved, onClose]);

  const handleSurfaceClose = useCallback(() => {
    if (resolvingAfterSaveRef.current) {
      return;
    }
    onClose?.();
  }, [onClose]);

  const handleQuickCreateClose = useCallback(() => {
    setQuickCreateTarget(null);
  }, []);

  const handleQuickCreateDone = useCallback((_entityId: string | number, entityName: string) => {
    setQuickCreateTarget((prev) => {
      if (prev) {
        message.success(`Created ${prev.entityType}: ${entityName}`);
      }
      return null;
    });
  }, []);

  const handleFormSuccess = useCallback(
    (result: unknown) => {
      void handleResolved(result);
    },
    [handleResolved],
  );

  const unsupported = !entityType;

  const formInitialValues = useMemo(() => {
    if (entityType === 'inquiry') {
      return {
        status: 'draft',
        entity_type: 'customer',
        contact_name: firstString(
          initialValues.contact_name,
          payload.contact_name,
          payload.sender_name,
          stableItem?.sender,
        ),
        contact_email: firstString(
          initialValues.contact_email,
          payload.contact_email,
          payload.sender_email,
          payload.from_email,
        ),
        contact_company: firstString(
          initialValues.contact_company,
          payload.contact_company,
          payload.customer_name,
          payload.customer_company,
          payload.supplier_name,
          payload.vendor_name,
        ),
        requested_protein: firstString(
          initialValues.requested_protein,
          payload.requested_protein,
          payload.protein_type,
          payload.type_of_protein,
        ),
        valid_until: firstString(
          initialValues.valid_until,
          typeof payload.valid_until === 'string' ? payload.valid_until : undefined,
          typeof payload.due_date === 'string' ? payload.due_date : undefined,
        ),
        notes: firstString(initialValues.notes, payload.summary, payload.rationale),
        ...initialValues,
      };
    }

    if (!unsupported) return initialValues;
    const itemAny = (stableItem ?? {}) as Record<string, unknown>;
    const contactName = typeof itemAny.contact_name === 'string' ? itemAny.contact_name : '';
    const parts = contactName.split(' ');
    return {
      first_name: parts[0] || '',
      last_name: parts.slice(1).join(' ') || '',
      company: String(itemAny.contact_company || ''),
      email: String(itemAny.sender || ''),
      status: 'draft',
    };
  }, [entityType, initialValues, payload, stableItem, unsupported]);

  if (!stableItem) {
    return null;
  }

  return (
    <div style={{ display: 'grid', gap: 16 }} role="region" aria-label="AI Draft Review">
      {/* Intent Banner */}
        {stableItem.intent_label && (
          <div
            role="banner"
            aria-label={`Intent: ${stableItem.intent_label}${typeof stableItem.confidence_score === 'number' ? ` — ${Math.round(stableItem.confidence_score * 100)}% confidence` : ''}`}
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
          <span>Intent: {stableItem.intent_label}</span>
          {typeof payload.rationale === 'string' && payload.rationale.includes('[Reclassified') && (
            <Tag color="purple" style={{ marginLeft: 0 }}>⚡ Reclassified</Tag>
          )}
          {typeof stableItem.confidence_score === 'number' && (
            <Tag color={
              stableItem.confidence_score >= 0.8 ? 'green' :
              stableItem.confidence_score >= 0.5 ? 'orange' : 'red'
            } style={{ marginLeft: 'auto' }}>
              {Math.round(stableItem.confidence_score * 100)}% confidence
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
                   <Text strong>{stableItem.source_subject || stableItem.intent_label || 'Untitled AI draft'}</Text>
                   <div>
                     <Tag color="blue">{stableItem.intent_label || 'AI Draft'}</Tag>
                     {stableItem.sender ? <Tag>{stableItem.sender}</Tag> : null}
                   </div>
                   <Text type="secondary">
                     Received {stableItem.created_on ? dayjs(stableItem.created_on).format('MMM D, YYYY h:mm A') : 'recently'}
                   </Text>
                   {stableItem.source_document_name ? (
                     <Text type="secondary">Attachment: {stableItem.source_document_name}</Text>
                   ) : null}
                   {hasDocumentAuditData ? (
                     <DocumentAuditBadges
                       processingStatus={stableItem.processing_status}
                       sourceMetadata={stableItem.source_metadata}
                       processingMetadata={stableItem.processing_metadata}
                       lineageSummary={stableItem.lineage_summary}
                     />
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
                  {typeof payload.rationale === 'string' && payload.rationale.trim() ? (
                    <Alert
                      type="info"
                      showIcon
                      message="AI Rationale"
                      description={String(payload.rationale)}
                      style={{ marginTop: 4 }}
                    />
                  ) : null}
                  {payload.field_confidence && typeof payload.field_confidence === 'object' ? (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                      {Object.entries(payload.field_confidence as Record<string, unknown>)
                        .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
                        .sort(([, a], [, b]) => (b as number) - (a as number))
                        .map(([field, conf]) => (
                          <Tag
                            key={field}
                            color={(conf as number) >= 0.8 ? 'green' : (conf as number) >= 0.5 ? 'orange' : 'red'}
                          >
                            {field.replace(/_/g, ' ')}: {Math.round((conf as number) * 100)}%
                          </Tag>
                        ))}
                    </div>
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
                     item={stableItem}
                     onSubmitted={(submission) => {
                       if (!stableItem?.id) {
                         return;
                       }
                       onFeedbackSubmitted?.(stableItem.id, submission);
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
                              <Tag color="green" style={{ margin: 0, fontSize: 11 }}>✓ Created</Tag>
                              {createdRecords[idx] ? (
                                <Button
                                  type="link"
                                  size="small"
                                  style={{ fontSize: 11, padding: 0, height: 'auto' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const rec = createdRecords[idx];
                                    navigate(getEntityRoute(rec.type, rec.id));
                                  }}
                                >
                                  Open →
                                </Button>
                              ) : null}
                            </Space>
                          ) : draftStatuses[idx] === 'error' ? (
                            <Tag color="red" style={{ margin: 0, fontSize: 11 }}>⚠ Failed</Tag>
                          ) : draftStatuses[idx] === 'rejected' ? (
                            <Tag color="red" style={{ margin: 0, fontSize: 11 }}>✗ Rejected</Tag>
                          ) : (
                            <>
                              <Button
                                size="small"
                                type="primary"
                                aria-label={`Approve ${typeLabel}`}
                                style={{ fontSize: 11, padding: '0 8px', height: 22 }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleApproveDraft(idx, typeLabel);
                                }}
                              >
                                Approve
                              </Button>
                              <Button
                                size="small"
                                danger
                                aria-label={`Reject ${typeLabel}`}
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
            type="info"
            showIcon
            message="Unrecognized draft type — showing as Contact record"
            description="The AI could not map this email to a specific entity type. Review the extracted data on the left and approve to create a Contact record, or reject to dismiss."
            style={{ marginBottom: 12 }}
          />
        ) : null}

        <UnifiedForm
          entityType={unsupported ? 'contact' : entityType}
          mode="draft"
          variant="inline"
          isOpen={open}
          onClose={handleSurfaceClose}
          onSuccess={handleFormSuccess}
          initialValues={formInitialValues}
          draftKey={stableItem.id}
        />
      </div>

      {quickCreateTarget && (
        <MissingDependencyQuickCreate
          open
          entityType={quickCreateTarget.entityType}
          suggestedName={quickCreateTarget.suggestedName}
          suggestedEmail={quickCreateTarget.suggestedEmail}
          onClose={handleQuickCreateClose}
          onCreated={handleQuickCreateDone}
        />
      )}
    </div>
    </div>
  );
};
