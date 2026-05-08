import { businessApi } from './businessApi';

export type TradeExceptionStatus = 'open' | 'retrying' | 'resolved' | 'exhausted';

export interface TradeSessionSummary {
  id: number;
  trade_id: string;
  status: string;
  route_decision: string;
  inquiry_id: number | null;
  source_email_subject: string;
  source_email_sender: string;
}

export interface TradeExceptionEntityLink {
  entity_type: string;
  entity_id: string;
  label: string;
  status?: string | null;
  record_path?: string | null;
}

export interface TradeExceptionEvent {
  event_id: string;
  event_type: string;
  entity_type: string;
  entity_id: string;
  created_on: string;
}

export interface TradeExceptionQueueItem {
  id: number;
  trade_session_id: number | null;
  trade_id: string;
  failed_step: string;
  reason_code: string;
  error_message: string;
  status: TradeExceptionStatus;
  retry_count: number;
  last_retry_at: string | null;
  resolved_by: string;
  resolved_at: string | null;
  resolution_notes: string;
  entity_type: string;
  entity_id: string;
  source_event_id: string;
  created_on: string;
  modified_on: string;
  can_retry: boolean;
  can_resolve: boolean;
  active_sibling_count: number;
  trade_session?: TradeSessionSummary | null;
  related_entities?: TradeExceptionEntityLink[];
  record_path?: string | null;
}

export interface TradeExceptionQueueDetail extends TradeExceptionQueueItem {
  stack_trace: string;
  context_payload: Record<string, unknown>;
  recent_events: TradeExceptionEvent[];
  trade_resumable: boolean;
  trade_resumed?: boolean;
  resume_blocked_reason?: string;
}

export interface TradeExceptionQueueListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: TradeExceptionQueueItem[];
}

export interface TradeExceptionListParams {
  status?: string;
  trade_session_id?: string | number;
  trade_id?: string;
  failed_step?: string;
  reason_code?: string;
  q?: string;
  page?: number;
  page_size?: number;
}

const normalizeListResponse = (data: unknown): TradeExceptionQueueListResponse => {
  if (Array.isArray(data)) {
    return {
      count: data.length,
      next: null,
      previous: null,
      results: data as TradeExceptionQueueItem[],
    };
  }

  const payload = (data ?? {}) as Partial<TradeExceptionQueueListResponse>;
  return {
    count: payload.count ?? (Array.isArray(payload.results) ? payload.results.length : 0),
    next: payload.next ?? null,
    previous: payload.previous ?? null,
    results: Array.isArray(payload.results) ? payload.results : [],
  };
};

class TradeExceptionQueueService {
  private readonly baseUrl = '/workspace/trade-exceptions/';

  async listExceptions(params?: TradeExceptionListParams): Promise<TradeExceptionQueueListResponse> {
    const response = await businessApi.get(this.baseUrl, { params });
    return normalizeListResponse(response.data);
  }

  async getException(id: string | number): Promise<TradeExceptionQueueDetail> {
    const response = await businessApi.get<TradeExceptionQueueDetail>(`${this.baseUrl}${id}/`);
    return response.data;
  }

  async retryException(id: string | number): Promise<TradeExceptionQueueDetail> {
    const response = await businessApi.post<TradeExceptionQueueDetail>(`${this.baseUrl}${id}/retry/`, {});
    return response.data;
  }

  async resolveException(
    id: string | number,
    payload: { resolution_notes: string },
  ): Promise<TradeExceptionQueueDetail> {
    const response = await businessApi.post<TradeExceptionQueueDetail>(
      `${this.baseUrl}${id}/resolve/`,
      payload,
    );
    return response.data;
  }
}

export const tradeExceptionQueueService = new TradeExceptionQueueService();
