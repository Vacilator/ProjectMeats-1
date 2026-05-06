import { businessApi } from './businessApi';

export type SettlementEventState =
  | 'received'
  | 'validated'
  | 'duplicate'
  | 'ready_to_post'
  | 'posted'
  | 'ignored'
  | 'failed';

export type SettlementReasonCode =
  | 'exact_invoice_match'
  | 'exact_sales_order_match'
  | 'exact_purchase_order_match'
  | 'manual_invoice_override'
  | 'manual_sales_order_override'
  | 'manual_purchase_order_override'
  | 'accountant_rejected'
  | 'missing_reference'
  | 'reference_not_found'
  | 'amount_mismatch'
  | 'ambiguous_match'
  | 'unsupported_direction'
  | '';

export interface SettlementEvent {
  id: number;
  source: number;
  source_public_id: string;
  source_name: string;
  provider_code: string;
  provider_account_reference: string;
  external_event_id: string;
  event_type: string;
  direction: string;
  occurred_at: string;
  amount: string;
  currency: string;
  raw_payload: string;
  raw_payload_sha256: string;
  idempotency_key: string;
  state: SettlementEventState;
  normalized_payload: Record<string, unknown>;
  reconciliation_reason_code: SettlementReasonCode;
  matched_purchase_order: number | null;
  matched_sales_order: number | null;
  matched_invoice: number | null;
  payment_transaction: number | null;
  reviewed_by: number | null;
  reviewed_by_name: string;
  reviewed_at: string | null;
  review_note: string;
  delivery_count: number;
  received_at: string;
  last_received_at: string;
  processed_at: string | null;
  processing_task_id: string;
  last_error: string;
  created_on: string;
  modified_on: string;
}

export interface SettlementQueueFilters {
  state?: string;
  reason_code?: string;
  queue_only?: boolean;
}

export interface SettlementOverridePayload {
  target_type: 'invoice' | 'sales_order' | 'purchase_order';
  target_id: number;
  review_note?: string;
}

export interface SettlementRejectPayload {
  review_note?: string;
}

type PaginatedResponse<T> = {
  results?: T[];
};

function normalizeListResponse<T>(data: T[] | PaginatedResponse<T>): T[] {
  if (Array.isArray(data)) {
    return data;
  }
  return Array.isArray(data.results) ? data.results : [];
}

export const settlementEventsService = {
  async list(filters: SettlementQueueFilters = {}): Promise<SettlementEvent[]> {
    const response = await businessApi.get<SettlementEvent[] | PaginatedResponse<SettlementEvent>>(
      '/settlement-events/',
      { params: filters }
    );
    return normalizeListResponse(response.data);
  },

  async get(id: number): Promise<SettlementEvent> {
    const response = await businessApi.get<SettlementEvent>(`/settlement-events/${id}/`);
    return response.data;
  },

  async override(id: number, payload: SettlementOverridePayload): Promise<SettlementEvent> {
    const response = await businessApi.post<SettlementEvent>(`/settlement-events/${id}/override/`, payload);
    return response.data;
  },

  async reject(id: number, payload: SettlementRejectPayload): Promise<SettlementEvent> {
    const response = await businessApi.post<SettlementEvent>(`/settlement-events/${id}/reject/`, payload);
    return response.data;
  },
};
