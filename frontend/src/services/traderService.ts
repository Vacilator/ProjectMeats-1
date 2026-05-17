/**
 * Trader Service — API client for the Trade Pipeline endpoints.
 *
 * Provides typed wrappers for the Trader Cockpit APIs:
 * - initiate trade
 * - list active trades
 * - advance trade
 * - get trade status
 *
 * AI-backed endpoints use withRetry for transient failure resilience.
 */
import { businessApi } from './businessApi';
import { withRetry } from '../utils/apiRetry';

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
  current_step: string | null;
  inquiry_id: string;
  customer_name: string | null;
  source_email_subject: string;
  initiated_at: string | null;
  updated_at: string | null;
  // Linked entity IDs for stepper deep-linking
  supplier_purchase_order_id?: string | null;
  sales_order_id?: string | null;
  carrier_purchase_order_id?: string | null;
  fulfillment_id?: string | null;
  invoice_id?: string | null;
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
  current_step: string | null;
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
  current_step: string | null;
  initiated_at: string | null;
  inquiry_id: string;
  customer_name: string | null;
  lineage: Record<string, unknown>;
  dependencies: DependencyCheckResult;
}

export interface SmartInitiateRequest extends TradeInitiateRequest {
  weight?: string;
  delivery_context?: 'customer_pickup' | 'supplier_delivery';
}

export interface ContextSuggestion {
  field: string;
  value: string;
  confidence: number;
  source: string;
  reason: string;
}

export interface SmartInitiateResponse extends TradeInitiateResponse {
  context_suggestions: ContextSuggestion[];
}

export interface TradeProposal {
  id: string;
  title: string;
  confidence: number;
  source: 'email' | 'history' | 'pattern' | 'market';
  route: 'FULFILL' | 'BROKER';
  customer_name: string | null;
  supplier_name: string | null;
  type_of_protein: string | null;
  weight: string | null;
  delivery_context: 'customer_pickup' | 'supplier_delivery' | null;
  suggested_fields: ContextSuggestion[];
  created_at: string;
  expires_at: string | null;
  status: 'pending' | 'executed' | 'dismissed' | 'expired';
}

// ============================================================================
// API Methods
// ============================================================================

export const traderService = {
  /** List trade sessions — returns ALL statuses for client-side filtering */
  async listActiveTrades(): Promise<TradeListResponse> {
    const response = await businessApi.get('/trades/');
    return response.data as TradeListResponse;
  },

  /** Initiate a new trade */
  async initiateTrade(data: TradeInitiateRequest): Promise<TradeInitiateResponse> {
    const response = await businessApi.post('/trades/initiate/', data);
    return response.data as TradeInitiateResponse;
  },

  /** Smart initiate — richer payload with AI context suggestions */
  async smartInitiate(data: SmartInitiateRequest): Promise<SmartInitiateResponse> {
    return withRetry(async () => {
      const response = await businessApi.post('/trades/smart-initiate/', data);
      return response.data as SmartInitiateResponse;
    });
  },

  /** Advance a trade through the orchestrator */
  async advanceTrade(tradeSessionId: string, advanceThrough?: string): Promise<TradeAdvanceResponse> {
    const response = await businessApi.post(`/trades/${tradeSessionId}/advance/`, {
      advance_through: advanceThrough,
    }, {
      timeout: 60_000, // Trade advance can be slow (creates POs, sends emails, etc.)
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

  /** Fetch AI-generated trade proposals for the current tenant */
  async getProposals(): Promise<TradeProposal[]> {
    return withRetry(async () => {
      const response = await businessApi.get('/trades/proposals/');
      const payload = response.data;
      if (Array.isArray(payload)) return payload as TradeProposal[];
      const results = (payload as { results?: TradeProposal[] } | null)?.results;
      return Array.isArray(results) ? results : [];
    });
  },

  /** Execute (approve) an AI trade proposal */
  async executeProposal(proposalId: string): Promise<TradeInitiateResponse> {
    const response = await businessApi.post(`/trades/${proposalId}/execute-proposal/`);
    return response.data as TradeInitiateResponse;
  },

  /** Submit feedback on a proposal */
  async submitProposalFeedback(proposalId: string, signal: 'thumbs_up' | 'thumbs_down', comment?: string): Promise<void> {
    await businessApi.post(`/trades/${proposalId}/proposal-feedback/`, { signal, comment });
  },

  // --------------------------------------------------------------------------
  // Email dispatch (fulfillment + invoice)
  // --------------------------------------------------------------------------

  /** Send fulfillment notification email (shipped or delivered) */
  async sendFulfillmentNotification(
    fulfillmentId: string,
    type: 'shipped' | 'delivered' = 'shipped',
  ): Promise<{ status: string; recipient: string; message_id: string }> {
    const response = await businessApi.post(
      `/fulfillments/${fulfillmentId}/send-notification/`,
      { type },
    );
    return response.data;
  },

  /** Send invoice email with PDF attachment */
  async sendInvoiceEmail(
    invoiceId: string,
  ): Promise<{ status: string; recipient: string; message_id: string }> {
    const response = await businessApi.post(
      `/invoices/${invoiceId}/email-invoice/`,
    );
    return response.data;
  },
};
