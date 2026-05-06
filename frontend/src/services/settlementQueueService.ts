import { apiClient } from './apiService';

export type SettlementEntityType = 'invoice' | 'sales_order' | 'purchase_order';
export type SettlementEventState =
  | 'received'
  | 'validated'
  | 'duplicate'
  | 'ready_to_post'
  | 'posted'
  | 'ignored'
  | 'failed';

export interface SettlementCandidateMatch {
  entity_type: SettlementEntityType;
  object_id: number;
  reference_value: string;
  outstanding_amount: string;
  exact_amount_match: boolean;
}

export interface SettlementEventRecord {
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
  reconciliation_reason_code: string;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_action: string;
  review_note: string;
  matched_purchase_order: number | null;
  matched_sales_order: number | null;
  matched_invoice: number | null;
  matched_entity_type: SettlementEntityType | null;
  matched_entity_reference: string | null;
  payment_transaction: number | null;
  delivery_count: number;
  received_at: string;
  last_received_at: string;
  processed_at: string | null;
  processing_task_id: string;
  last_error: string;
  created_on: string;
  modified_on: string;
  candidate_matches?: SettlementCandidateMatch[];
}

interface PaginatedResponse<T> {
  results?: T[];
}

const unwrapList = <T>(data: T[] | PaginatedResponse<T>): T[] => {
  if (Array.isArray(data)) {
    return data;
  }
  return Array.isArray(data?.results) ? data.results : [];
};

export const settlementQueueService = {
  async listSettlementEvents(state?: SettlementEventState | 'all'): Promise<SettlementEventRecord[]> {
    const params = state && state !== 'all' ? { state } : undefined;
    const response = await apiClient.get<SettlementEventRecord[] | PaginatedResponse<SettlementEventRecord>>(
      '/settlement-events/',
      { params },
    );
    return unwrapList(response.data);
  },

  async getSettlementEvent(eventId: number): Promise<SettlementEventRecord> {
    const response = await apiClient.get<SettlementEventRecord>(`/settlement-events/${eventId}/`);
    return response.data;
  },

  async approveSettlementEvent(eventId: number, payload: { note: string }): Promise<SettlementEventRecord> {
    const response = await apiClient.post<SettlementEventRecord>(`/settlement-events/${eventId}/approve/`, payload);
    return response.data;
  },

  async relinkSettlementEvent(
    eventId: number,
    payload: { entity_type: SettlementEntityType; object_id: number; note: string },
  ): Promise<SettlementEventRecord> {
    const response = await apiClient.post<SettlementEventRecord>(`/settlement-events/${eventId}/relink/`, payload);
    return response.data;
  },

  async rejectSettlementEvent(eventId: number, payload: { note: string }): Promise<SettlementEventRecord> {
    const response = await apiClient.post<SettlementEventRecord>(`/settlement-events/${eventId}/reject/`, payload);
    return response.data;
  },
};

