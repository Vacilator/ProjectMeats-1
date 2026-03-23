// Base types shared between web and mobile apps

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at?: string;
  user_count: number;
  is_trial_expired: boolean;
  created_at: string;
  updated_at: string;
  settings: Record<string, any>;
}

export interface TenantUser {
  id: number;
  tenant: Tenant;
  user: User;
  role: 'owner' | 'admin' | 'manager' | 'user' | 'readonly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: 'owner' | 'admin' | 'manager' | 'user' | 'readonly';
  is_active: boolean;
  is_trial: boolean;
  created_at: string;
}

// API Response types
export interface ApiResponse<T> {
  count: number;
  next?: string;
  previous?: string;
  results: T[];
}

export interface ApiError {
  detail?: string;
  [key: string]: any;
}

// Navigation types
export type RootStackParamList = {
  Login: undefined;
  Guest: undefined;
  Invite: { token?: string };
  Tenants: undefined;
  Home: undefined;
  GuestHome: undefined;
  WorkForms: undefined;
};

// Authentication types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

// Guest mode types
export interface GuestSession {
  guest_token: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  expires_at: string;
  permissions: string[];
}

export interface GuestUser {
  id: null;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  date_joined: string;
  is_guest: true;
}

// Invite-only flow types
export interface TenantInvite {
  token: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  invited_by: string;
  invited_email: string;
  role: 'admin' | 'manager' | 'user' | 'readonly';
  expires_at: string;
  is_expired: boolean;
  is_accepted: boolean;
}

export interface InviteAcceptRequest {
  token: string;
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

// WorkForms types (mobile parity with web Workform Editor)
export interface WorkFormNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WorkForm {
  id: string;
  name: string;
  description?: string;
  tenant: string;
  is_active: boolean;
  node_count: number;
  nodes?: WorkFormNode[];
  created_at: string;
  updated_at: string;
}

// Common entity types (shared with backend)
export interface Customer {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  created_on: string;
  modified_on: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  created_on: string;
  modified_on: string;
}

export interface Contact {
  id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  position?: string;
  customer?: number;
  supplier?: number;
  created_on: string;
  modified_on: string;
}

export interface Plant {
  id: number;
  name: string;
  location: string;
  capacity?: number;
  description?: string;
  created_on: string;
  modified_on: string;
}

export interface Carrier {
  id: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  service_area?: string;
  created_on: string;
  modified_on: string;
}