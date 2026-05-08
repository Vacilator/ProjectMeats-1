/**
 * Trader Service — API client for the Trade Pipeline endpoints.
 *
 * Provides typed wrappers for the Trader Cockpit APIs:
 * - initiate trade
 * - list active trades
 * - advance trade
 * - get trade status
 */
import { businessApi } from './businessApi';

// ============================================================================
// Types
// ============================================================================

export interface DependencyItem {
  entity_type: string;
  label: string;
  required: boolean;
  satisfied: boolean;
  entity_id: string | null;
  entity_name: string | null;
  hint: string;
}

export interface DependencyCheckResult {
  inquiry_id: string;
  route: string;
  all_satisfied: boolean;
  missing_count: number;
  total_count: number;
  checklist: DependencyItem[];
}

export interface TradeSession {
  id: string;
  trade_id: string;
  status: string;
  route: string;
  current_step: string;
  inquiry_id: string;
  customer_name: string | null;
  source_email_subject: string;
  initiated_at: string | null;
  updated_at: string | null;
}

export interface TradeListResponse {
  count: number;
  results: TradeSession[];
}

export interface TradeInitiateRequest {
  customer_id?: string;
  supplier_id?: string;
  route?: 'FULFILL' | 'BROKER';
  description?: string;
  type_of_protein?: string;
}

export interface TradeInitiateResponse {
  trade_id: string;
  trade_session_id: string;
  inquiry_id: string;
  route: string;
  dependencies: DependencyCheckResult;
}

export interface StepExecuted {
  step: string;
  success: boolean;
  message: string;
  entity_id: string | null;
  entity_type: string | null;
}

export interface TradeAdvanceResponse {
  trade_id: string;
  inquiry_id: string;
  route: string;
  current_step: string;
  completed: boolean;
  blocked: boolean;
  blocked_reason: string;
  steps_executed: StepExecuted[];
}

export interface TradeStatusResponse {
  trade_id: string;
  trade_session_id: string;
  status: string;
  route: string;
  current_step: string;
  initiated_at: string | null;
  inquiry_id: string;
  customer_name: string | null;
  lineage: Record<string, unknown>;
  dependencies: DependencyCheckResult;
}

// ============================================================================
// API Methods
// ============================================================================

export const traderService = {
  /** List active trade sessions */
  async listActiveTrades(): Promise<TradeListResponse> {
    const response = await businessApi.get('/trades/');
    return response.data as TradeListResponse;
  },

  /** Initiate a new trade */
  async initiateTrade(data: TradeInitiateRequest): Promise<TradeInitiateResponse> {
    const response = await businessApi.post('/trades/initiate/', data);
    return response.data as TradeInitiateResponse;
  },

  /** Advance a trade through the orchestrator */
  async advanceTrade(tradeSessionId: string, advanceThrough?: string): Promise<TradeAdvanceResponse> {
    const response = await businessApi.post(`/trades/${tradeSessionId}/advance/`, {
      advance_through: advanceThrough,
    });
    return response.data as TradeAdvanceResponse;
  },

  /** Get full trade status with lineage */
  async getTradeStatus(tradeSessionId: string): Promise<TradeStatusResponse> {
    const response = await businessApi.get(`/trades/${tradeSessionId}/status/`);
    return response.data as TradeStatusResponse;
  },

  /** Check dependencies for an inquiry */
  async checkDependencies(inquiryId: string): Promise<DependencyCheckResult> {
    const response = await businessApi.get(`/inquiries/${inquiryId}/dependency-check/`);
    return response.data as DependencyCheckResult;
  },
};
