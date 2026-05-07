import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Button, Modal, Space, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';

import { EntityFormSurface } from '@/components/Shared/EntityFormSurface';
import { aiStaffApi, type PendingReviewItem } from '@/services/aiService';
import { buildReviewDetailsPathFromItem } from '@/utils/reviewDetailsPath';

const { Paragraph, Text, Title } = Typography;

type AIDraftReviewModalProps = {
  open: boolean;
  item: PendingReviewItem | null;
  onClose: () => void;
  onResolved?: (reviewId: string) => void;
};

type AIDraftReviewContentProps = {
  open: boolean;
  item: PendingReviewItem | null;
  onClose?: () => void;
  onResolved?: (reviewId: string) => void;
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

const firstNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const normalizeDate = (value: unknown): string | undefined => {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }
  return parsed.toISOString().slice(0, 10);
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const mapPurchaseOrderItems = (items: unknown): Array<Record<string, unknown>> => {
  if (!Array.isArray(items)) {
    return [];
  }

  return items.reduce<Array<Record<string, unknown>>>((accumulator, item, index) => {
    const record = asRecord(item);
    const description = firstString(
      record.product_description,
      record.description,
      record.item_description,
    );
    const quantity = firstNumber(record.quantity);
    const totalNetWeight = firstNumber(
      record.total_net_weight,
      record.total_weight,
      record.weight,
    );
    const proteinType = firstString(record.protein_type, record.type_of_protein);
    const weightUnit = firstString(record.uom, record.weight_unit);

    if (!description && quantity == null && totalNetWeight == null) {
      return accumulator;
    }

    accumulator.push({
      line_number: index + 1,
      product_description: description,
      quantity,
      total_net_weight: totalNetWeight,
      protein_type: proteinType,
      uom: weightUnit,
      notes: firstString(record.notes),
    });
    return accumulator;
  }, []);
};

export const resolveReviewEntityType = (item: PendingReviewItem | null): string => {
  const explicit = firstString(item?.review_entity_type);
  if (explicit) {
    return explicit;
  }

  const documentType = String(item?.document_type || '').toLowerCase();
  if (['purchase_order', 'po'].includes(documentType)) {
    return 'purchase_order';
  }
  if (
    ['bill_of_lading', 'bol', 'shipment', 'carrier_purchase_order', 'carrier_po'].includes(
      documentType,
    )
  ) {
    return 'carrier-pos';
  }
  if (['inquiry', 'quote'].includes(documentType)) {
    return 'inquiry';
  }
  return '';
};

export const mapDraftToInitialValues = (item: PendingReviewItem | null): Record<string, unknown> => {
  const payload = asRecord(item?.original_extracted_data);
  const entityType = resolveReviewEntityType(item);
  const items = mapPurchaseOrderItems(payload.items);
  const firstItem = items[0] ? asRecord(items[0]) : {};
  const summary = firstString(
    payload.notes,
    payload.summary,
    payload.email_body,
    payload.body,
    payload.text,
  );

  if (entityType === 'carrier-pos') {
    return {
      our_carrier_po_num: firstString(
        payload.our_carrier_po_num,
        payload.carrier_po_number,
        payload.bol_number,
      ),
      carrier_name: firstString(payload.carrier_name),
      pick_up_date: normalizeDate(payload.pick_up_date ?? payload.pickup_date),
      delivery_date: normalizeDate(payload.delivery_date),
      quantity: firstNumber(payload.quantity, firstItem.quantity),
      total_weight: firstNumber(payload.total_weight, firstItem.total_net_weight),
      weight_unit: firstString(payload.weight_unit, firstItem.uom, 'LBS'),
      type_of_protein: firstString(payload.type_of_protein, firstItem.protein_type),
      items,
      notes: summary,
    };
  }

  if (entityType === 'purchase_order') {
    return {
      order_number: firstString(
        payload.order_number,
        payload.po_number,
        payload.purchase_order_number,
      ),
      order_date: normalizeDate(payload.order_date) ?? todayIso(),
      delivery_date: normalizeDate(payload.delivery_date),
      quantity: firstNumber(payload.quantity, firstItem.quantity),
      total_weight: firstNumber(payload.total_weight, firstItem.total_net_weight),
      weight_unit: firstString(payload.weight_unit, firstItem.uom, 'LBS'),
      item_description: firstString(payload.item_description, firstItem.product_description),
      type_of_protein: firstString(payload.type_of_protein, firstItem.protein_type),
      supplier_contact_name: firstString(payload.vendor_name, payload.supplier_name),
      supplier_contact_email: firstString(payload.from_email, payload.sender_email),
      items,
      notes: summary,
    };
  }

  if (entityType === 'inquiry') {
    return {
      entity_type: firstString(
        payload.entity_type,
        payload.inquiry_entity_type,
        payload.customer_name || payload.customer_company ? 'customer' : undefined,
        payload.supplier_name || payload.vendor_name ? 'supplier' : undefined,
      ),
      contact_name: firstString(payload.contact_name, payload.sender_name, payload.sender),
      contact_email: firstString(payload.contact_email, payload.sender_email, payload.from_email),
      contact_company: firstString(
        payload.contact_company,
        payload.customer_name,
        payload.customer_company,
        payload.supplier_name,
        payload.vendor_name,
      ),
      requested_protein: firstString(
        payload.requested_protein,
        payload.protein_type,
        payload.type_of_protein,
      ),
      valid_until: normalizeDate(payload.valid_until ?? payload.due_date ?? payload.requested_by_date),
      notes: firstString(summary, payload.rationale),
    };
  }

  return payload;
};

export const AIDraftReviewContent: React.FC<AIDraftReviewContentProps> = ({
  open,
  item,
  onClose,
  onResolved,
  closeOnResolved = false,
  onResolvingChange,
}) => {
  const navigate = useNavigate();
  const resolvingAfterSaveRef = useRef(false);
  const entityType = useMemo(() => resolveReviewEntityType(item), [item]);
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
          <EntityFormSurface
            entityType={entityType}
            mode="create"
            variant="inline"
            isOpen={open}
            onClose={handleSurfaceClose}
            onSuccess={(result) => {
              void handleResolved(result);
            }}
            initialValues={initialValues}
            forceUniversal
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
        closeOnResolved
        onResolvingChange={setResolving}
      />
    </Modal>
  );
};

export default AIDraftReviewModal;
