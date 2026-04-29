import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  LoginRequest,
  LoginResponse,
  Tenant,
  UserTenant,
  ApiResponse,
  Customer,
  Supplier,
  Contact,
  Plant,
  Carrier,
  GuestSession,
  TenantInvite,
  InviteAcceptRequest,
  WorkForm,
  WorkFormExecution,
  WorkflowDefinition,
} from '../types';
import type {
  ContractTenantWorkFormDetailResponse,
  ContractTenantWorkFormListItem,
  ContractTenantWorkFormsListResponse,
} from '../../../shared/types/openapi';

const PROD_DEFAULT_API_BASE_URL = 'https://dev.meatscentral.com/api/v1';

function getExpoDevHost(): string | null {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    (Constants as any).manifest?.debuggerHost ||
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (!hostUri || typeof hostUri !== 'string') return null;
  return hostUri.split(':')[0] || null;
}

function getDeviceSafeDevApiBaseUrl(): string {
  const host = getExpoDevHost();
  if (host) return `http://${host}:8000/api/v1`;

  if (Platform.OS === 'android') return 'http://10.0.2.2:8000/api/v1';
  return 'http://localhost:8000/api/v1';
}

function resolveApiBaseUrl(envBaseUrl?: string, extraBaseUrl?: string): string {
  const env = (envBaseUrl || '').trim();
  if (env) return env;

  const extra = (extraBaseUrl || '').trim();

  if (extra && /(localhost|127\.0\.0\.1)/.test(extra)) {
    return getDeviceSafeDevApiBaseUrl();
  }

  if (__DEV__) {
    return extra || getDeviceSafeDevApiBaseUrl();
  }

  return extra || PROD_DEFAULT_API_BASE_URL;
}

function isWorkflowDefinition(value: unknown): value is WorkflowDefinition {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<WorkflowDefinition>;
  return Array.isArray(candidate.nodes) && Array.isArray(candidate.edges);
}

