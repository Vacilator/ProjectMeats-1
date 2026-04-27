/**
 * General API Service for ProjectMeats Business Management
 *
 * Handles communication with all Django REST API endpoints.
 * 
 * Wave S1: JWT Authentication Support
 * - Uses Bearer tokens for JWT authentication
 * - Falls back to Token auth for legacy compatibility
 * - Automatic token refresh on 401 responses
 * - Session expired modal instead of hard redirects
 */
import axios, { AxiosError as AxiosErrorType, InternalAxiosRequestConfig } from 'axios';
import * as Sentry from '@sentry/react';
import { config } from '../config/runtime';
import { logger } from '../utils/logger';
import {
  getAuthHeader,
  needsRefresh,
  refreshAccessToken,
  clearTokens,
  isUsingJwt,
} from './jwtService';
import { triggerGlobalSessionExpired } from '../contexts/SessionManagerContext';
import { ApiServiceError, createCircuitBreakerError } from './apiErrors';

// API Configuration
const API_BASE_URL = config.API_BASE_URL;

// Extract base URL without /api/v1/ suffix for admin endpoints
const BASE_DOMAIN = API_BASE_URL.replace(/\/api\/v1\/?$/, '');

// Flag to prevent redirect loops
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: InternalAxiosRequestConfig) => void;
  reject: (error: unknown) => void;
  config: InternalAxiosRequestConfig;
}> = [];

const processQueue = (error: unknown | null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      // Retry with new token
      const authHeader = getAuthHeader();
      if (authHeader && prom.config.headers) {
        prom.config.headers.Authorization = authHeader;
      }
      prom.resolve(prom.config);
    }
  });
  failedQueue = [];
};

const stripJsonContentTypeForFormData = (config: InternalAxiosRequestConfig) => {
  if (typeof FormData === 'undefined') return;
  if (!(config.data instanceof FormData)) return;

  // Axios may represent headers as an AxiosHeaders instance (with .delete())
  // or a plain object. We need to handle both.
  const headersAny = config.headers as any;
  if (!headersAny) return;

  if (typeof headersAny.delete === 'function') {
    headersAny.delete('Content-Type');
    headersAny.delete('content-type');
  } else {
    delete headersAny['Content-Type'];
    delete headersAny['content-type'];
  }
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Allow cookies for authentication
  xsrfCookieName: 'csrftoken', // Django's CSRF cookie name
  xsrfHeaderName: 'X-CSRFToken', // Django's expected CSRF header
});

// Admin client for /admin/* endpoints (no /api/v1/ prefix)
const adminClient = axios.create({
  baseURL: BASE_DOMAIN,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
  xsrfCookieName: 'csrftoken',
  xsrfHeaderName: 'X-CSRFToken',
});

// Request interceptor for authentication and tenant context (apiClient)
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // IMPORTANT: When uploading files, ensure we do NOT force application/json.
      // Axios will set the correct multipart boundary automatically.
      stripJsonContentTypeForFormData(config);

      // Check if token needs refresh before making request
      if (isUsingJwt() && needsRefresh() && !isRefreshing) {
        console.debug('[API] Token needs refresh, refreshing before request...');
        try {
          await refreshAccessToken();
        } catch (error) {
          console.error('[API] Token refresh failed in request interceptor:', error);
          // Don't block the request, let response interceptor handle it
        }
      }
      
      // Get auth header (supports both JWT Bearer and legacy Token)
      const authHeader = getAuthHeader();
      if (authHeader) {
        config.headers.Authorization = authHeader;
      }
      // Note: Missing auth header is expected during login/public endpoints
      
      // Add tenant ID header if available
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }
      
      return config;
    } catch (error) {
      console.error('[API] Request interceptor error:', error);
      return config;
    }
  },
  (error) => {
    console.error('[API] Request interceptor rejected:', error);
    return Promise.reject(error);
  }
);

