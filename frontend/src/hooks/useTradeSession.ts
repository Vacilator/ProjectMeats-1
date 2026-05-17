/**
 * useTradeSession — Resolves trade session context for any trade entity.
 *
 * For inquiry entities, directly returns the trade session data from the inquiry API.
 * For other trade entities (PO, SO, CarrierPO, Fulfillment, Invoice), resolves back
 * to the parent inquiry via the relationships API, then fetches the trade session data.
 *
 * Returns: { tradeSessionId, tradeStatus, currentStep, inquiryId, isLoading }
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';

const TRADE_ENTITY_TYPES = new Set([
  'inquiry',
  'purchase_order',
  'sales_order',
  'carrier_purchase_order',
  'fulfillment',
  'invoice',
]);

interface TradeSessionContext {
  tradeSessionId: string | number | null;
  tradeStatus: string;
  currentStep: string;
  inquiryId: string | null;
  isLoading: boolean;
}

type RelationshipsPayload = {
  relationships?: Record<string, unknown[]>;
};

function extractInquiryId(relationships: Record<string, unknown[]>): string | null {
  const inquiries = relationships.inquiry ?? relationships.inquiries ?? [];
  if (!Array.isArray(inquiries) || inquiries.length === 0) return null;

  const first = inquiries[0];
  if (!first || typeof first !== 'object') return null;
  const rec = first as Record<string, unknown>;
  const id = rec.id ?? rec.pk ?? rec.uuid;
  return id != null ? String(id) : null;
}

export function useTradeSession(
  entityType: string,
  entityId: string | number | undefined,
): TradeSessionContext {
  const normalizedType = String(entityType || '').trim().toLowerCase();
  const normalizedId = entityId ? String(entityId) : '';
  const isTradeEntity = TRADE_ENTITY_TYPES.has(normalizedType);
  const isInquiry = normalizedType === 'inquiry';

  // For non-inquiry trade entities, resolve the parent inquiry via relationships
  const relQueryKey = useMemo(
    () => withTenantQueryKey('trade-session-rel', normalizedType, normalizedId),
    [normalizedType, normalizedId],
  );

  const { data: relData, isLoading: relLoading } = useQuery({
    queryKey: relQueryKey,
    queryFn: async () => {
      const res = await businessApi.get(
        `/system/entities/${normalizedType}/${encodeURIComponent(normalizedId)}/relationships/`,
      );
      return (res.data || {}) as RelationshipsPayload;
    },
    enabled: isTradeEntity && !isInquiry && Boolean(normalizedId),
    staleTime: 60_000,
  });

  const resolvedInquiryId = useMemo(() => {
    if (isInquiry) return normalizedId || null;
    if (!relData?.relationships) return null;
    return extractInquiryId(relData.relationships);
  }, [isInquiry, normalizedId, relData]);

  // Fetch the inquiry to get trade session data
  const inquiryQueryKey = useMemo(
    () => withTenantQueryKey('trade-session-inquiry', resolvedInquiryId ?? ''),
    [resolvedInquiryId],
  );

  const { data: inquiryData, isLoading: inquiryLoading } = useQuery({
    queryKey: inquiryQueryKey,
    queryFn: async () => {
      const res = await businessApi.get(`inquiries/${resolvedInquiryId}/`);
      const d = res.data as Record<string, unknown>;
      return {
        trade_session_id: d.trade_session_id as string | number | null,
        trade_session_status: String(d.trade_session_status ?? ''),
        trade_session_current_step: String(d.trade_session_current_step ?? ''),
      };
    },
    enabled: Boolean(resolvedInquiryId),
    staleTime: 30_000,
  });

  return {
    tradeSessionId: inquiryData?.trade_session_id ?? null,
    tradeStatus: inquiryData?.trade_session_status ?? '',
    currentStep: inquiryData?.trade_session_current_step ?? '',
    inquiryId: resolvedInquiryId,
    isLoading: (isTradeEntity && !isInquiry && relLoading) || (Boolean(resolvedInquiryId) && inquiryLoading),
  };
}