class ApiServiceClass {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    const extraBaseUrl = (Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined;

    this.baseURL = resolveApiBaseUrl(envBaseUrl, extraBaseUrl).replace(/\/+$/, '');

    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('API Error:', error.response?.data || error.message);
        return Promise.reject(error);
      }
    );
  }

  setAuthToken(token: string) {
    // Legacy token auth (matches /api/v1/auth/login/ response)
    this.api.defaults.headers.common['Authorization'] = `Token ${token}`;
  }

  removeAuthToken() {
    delete this.api.defaults.headers.common['Authorization'];
  }

  setTenantId(tenantId: string) {
    this.api.defaults.headers.common['X-Tenant-ID'] = tenantId;
  }

  clearTenantId() {
    delete this.api.defaults.headers.common['X-Tenant-ID'];
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.api.post('/auth/login/', credentials);
    return response.data;
  }

  async logout(): Promise<void> {
    await this.api.post('/auth/logout/');
  }

  // Tenant endpoints
  async getTenants(): Promise<ApiResponse<Tenant>> {
    const response = await this.api.get('/tenants/');
    return response.data;
  }

  async getMyTenants(): Promise<UserTenant[]> {
    const response = await this.api.get('/tenants/my_tenants/');
    return response.data;
  }

  async createTenant(tenantData: Partial<Tenant>): Promise<Tenant> {
    const response = await this.api.post('/tenants/', tenantData);
    return response.data;
  }

  async getTenant(id: string): Promise<Tenant> {
    const response = await this.api.get(`/tenants/${id}/`);
    return response.data;
  }

  async updateTenant(id: string, tenantData: Partial<Tenant>): Promise<Tenant> {
    const response = await this.api.patch(`/tenants/${id}/`, tenantData);
    return response.data;
  }

  // Customer endpoints
  async getCustomers(): Promise<ApiResponse<Customer>> {
    const response = await this.api.get('/customers/');
    return response.data;
  }

  async getCustomer(id: number): Promise<Customer> {
    const response = await this.api.get(`/customers/${id}/`);
    return response.data;
  }

  async createCustomer(customerData: Partial<Customer>): Promise<Customer> {
    const response = await this.api.post('/customers/', customerData);
    return response.data;
  }

  async updateCustomer(id: number, customerData: Partial<Customer>): Promise<Customer> {
    const response = await this.api.patch(`/customers/${id}/`, customerData);
    return response.data;
  }

  async deleteCustomer(id: number): Promise<void> {
    await this.api.delete(`/customers/${id}/`);
  }

  // Supplier endpoints
  async getSuppliers(): Promise<ApiResponse<Supplier>> {
    const response = await this.api.get('/suppliers/');
    return response.data;
  }

  async getSupplier(id: number): Promise<Supplier> {
    const response = await this.api.get(`/suppliers/${id}/`);
    return response.data;
  }

  async createSupplier(supplierData: Partial<Supplier>): Promise<Supplier> {
    const response = await this.api.post('/suppliers/', supplierData);
    return response.data;
  }

  async updateSupplier(id: number, supplierData: Partial<Supplier>): Promise<Supplier> {
    const response = await this.api.patch(`/suppliers/${id}/`, supplierData);
    return response.data;
  }

  async deleteSupplier(id: number): Promise<void> {
    await this.api.delete(`/suppliers/${id}/`);
  }

  // Contact endpoints
  async getContacts(): Promise<ApiResponse<Contact>> {
    const response = await this.api.get('/contacts/');
    return response.data;
  }

  async getContact(id: number): Promise<Contact> {
    const response = await this.api.get(`/contacts/${id}/`);
    return response.data;
  }

  async createContact(contactData: Partial<Contact>): Promise<Contact> {
    const response = await this.api.post('/contacts/', contactData);
    return response.data;
  }

  async updateContact(id: number, contactData: Partial<Contact>): Promise<Contact> {
    const response = await this.api.patch(`/contacts/${id}/`, contactData);
    return response.data;
  }

  async deleteContact(id: number): Promise<void> {
    await this.api.delete(`/contacts/${id}/`);
  }

  // Plant endpoints
  async getPlants(): Promise<ApiResponse<Plant>> {
    const response = await this.api.get('/plants/');
    return response.data;
  }

  async getPlant(id: number): Promise<Plant> {
    const response = await this.api.get(`/plants/${id}/`);
    return response.data;
  }

  async createPlant(plantData: Partial<Plant>): Promise<Plant> {
    const response = await this.api.post('/plants/', plantData);
    return response.data;
  }

  async updatePlant(id: number, plantData: Partial<Plant>): Promise<Plant> {
    const response = await this.api.patch(`/plants/${id}/`, plantData);
    return response.data;
  }

  async deletePlant(id: number): Promise<void> {
    await this.api.delete(`/plants/${id}/`);
  }

  // Carrier endpoints
  async getCarriers(): Promise<ApiResponse<Carrier>> {
    const response = await this.api.get('/carriers/');
    return response.data;
  }

  async getCarrier(id: number): Promise<Carrier> {
    const response = await this.api.get(`/carriers/${id}/`);
    return response.data;
  }

  async createCarrier(carrierData: Partial<Carrier>): Promise<Carrier> {
    const response = await this.api.post('/carriers/', carrierData);
    return response.data;
  }

  async updateCarrier(id: number, carrierData: Partial<Carrier>): Promise<Carrier> {
    const response = await this.api.patch(`/carriers/${id}/`, carrierData);
    return response.data;
  }

  async deleteCarrier(id: number): Promise<void> {
    await this.api.delete(`/carriers/${id}/`);
  }

  // Health check
  async healthCheck(): Promise<unknown> {
    const response = await this.api.get('/health/');
    return response.data;
  }

  // Guest mode endpoints
  // Backend implementation is a legacy guest user login (Token auth), not a per-tenant guest session.
  async guestLogin(): Promise<GuestSession> {
    const response = await this.api.post('/auth/guest-login/');
    return response.data;
  }

  /**
   * @deprecated Backend does not currently support the GuestToken auth scheme.
   * Prefer `setAuthToken()` with the token returned from `guestLogin()`.
   */
  setGuestToken(_guestToken: string) {
    // Intentionally no-op to avoid setting an unsupported Authorization scheme.
  }

  // Invite-only endpoints
  async validateInvite(token: string): Promise<TenantInvite> {
    // Backend route: GET /api/v1/invitations/validate/?token=...
    const response = await this.api.get('/invitations/validate/', {
      params: { token },
    });

    // Include the token in the returned object for UI convenience.
    return { token, ...response.data };
  }

  async acceptInvite(inviteData: InviteAcceptRequest): Promise<LoginResponse> {
    // Backend route: POST /api/v1/auth/signup-with-invitation/
    const payload = {
      invitation_token: inviteData.token,
      username: inviteData.username,
      email: inviteData.email,
      password: inviteData.password,
      first_name: inviteData.first_name,
      last_name: inviteData.last_name,
    };
    const response = await this.api.post('/auth/signup-with-invitation/', payload);
    return response.data;
  }

  // WorkForms endpoints
  async getWorkForms(): Promise<ApiResponse<WorkForm>> {
    const response = await this.api.get<ContractTenantWorkFormsListResponse>('/tenant-workforms/');
    const data = response.data;

    const results: ContractTenantWorkFormListItem[] = Array.isArray(data?.results) ? data.results : [];
    return {
      count: data?.count ?? results.length,
      next: data?.next ?? undefined,
      previous: data?.previous ?? undefined,
      results: results.map((row) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        description: row.description ?? undefined,
        status: String(row.status ?? 'draft'),
        is_active: String(row.status ?? '').toLowerCase() === 'active',
        node_count: Number(row.node_count),
        edge_count: row.edge_count !== undefined ? Number(row.edge_count) : undefined,
        version: row.version !== undefined ? Number(row.version) : undefined,
        execution_count: row.execution_count !== undefined ? Number(row.execution_count) : undefined,
        last_executed_at: row.last_executed_at ?? null,
        created_at: row.created_at ?? undefined,
        updated_at: String(row.updated_at ?? ''),
      })),
    };
  }

  async getWorkForm(id: string): Promise<WorkForm> {
    const response = await this.api.get<ContractTenantWorkFormDetailResponse>(`/tenant-workforms/${id}/`);
    const row = response.data;

    const definition = isWorkflowDefinition(row.workflow_definition) ? row.workflow_definition : undefined;

    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      description: row.description ?? undefined,
      status: String(row.status ?? 'draft'),
      is_active: String(row.status ?? '').toLowerCase() === 'active',
      node_count: Number(row.node_count),
      edge_count: row.edge_count !== undefined ? Number(row.edge_count) : undefined,
      version: row.version !== undefined ? Number(row.version) : undefined,
      execution_count: row.execution_count !== undefined ? Number(row.execution_count) : undefined,
      last_executed_at: row.last_executed_at ?? null,
      created_at: row.created_at ?? undefined,
      updated_at: String(row.updated_at ?? ''),
      workflow_definition: definition as WorkForm['workflow_definition'],
      form_references: Array.isArray(row.form_references)
        ? row.form_references.map((item) => String(item))
        : undefined,
    };
  }

  async executeWorkForm(id: string, initialData: Record<string, unknown> = {}): Promise<WorkFormExecution> {
    const response = await this.api.post(`/tenant-workforms/${id}/execute/`, {
      initial_data: initialData,
    });
    return response.data;
  }
}

export const ApiService = new ApiServiceClass();