// Request interceptor for authentication and tenant context (adminClient)
adminClient.interceptors.request.use(
  async (config) => {
    try {
      // IMPORTANT: When uploading files, ensure we do NOT force application/json.
      // Axios will set the correct multipart boundary automatically.
      stripJsonContentTypeForFormData(config);

      // Check if token needs refresh before making request
      if (isUsingJwt() && needsRefresh() && !isRefreshing) {
        console.debug('[Admin API] Token needs refresh, refreshing before request...');
        try {
          await refreshAccessToken();
        } catch (error) {
          console.error('[Admin API] Token refresh failed in request interceptor:', error);
        }
      }
      
      const authHeader = getAuthHeader();
      if (authHeader) {
        config.headers.Authorization = authHeader;
      } else {
        console.warn('[Admin API] No auth header available for request to:', config.url);
      }
      
      // Add tenant ID header if available
      const tenantId = localStorage.getItem('tenantId');
      if (tenantId) {
        config.headers['X-Tenant-ID'] = tenantId;
      }
      
      return config;
    } catch (error) {
      console.error('[Admin API] Request interceptor error:', error);
      return config;
    }
  },
  (error) => {
    console.error('[Admin API] Request interceptor rejected:', error);
    return Promise.reject(error);
  }
);

// Response interceptor with JWT refresh logic (apiClient)
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosErrorType) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    const status = error.response?.status;

    // Circuit breaker: do NOT trigger auth refresh flows for transient upstream/server errors.
    if (status && [500, 502, 503, 504].includes(status)) {
      const friendlyMessage =
        status === 502
          ? 'Server temporarily unreachable. Please try again shortly.'
          : 'Server error. Please try again shortly.';

      logger.error('[API] Server error (circuit breaker)', {
        status,
        url: originalRequest?.url,
        method: originalRequest?.method,
      });

      // Sentry hardening: capture the original axios error with context before we
      // replace it with a friendly message.
      try {
        Sentry.withScope((scope) => {
          scope.setTag('http.status_code', status);
          scope.setTag('http.method', originalRequest?.method || 'unknown');
          scope.setTag('http.url', originalRequest?.url || 'unknown');
          scope.setTag('tenant.id', localStorage.getItem('tenantId') || 'unknown');
          scope.setContext('http', {
            status,
            method: originalRequest?.method,
            url: originalRequest?.url,
            baseURL: (originalRequest as any)?.baseURL,
          });
          scope.setContext('auth', {
            isUsingJwt: isUsingJwt(),
            hasAuthHeader: Boolean(originalRequest?.headers?.Authorization),
          });

          const data = (error.response as any)?.data;
          if (data !== undefined) {
            scope.setExtra('response.data', typeof data === 'string' ? data.slice(0, 2000) : data);
          }

          Sentry.captureException(error);
        });
      } catch {
        // best-effort
      }

      return Promise.reject(
        createCircuitBreakerError({
          friendlyMessage,
          status,
          request: {
            method: originalRequest?.method,
            url: originalRequest?.url,
            baseURL: (originalRequest as any)?.baseURL,
          },
          responseData: (error.response as any)?.data,
          originalError: error,
        })
      );
    }
    
    // Log the error for debugging
    if (status === 401) {
      console.warn('[API] 401 Unauthorized:', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        hasAuth: !!originalRequest?.headers?.Authorization,
        isUsingJwt: isUsingJwt(),
        retry: originalRequest?._retry,
        retryCount: originalRequest?._retryCount || 0
      });
    }
    
    // Handle 401 Unauthorized
    if (status === 401 && originalRequest && !originalRequest._retry) {
      // Prevent infinite retry loops
      const retryCount = (originalRequest._retryCount || 0) + 1;
      if (retryCount > 2) {
        console.error('[API] Max retry attempts reached, showing session expired modal');
        clearTokens();
        localStorage.removeItem('user');
        // KEEP tenant context for re-login - user should see same tenant after re-auth
        // This prevents unexpected tenant switching mid-session
        // localStorage.removeItem('tenantId');
        // localStorage.removeItem('tenantName');
        // localStorage.removeItem('tenantSlug');
        
        // Show session expired modal instead of hard redirect
        triggerGlobalSessionExpired('Your session has expired after multiple authentication attempts.');
        return Promise.reject(error);
      }
      
      // If using JWT and we have a refresh token, try to refresh
      if (isUsingJwt()) {
        if (isRefreshing) {
          // Queue this request while refresh is in progress
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject, config: originalRequest });
          }).then((config) => apiClient(config as InternalAxiosRequestConfig));
        }
        
        originalRequest._retry = true;
        originalRequest._retryCount = retryCount;
        isRefreshing = true;
        
        try {
          const newToken = await refreshAccessToken();
          
          if (newToken) {
            // Retry original request with new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            processQueue(null);
            console.debug('[API] Retrying request with refreshed token');
            return apiClient(originalRequest);
          } else {
            // Refresh returned null - tokens are invalid
            throw new Error('Token refresh returned null');
          }
        } catch (refreshError) {
          console.error('[API] Token refresh failed:', refreshError);
          processQueue(refreshError);
          // Refresh failed, show session expired modal
          clearTokens();
          localStorage.removeItem('user');
          // KEEP tenant context for re-login - user should see same tenant after re-auth
          // This prevents unexpected tenant switching mid-session
          // localStorage.removeItem('tenantId');
          // localStorage.removeItem('tenantName');
          // localStorage.removeItem('tenantSlug');
          
          triggerGlobalSessionExpired('Your session could not be refreshed. Please log in again.');
          return Promise.reject(refreshError);
        } finally {
          // CRITICAL: Always reset isRefreshing flag
          isRefreshing = false;
        }
      }
      
      // No JWT or refresh failed, clear auth and show modal
      console.warn('[API] No JWT auth available, showing session expired modal');
      clearTokens();
      localStorage.removeItem('user');
      triggerGlobalSessionExpired('Your session has expired. Please log in to continue.');
    }
    
    return Promise.reject(error);
  }
);

