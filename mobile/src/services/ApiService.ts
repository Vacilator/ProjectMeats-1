import axios, { AxiosInstance } from 'axios';
import Constants from 'expo-constants';
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
} from '../types';

class ApiServiceClass {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    const extraBaseUrl = (Constants.expoConfig?.extra as any)?.apiBaseUrl as string | undefined;

    // Prefer environment-configured URL (build-time), then app.json extra, then sensible defaults.
    const configured = (envBaseUrl || extraBaseUrl || '').trim();
    this.baseURL = (
      configured || (__DEV__ ? 'http://localhost:8000/api/v1' : 'https://dev.meatscentral.com/api/v1')
    ).replace(/\/+$/, '');

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
  async loginAsGuest(tenantSlug: string, accessCode?: string): Promise<GuestSession> {
    const payload: Record<string, string> = { tenant_slug: tenantSlug };
    if (accessCode) {
      payload.access_code = accessCode;
    }
    const response = await this.api.post('/auth/guest-session/', payload);
    return response.data;
  }

  setGuestToken(guestToken: string) {
    this.api.defaults.headers.common['Authorization'] = `GuestToken ${guestToken}`;
  }

  // Invite-only endpoints
  async validateInvite(token: string): Promise<TenantInvite> {
    const response = await this.api.get(`/auth/invites/${token}/`);
    return response.data;
  }

  async acceptInvite(inviteData: InviteAcceptRequest): Promise<LoginResponse> {
    const response = await this.api.post('/auth/invites/accept/', inviteData);
    return response.data;
  }

  // WorkForms endpoints
  async getWorkForms(): Promise<ApiResponse<WorkForm>> {
    const response = await this.api.get('/tenant-workforms/');
    const data = response.data;

    const results = Array.isArray(data?.results) ? data.results : [];
    return {
      count: data?.count ?? results.length,
      next: data?.next,
      previous: data?.previous,
      results: results.map((row: any) => ({
        id: String(row.id),
        name: String(row.name ?? ''),
        description: row.description ?? undefined,
        tenant: String(row.tenant ?? ''),
        is_active: String(row.status ?? '').toLowerCase() === 'active',
        node_count: Number(row.node_count ?? 0),
        created_at: String(row.created_at ?? ''),
        updated_at: String(row.updated_at ?? ''),
      })),
    };
  }

  async getWorkForm(id: string): Promise<WorkForm> {
    const response = await this.api.get(`/tenant-workforms/${id}/`);
    const row = response.data;

    return {
      id: String(row.id),
      name: String(row.name ?? ''),
      description: row.description ?? undefined,
      tenant: String(row.tenant ?? ''),
      is_active: String(row.status ?? '').toLowerCase() === 'active',
      node_count: Number(row.node_count ?? 0),
      nodes: Array.isArray(row.nodes) ? row.nodes : undefined,
      created_at: String(row.created_at ?? ''),
      updated_at: String(row.updated_at ?? ''),
    };
  }
}

export const ApiService = new ApiServiceClass();