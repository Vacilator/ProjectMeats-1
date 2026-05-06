import { apiClient } from './apiService';
import type { SettlementEntityType } from './settlementQueueService';

export interface PaymentHistoryRecord {
  id: number;
  amount: string;
  payment_date: string;
  payment_method: string;
  reference_number: string;
  notes: string;
  created_by_name: string;
  created_on: string;
  source_settlement_event_id: number | null;
  source_settlement_reason_code: string | null;
  source_settlement_provider_code: string | null;
  source_settlement_review_action: string | null;
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

export const paymentHistoryService = {
  async listPayments(entityType: SettlementEntityType, entityId: number): Promise<PaymentHistoryRecord[]> {
    const response = await apiClient.get<PaymentHistoryRecord[] | PaginatedResponse<PaymentHistoryRecord>>(
      '/payments/',
      { params: { [entityType]: entityId } },
    );
    return unwrapList(response.data)
      .slice()
      .sort((a, b) => new Date(b.payment_date).getTime() - new Date(a.payment_date).getTime());
  },
};