// Response interceptor for error handling (adminClient)
adminClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosErrorType) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean; _retryCount?: number };

    const status = error.response?.status;

    // Circuit breaker: do NOT trigger auth refresh flows for transient upstream/server errors.
    if (status && [500, 502, 503, 504].includes(status)) {
      const friendlyMessage =
        status === 502
          ? 'Server temporarily unreachable. Please try again shortly.'
          : 'Server error. Please try again shortly.';

      logger.error('[Admin API] Server error (circuit breaker)', {
        status,
        url: originalRequest?.url,
        method: originalRequest?.method,
      });

      return Promise.reject(
        createCircuitBreakerError({
          friendlyMessage,
          status,
          request: {
            method: originalRequest?.method,
            url: originalRequest?.url,
            baseURL: (originalRequest as any)?.baseURL,
          },
          responseData: (error.response as any)?.data,
          originalError: error,
        })
      );
    }
    
    // Log the error for debugging
    if (status === 401) {
      console.warn('[Admin API] 401 Unauthorized:', {
        url: originalRequest?.url,
        method: originalRequest?.method,
        hasAuth: !!originalRequest?.headers?.Authorization,
        isUsingJwt: isUsingJwt(),
        retry: originalRequest?._retry,
        retryCount: originalRequest?._retryCount || 0
      });
    }
    
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      // Prevent infinite retry loops
      const retryCount = (originalRequest._retryCount || 0) + 1;
      if (retryCount > 2) {
        console.error('[Admin API] Max retry attempts reached, showing session expired modal');
        clearTokens();
        localStorage.removeItem('user');
        triggerGlobalSessionExpired('Your session has expired.');
        return Promise.reject(error);
      }
      
      if (isUsingJwt()) {
        originalRequest._retry = true;
        originalRequest._retryCount = retryCount;
        const newToken = await refreshAccessToken();
        
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          console.debug('[Admin API] Retrying request with refreshed token');
          return adminClient(originalRequest);
        }
      }
      
      console.warn('[Admin API] No JWT auth available, showing session expired modal');
      clearTokens();
      localStorage.removeItem('user');
      triggerGlobalSessionExpired('Your session has expired. Please log in to continue.');
    }
    
    return Promise.reject(error);
  }
);

