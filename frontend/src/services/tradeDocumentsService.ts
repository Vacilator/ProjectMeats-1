/**
 * Trade Documents Service
 *
 * Typed API client for the Trade Document Management endpoints.
 * Uses the centralized businessApi (apiClient) for all requests.
 */
import { businessApi } from './businessApi';

// ============================================================================
// Types
// ============================================================================

export interface TradeDocument {
  id: number;
  trade_session: number;
  entity_type: string;
  entity_id: number;
  stage: string;
  direction: 'sent' | 'received';
  document_type: string;
  title: string;
  description: string;
  file: string | null;
  file_size: number | null;
  mime_type: string;
  email_log: number | null;
  generated_by: 'system' | 'user' | 'email_ingest';
  stage_order: number;
  metadata: Record<string, unknown>;
  download_url: string | null;
  email_subject: string | null;
  email_sender: string | null;
  email_date: string | null;
  created_on: string;
  modified_on: string;
}

/** Stage definitions in execution order. */
export const TRADE_STAGES = [
  { key: 'inquiry', label: 'Inquiry' },
  { key: 'purchase_order', label: 'Purchase Order' },
  { key: 'sales_order', label: 'Sales Order' },
  { key: 'carrier_po', label: 'Carrier PO' },
  { key: 'fulfillment', label: 'Fulfillment' },
  { key: 'invoice', label: 'Invoice' },
] as const;

export type TradeStageKey = (typeof TRADE_STAGES)[number]['key'];

interface PaginatedResponse<T> {
  results: T[];
  count: number;
}

// ============================================================================
// Service
// ============================================================================

export const tradeDocumentsService = {
  /** Fetch all documents for a trade session. */
  listByTradeSession: async (tradeSessionId: number | string): Promise<TradeDocument[]> => {
    const response = await businessApi.get<PaginatedResponse<TradeDocument>>(
      '/trade-documents/',
      { params: { trade_session: tradeSessionId, page_size: 200 } },
    );
    return response.data?.results ?? (Array.isArray(response.data) ? response.data : []);
  },

  /** Fetch all documents linked to a specific entity. */
  listByEntity: async (entityType: string, entityId: number | string): Promise<TradeDocument[]> => {
    const response = await businessApi.get<PaginatedResponse<TradeDocument>>(
      '/trade-documents/',
      { params: { entity_type: entityType, entity_id: entityId, page_size: 200 } },
    );
    return response.data?.results ?? (Array.isArray(response.data) ? response.data : []);
  },

  /** Upload a new trade document via multipart form data. */
  upload: async (data: FormData): Promise<TradeDocument> => {
    const response = await businessApi.post<TradeDocument>('/trade-documents/', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },
};
