import axios, { AxiosError } from 'axios';

import { config } from '../config/runtime';

export const PORTAL_TOKEN_HEADER = 'X-Portal-Token';

const portalApiClient = axios.create({
  baseURL: config.API_BASE_URL,
  timeout: 30000,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

portalApiClient.interceptors.request.use((requestConfig) => {
  const headers = requestConfig.headers as Record<string, unknown>;

  if (headers) {
    if (typeof (headers as { delete?: unknown }).delete === 'function') {
      const h = headers as unknown as { delete: (key: string) => void };
      h.delete('Authorization');
      h.delete('authorization');
      h.delete('X-Tenant-ID');
      h.delete('x-tenant-id');
    } else {
      delete headers.Authorization;
      delete headers.authorization;
      delete headers['X-Tenant-ID'];
      delete headers['x-tenant-id'];
    }
  }

  return requestConfig;
});

export interface PortalInvoiceSummary {
  invoice_number: string;
  customer_name: string;
  sales_order_num: string | null;
  pick_up_date: string | null;
  delivery_date: string | null;
  due_date: string | null;
  total_weight: string | null;
  weight_unit: string | null;
  trade_weight?: {
    value?: string | number | null;
    unit?: string | null;
    display?: string | null;
  } | null;
  total_amount: string;
  tax_amount: string | null;
  status: string;
  payment_status: string;
  outstanding_amount: string | null;
  trade_timeline?: Record<string, unknown> | null;
  created_on: string;
}

export interface PortalDocumentReference {
  source_kind: string;
  source_record_type: string;
  source_record_id: string;
  display_name: string;
  original_filename: string;
  mime_type: string;
  byte_size: number | null;
  metadata: Record<string, string | number | boolean | null>;
  created_on: string;
}

export interface PortalFulfillmentTracking {
  fulfillment_number: string;
  status: string;
  supplier_name: string;
  customer_name: string;
  carrier_name: string | null;
  shipping_type: string | null;
  ship_date: string | null;
  expected_delivery: string | null;
  actual_delivery: string | null;
  tracking_numbers: string[];
  document_milestones: Record<string, string | number | boolean | null>;
  trade_timeline?: Record<string, unknown> | null;
  created_on: string;
}

interface PortalGrantSnapshotResponse {
  grant_id: string;
  subject_email: string;
  invoices: PortalInvoiceSummary[];
  documents: PortalDocumentReference[];
  fulfillments: PortalFulfillmentTracking[];
}

export interface PortalGrantSnapshot {
  grantId: string;
  subjectEmail: string;
  invoices: PortalInvoiceSummary[];
  documents: PortalDocumentReference[];
  fulfillments: PortalFulfillmentTracking[];
}

export type PortalServiceErrorCode = 'invalid_or_expired' | 'network' | 'unknown';

export class PortalServiceError extends Error {
  code: PortalServiceErrorCode;

  constructor(code: PortalServiceErrorCode, message: string) {
    super(message);
    this.name = 'PortalServiceError';
    this.code = code;
  }
}

export const buildPortalHeaders = (token: string) => ({
  [PORTAL_TOKEN_HEADER]: token.trim(),
});

const normalizePortalError = (error: unknown): PortalServiceError => {
  if (error instanceof PortalServiceError) {
    return error;
  }

  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<{ detail?: string }>;
    const status = axiosError.response?.status;

    if (status === 404) {
      return new PortalServiceError(
        'invalid_or_expired',
        'This portal link is invalid, expired, or has already been used.'
      );
    }

    if (!axiosError.response) {
      return new PortalServiceError(
        'network',
        'We could not reach the portal service. Please try again.'
      );
    }
  }

  return new PortalServiceError('unknown', 'Unable to load this portal link right now.');
};

const portalGet = async <T>(url: string, token: string): Promise<T> => {
  const response = await portalApiClient.get<T>(url, {
    headers: buildPortalHeaders(token),
  });

  return response.data;
};

export interface PortalGrantSnapshotRequest {
  tenantId: string;
  grantId: string;
  token: string;
}

export const getPortalGrantSnapshot = async ({
  tenantId,
  grantId,
  token,
}: PortalGrantSnapshotRequest): Promise<PortalGrantSnapshot> => {
  try {
    const basePath = `/tenants/${tenantId}/portal/grants/${grantId}`;
    const snapshot = await portalGet<PortalGrantSnapshotResponse>(`${basePath}/snapshot/`, token);

    return {
      grantId: snapshot.grant_id,
      subjectEmail: snapshot.subject_email,
      invoices: snapshot.invoices,
      documents: snapshot.documents,
      fulfillments: snapshot.fulfillments,
    };
  } catch (error) {
    throw normalizePortalError(error);
  }
};