// Helper function for enhanced error handling with Axios error details
interface AxiosError {
  response?: {
    data?: {
      message?: string;
      error?: string;
      detail?: string;
      details?: string;
      [key: string]: unknown;
    };
    status?: number;
    statusText?: string;
  };
  request?: unknown;
  message?: string;
  code?: string;
  config?: {
    url?: string;
    method?: string;
    baseURL?: string;
  };
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error;

  if (error instanceof ApiServiceError) {
    const data = error.responseData;
    if (data && typeof data === 'object') {
      const anyData = data as any;
      const msg = anyData.message || anyData.error || anyData.detail || anyData.details;
      if (msg && typeof msg === 'string') return msg;
    }
    return error.message;
  }
  
  if (error && typeof error === 'object') {
    const axiosError = error as AxiosError;
    
    // If we have a response from the server, extract the error message
    if (axiosError.response?.data) {
      const data = axiosError.response.data;
      const errorMsg = data.message || data.error || data.detail || data.details;
      if (errorMsg && typeof errorMsg === 'string') {
        return errorMsg;
      }
      // If data is an object with multiple errors, stringify it
      if (typeof data === 'object' && Object.keys(data).length > 0) {
        return JSON.stringify(data);
      }
    }
    
    // Network errors (no response from server)
    if (axiosError.request && !axiosError.response) {
      const url = axiosError.config?.url || 'unknown endpoint';
      const baseURL = axiosError.config?.baseURL || '';
      
      // Properly construct full URL
      let fullURL = url;
      if (baseURL) {
        try {
          // Use URL constructor for proper URL joining
          fullURL = new URL(url, baseURL).href;
        } catch {
          // Fallback to simple concatenation if URL constructor fails
          fullURL = baseURL.replace(/\/$/, '') + '/' + url.replace(/^\//, '');
        }
      }
      
      // Provide more specific error messages based on error code
      if (axiosError.code === 'ERR_NETWORK') {
        return `Unable to connect to the server at ${fullURL}. Please check your internet connection or contact support.`;
      }
      if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
        return `Request to ${fullURL} timed out. The server may be experiencing high load. Please try again.`;
      }
      if (axiosError.code === 'ERR_BAD_REQUEST') {
        return `Invalid request to ${fullURL}. Please contact support.`;
      }
      
      // Generic network error with URL
      return `Network error while connecting to ${fullURL}. ${axiosError.message || 'Please check your connection and try again.'}`;
    }
    
    // HTTP error responses with status codes
    if (axiosError.response?.status) {
      const status = axiosError.response.status;
      const statusText = axiosError.response.statusText || '';
      
      if (status === 401) return 'Authentication required. Please log in again.';
      if (status === 403) return 'You do not have permission to perform this action.';
      if (status === 404) return 'The requested resource was not found.';
      if (status === 500) return 'Server error. Please try again later or contact support.';
      if (status >= 400 && status < 500) return `Request error: ${statusText}`;
      if (status >= 500) return `Server error: ${statusText}`;
    }
    
    // Fallback to error message if available
    if (axiosError.message) return axiosError.message;
  }
  
  if (error instanceof Error) return error.message;
  
  return 'An unknown error occurred. Please try again.';
}

