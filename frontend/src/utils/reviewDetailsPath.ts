import type { PendingReviewItem } from '@/services/aiService';
import { normalizeEntityType } from './entityTypeRegistry';

const REVIEW_BASE_URL = 'https://projectmeats.local';

const withWorkflowSearch = (path: string, searchParams?: URLSearchParams): string => {
  const params = searchParams ? new URLSearchParams(searchParams) : new URLSearchParams();
  params.set('tab', 'workflows');
  params.set('viewProcessFlow', '1');
  const query = params.toString();
  return query ? `${path}?${query}` : path;
};

export const buildRecordWorkflowPath = (
  entityType: string,
  entityId: string | number,
  options?: {
    executionId?: string | null;
  },
): string => {
  const params = new URLSearchParams();
  if (options?.executionId) {
    params.set('executionId', String(options.executionId));
  }

  return withWorkflowSearch(
    `/records/${encodeURIComponent(normalizeEntityType(entityType))}/${encodeURIComponent(String(entityId))}`,
    params,
  );
};

const getIdFromPayload = (
  payload: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }

  return null;
};

export const buildReviewDetailsPathFromTargetUrl = (targetUrl?: string | null): string | null => {
  if (!targetUrl || !targetUrl.trim()) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(targetUrl, REVIEW_BASE_URL);
  } catch {
    return null;
  }

  const pathname = parsed.pathname || '';
  const pathParts = pathname.split('/').filter(Boolean);

  if (pathParts[0] === 'records' && pathParts[1] && pathParts[2]) {
    return withWorkflowSearch(
      `/records/${encodeURIComponent(normalizeEntityType(pathParts[1]))}/${encodeURIComponent(pathParts[2])}`,
      parsed.searchParams,
    );
  }

  if (pathParts[0] === 'purchase-orders' && pathParts[1]) {
    return buildRecordWorkflowPath('purchase_order', pathParts[1]);
  }

  if (pathParts[0] === 'sales-orders' && pathParts[1]) {
    return buildRecordWorkflowPath('sales_order', pathParts[1]);
  }

  if (pathParts[0] === 'inquiries') {
    const inquiryId = parsed.searchParams.get('inquiry');
    if (inquiryId) {
      return buildRecordWorkflowPath('inquiry', inquiryId);
    }
  }

  return null;
};

export const buildReviewDetailsPathFromItem = (
  item: Pick<PendingReviewItem, 'original_extracted_data' | 'review_entity_type' | 'review_target_url'> | null,
  result?: unknown,
): string | null => {
  const payload =
    item?.original_extracted_data &&
    typeof item.original_extracted_data === 'object' &&
    !Array.isArray(item.original_extracted_data)
      ? (item.original_extracted_data as Record<string, unknown>)
      : {};

  const resultRecord =
    result && typeof result === 'object' && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : {};

  const explicitTarget = buildReviewDetailsPathFromTargetUrl(item?.review_target_url);
  if (explicitTarget) {
    return explicitTarget;
  }

  const entityType = normalizeEntityType(String(item?.review_entity_type || ''));
  const idFromResult = getIdFromPayload(resultRecord, ['id', 'pk', 'uuid']);
  if (entityType && idFromResult) {
    return buildRecordWorkflowPath(entityType, idFromResult);
  }

  const entityCandidates: Record<string, string[]> = {
    inquiry: ['inquiry_id', 'id'],
    purchase_order: ['purchase_order_id', 'related_order_id', 'order_id', 'id'],
    sales_order: ['sales_order_id', 'order_id', 'id'],
    'carrier-pos': ['carrier_purchase_order_id', 'carrier_po_id', 'id'],
  };

  const idFromPayload = getIdFromPayload(payload, entityCandidates[entityType] || []);
  if (entityType && idFromPayload) {
    return buildRecordWorkflowPath(entityType, idFromPayload);
  }

  return null;
};
