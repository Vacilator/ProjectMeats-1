import { businessApi } from './businessApi';

export interface PurchaseOrderReviewWorkflowStatus {
  value: string;
  label: string;
}

export interface PurchaseOrderReviewWorkflow {
  current_status: string;
  allowed_transitions: string[];
  statuses: PurchaseOrderReviewWorkflowStatus[];
}

export interface PurchaseOrderReviewRecord {
  id: number;
  order_number: string;
  item_description?: string;
  status?: string;
  total_amount?: string | number | null;
  order_date?: string | null;
  delivery_date?: string | null;
  notes?: string;
  supplier_contact_email?: string;
  total_weight?: string | number | null;
  weight_unit?: string;
}

export interface PurchaseOrderReviewSourceLineage {
  inquiry_id?: number | null;
  inquiry_number?: string;
  rfq_id?: number | null;
  supplier_id?: number | null;
  correlation_key?: string;
  email_log_id?: number | null;
  email_message_id?: string;
  email_thread_id?: string;
}

export interface PurchaseOrderReviewInquiry {
  id: number;
  inquiry_number: string;
  entity_type?: string;
  route_decision?: string;
  requested_protein?: string;
  requested_master_product_name?: string;
  customer_name?: string;
  supplier_name?: string;
  contact_name?: string;
  contact_email?: string;
  source_email_message_id?: string;
  source_email_thread_id?: string;
}

export interface PurchaseOrderReviewRFQ {
  id: number;
  correlation_key?: string;
  status?: string;
  supplier_name?: string;
  recipient_email?: string;
  recipient_name?: string;
  subject?: string;
  sent_at?: string | null;
  provider_message_id?: string;
  provider_thread_id?: string;
}

export interface PurchaseOrderReviewNormalizedQuote {
  availability_status?: string;
  offered_product_name?: string;
  quantity?: string | number | null;
  uom?: string;
  price_per_unit?: string | number | null;
  lead_time_text?: string;
  notes?: string;
}

export interface PurchaseOrderReviewParse {
  parse_status?: string;
  correlation_status?: string;
  correlation_method?: string;
  confidence?: number;
  summary?: string;
}

export interface PurchaseOrderReviewContext {
  purchase_order: PurchaseOrderReviewRecord;
  review_state?: string;
  review_context_complete: boolean;
  workflow: PurchaseOrderReviewWorkflow;
  source_lineage?: PurchaseOrderReviewSourceLineage | null;
  inquiry?: PurchaseOrderReviewInquiry | null;
  rfq?: PurchaseOrderReviewRFQ | null;
  normalized_quote?: PurchaseOrderReviewNormalizedQuote | null;
  supplier_reply_parse?: PurchaseOrderReviewParse | null;
}

export const buildPurchaseOrderReviewPath = (purchaseOrderId: string | number): string =>
  `/purchase-orders/${encodeURIComponent(String(purchaseOrderId))}/review`;

export const purchaseOrderReviewService = {
  getReviewContext: async (
    purchaseOrderId: string | number,
  ): Promise<PurchaseOrderReviewContext> => {
    const response = await businessApi.get<PurchaseOrderReviewContext>(
      `/purchase-orders/${encodeURIComponent(String(purchaseOrderId))}/review-context/`,
    );
    return response.data;
  },
};