// Types
export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;

  // New explicit phone slots
  phone_mobile?: string;
  phone_office?: string;
  phone_office_extension?: string;

  // Legacy primary phone (kept for backward compatibility)
  phone?: string;
  phone_type?: 'mobile' | 'office';
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  departments_array?: string[]; // Phase 4: ArrayField
  preferred_protein_types?: string[]; // NEW: Protein filtering
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;

  // New explicit phone slots
  phone_mobile?: string;
  phone_office?: string;
  phone_office_extension?: string;

  // Legacy primary phone (kept for backward compatibility)
  phone?: string;
  phone_type?: 'mobile' | 'office';

  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  industry_array?: string[]; // Phase 4: ArrayField
  preferred_protein_types?: string[]; // Phase 4: ArrayField
  products?: string[]; // system.Product UUIDs
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrder {
  id: number;
  order_number: string;
  supplier: number;

  product?: string | null; // system.Product UUID
  item_description?: string;
  fresh_or_frozen?: string;
  package_type?: string;
  quantity?: number | null;
  total_weight?: number | null;
  weight_unit?: string;
  price_per_unit?: number | null; // cost per lb

  total_amount: number;
  status: string;
  order_date: string;
  delivery_date?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  logistics_scenario?: string;
  pick_up_location?: string | null; // Phase 4: Location UUID
  delivery_location?: string | null; // Phase 4: Location UUID
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  phone_type?: 'mobile' | 'office';
  company?: string;
  position?: string;
  department?: string;
  created_at: string;
  updated_at: string;
}

export interface Plant {
  id: number;
  name: string;
  plant_est_num?: string;
  plant_type?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  booking_contact_email?: string;
  booking_contact_phone?: string;
  booking_contact_phone_type?: 'mobile' | 'office';
  capacity?: number;
  is_active?: boolean;
  fcfs?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Carrier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  phone_type?: 'mobile' | 'office';
  address?: string;
  service_areas?: string;
  created_at: string;
  updated_at: string;
}

export interface AccountsReceivable {
  id: number;
  customer: number;
  invoice_number: string;
  amount: number;
  due_date: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Invoice {
  id: number;
  tenant: number;
  invoice_number: string;
  date_time_stamp: string;
  customer: number;
  customer_name?: string;
  sales_order?: number;
  product?: number;
  pick_up_date?: string;
  delivery_date?: string;
  due_date?: string;
  our_sales_order_num?: string;
  delivery_po_num?: string;
  payment_terms?: string;
  subtotal?: number;
  tax?: number;
  total?: number;
  status: string;
  payment_status?: string;
  created_at: string;
  updated_at: string;
}

// API Service Class
export class ApiService {
  // Suppliers
  async getSuppliers(): Promise<Supplier[]> {
    const response = await apiClient.get('/suppliers/');
    return response.data.results || response.data;
  }

  async getSupplier(id: number): Promise<Supplier> {
    const response = await apiClient.get(`/suppliers/${id}/`);
    return response.data;
  }

  async createSupplier(supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      logger.debug('[API] Creating supplier', {
        component: 'ApiService',
        metadata: {
          endpoint: '/suppliers/',
          hasAuth: !!localStorage.getItem('authToken'),
          hasTenant: !!localStorage.getItem('tenantId'),
          baseURL: API_BASE_URL,
        },
      });
      
      const response = await apiClient.post('/suppliers/', supplier);
      logger.debug('[API] Supplier created successfully', {
        component: 'ApiService',
        metadata: { endpoint: '/suppliers/' },
      }, response.data);
      return response.data;
    } catch (error: unknown) {
      // Log detailed error information for debugging
      const axiosError = error as AxiosError;
      logger.error('[API] Failed to create supplier', {
        component: 'ApiService',
        metadata: {
          message: getErrorMessage(error),
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          errorCode: axiosError.code,
          url: axiosError.config?.url,
          baseURL: axiosError.config?.baseURL,
          hasResponse: !!axiosError.response,
          hasRequest: !!axiosError.request,
        },
      });
      
      // Re-throw with enhanced error message
      throw new Error(getErrorMessage(error));
    }
  }

  async updateSupplier(id: number, supplier: Partial<Supplier>): Promise<Supplier> {
    try {
      logger.debug('[API] Updating supplier', {
        component: 'ApiService',
        metadata: {
          id,
          endpoint: `/suppliers/${id}/`,
          baseURL: API_BASE_URL,
        },
      });
      
      const response = await apiClient.patch(`/suppliers/${id}/`, supplier);
      logger.debug('[API] Supplier updated successfully', {
        component: 'ApiService',
        metadata: { id, endpoint: `/suppliers/${id}/` },
      }, response.data);
      return response.data;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      logger.error('[API] Failed to update supplier', {
        component: 'ApiService',
        metadata: {
          message: getErrorMessage(error),
          status: axiosError.response?.status,
          errorCode: axiosError.code,
        },
      });
      
      throw new Error(getErrorMessage(error));
    }
  }

  async deleteSupplier(id: number): Promise<void> {
    await apiClient.delete(`/suppliers/${id}/`);
  }

  // Customers
  async getCustomers(): Promise<Customer[]> {
    const response = await apiClient.get('/customers/');
    return response.data.results || response.data;
  }

  async getCustomer(id: number): Promise<Customer> {
    const response = await apiClient.get(`/customers/${id}/`);
    return response.data;
  }

  async createCustomer(customer: Partial<Customer>): Promise<Customer> {
    try {
      const response = await apiClient.post('/customers/', customer);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create customer: ${getErrorMessage(error)}`);
    }
  }

  async updateCustomer(id: number, customer: Partial<Customer>): Promise<Customer> {
    try {
      const response = await apiClient.patch(`/customers/${id}/`, customer);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update customer: ${getErrorMessage(error)}`);
    }
  }

  async deleteCustomer(id: number): Promise<void> {
    await apiClient.delete(`/customers/${id}/`);
  }

  // Purchase Orders
  async getPurchaseOrders(): Promise<PurchaseOrder[]> {
    try {
      const response = await apiClient.get('/purchase-orders/');
      return response.data.results || response.data;
    } catch (error) {
      console.error('Error fetching purchase orders:', error);
      throw new Error(
        'Purchase orders data unavailable. Please check your connection and try again.'
      );
    }
  }

  async getPurchaseOrder(id: number): Promise<PurchaseOrder> {
    const response = await apiClient.get(`/purchase-orders/${id}/`);
    return response.data;
  }

  async createPurchaseOrder(order: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    try {
      const response = await apiClient.post('/purchase-orders/', order);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create purchase order: ${getErrorMessage(error)}`);
    }
  }

  async updatePurchaseOrder(id: number, order: Partial<PurchaseOrder>): Promise<PurchaseOrder> {
    try {
      const response = await apiClient.patch(`/purchase-orders/${id}/`, order);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update purchase order: ${getErrorMessage(error)}`);
    }
  }

  async deletePurchaseOrder(id: number): Promise<void> {
    await apiClient.delete(`/purchase-orders/${id}/`);
  }

  // Contacts
  async getContacts(params?: { supplier?: number | string; customer?: number | string; plant?: number | string; location?: number | string }): Promise<Contact[]> {
    const filteredParams = params
      ? Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''))
      : undefined;
    const response = await apiClient.get('/contacts/', { params: filteredParams });
    return response.data.results || response.data;
  }

  async getContact(id: number): Promise<Contact> {
    const response = await apiClient.get(`/contacts/${id}/`);
    return response.data;
  }

  async createContact(contact: Partial<Contact>): Promise<Contact> {
    try {
      const response = await apiClient.post('/contacts/', contact);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create contact: ${getErrorMessage(error)}`);
    }
  }

  async updateContact(id: number, contact: Partial<Contact>): Promise<Contact> {
    try {
      const response = await apiClient.patch(`/contacts/${id}/`, contact);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update contact: ${getErrorMessage(error)}`);
    }
  }

  async deleteContact(id: number): Promise<void> {
    await apiClient.delete(`/contacts/${id}/`);
  }

  // Plants
  async getPlants(): Promise<Plant[]> {
    const response = await apiClient.get('/plants/');
    return response.data.results || response.data;
  }

  async getPlant(id: number): Promise<Plant> {
    const response = await apiClient.get(`/plants/${id}/`);
    return response.data;
  }

  async createPlant(plant: Partial<Plant>): Promise<Plant> {
    try {
      const response = await apiClient.post('/plants/', plant);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create plant: ${getErrorMessage(error)}`);
    }
  }

  async updatePlant(id: number, plant: Partial<Plant>): Promise<Plant> {
    try {
      const response = await apiClient.patch(`/plants/${id}/`, plant);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update plant: ${getErrorMessage(error)}`);
    }
  }

  async deletePlant(id: number): Promise<void> {
    await apiClient.delete(`/plants/${id}/`);
  }

  // Carriers
  async getCarriers(): Promise<Carrier[]> {
    const response = await apiClient.get('/carriers/');
    return response.data.results || response.data;
  }

  async getCarrier(id: number): Promise<Carrier> {
    const response = await apiClient.get(`/carriers/${id}/`);
    return response.data;
  }

  async createCarrier(carrier: Partial<Carrier>): Promise<Carrier> {
    try {
      const response = await apiClient.post('/carriers/', carrier);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create carrier: ${getErrorMessage(error)}`);
    }
  }

  async updateCarrier(id: number, carrier: Partial<Carrier>): Promise<Carrier> {
    try {
      const response = await apiClient.patch(`/carriers/${id}/`, carrier);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update carrier: ${getErrorMessage(error)}`);
    }
  }

  async deleteCarrier(id: number): Promise<void> {
    await apiClient.delete(`/carriers/${id}/`);
  }

  // Accounts Receivables
  async getAccountsReceivables(): Promise<AccountsReceivable[]> {
    const response = await apiClient.get('/accounts-receivables/');
    return response.data.results || response.data;
  }

  async getAccountsReceivable(id: number): Promise<AccountsReceivable> {
    const response = await apiClient.get(`/accounts-receivables/${id}/`);
    return response.data;
  }

  async createAccountsReceivable(ar: Partial<AccountsReceivable>): Promise<AccountsReceivable> {
    try {
      const response = await apiClient.post('/accounts-receivables/', ar);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create accounts receivable: ${getErrorMessage(error)}`);
    }
  }

  async updateAccountsReceivable(
    id: number,
    ar: Partial<AccountsReceivable>
  ): Promise<AccountsReceivable> {
    try {
      const response = await apiClient.patch(`/accounts-receivables/${id}/`, ar);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update accounts receivable: ${getErrorMessage(error)}`);
    }
  }

  async deleteAccountsReceivable(id: number): Promise<void> {
    await apiClient.delete(`/accounts-receivables/${id}/`);
  }

  // Invoices
  async getInvoices(): Promise<Invoice[]> {
    const response = await apiClient.get('/invoices/');
    return response.data.results || response.data;
  }

  async getInvoice(id: number): Promise<Invoice> {
    const response = await apiClient.get(`/invoices/${id}/`);
    return response.data;
  }

  async createInvoice(invoice: Partial<Invoice>): Promise<Invoice> {
    try {
      const response = await apiClient.post('/invoices/', invoice);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to create invoice: ${getErrorMessage(error)}`);
    }
  }

  async updateInvoice(id: number, invoice: Partial<Invoice>): Promise<Invoice> {
    try {
      const response = await apiClient.patch(`/invoices/${id}/`, invoice);
      return response.data;
    } catch (error: unknown) {
      throw new Error(`Failed to update invoice: ${getErrorMessage(error)}`);
    }
  }

  async deleteInvoice(id: number): Promise<void> {
    await apiClient.delete(`/invoices/${id}/`);
  }
}

// Export singleton instance
export const apiService = new ApiService();

// Export apiClient for direct axios usage in components
export { apiClient, adminClient };

// Test-only helper to reset module-scoped auth refresh state.
export const __resetAuthRefreshStateForTests = () => {
  isRefreshing = false;
  failedQueue = [];
};
