// Base types shared between web and mobile apps

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  // Auth endpoints include these; other endpoints may omit them.
  is_active?: boolean;
  is_staff?: boolean;
  is_superuser?: boolean;
  date_joined?: string;
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
  role:
    | 'owner'
    | 'admin'
    | 'manager'
    | 'plant_manager'
    | 'sales_rep'
    | 'auditor'
    | 'user'
    | 'readonly';
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  role: TenantUser['role'];
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
  WorkFormDetail: { id: string; isGuest?: boolean };
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
// Backend: POST /api/v1/auth/guest-login/
export interface GuestSession {
  token: string;
  user: User;
  tenant: {
    id: string;
    name: string;
    slug: string;
    role: TenantUser['role'];
    is_guest: true;
  };
  message: string;
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
// Backend:
// - GET /api/v1/invitations/validate/?token=...
// - POST /api/v1/auth/signup-with-invitation/
export interface TenantInvite {
  /** The invite token that was validated (not returned by backend; we add it client-side). */
  token: string;
  valid: true;
  email: string;
  role: TenantUser['role'];
  is_reusable: boolean;
  uses_remaining: number;
  tenant: {
    name: string;
    slug: string;
  };
  message?: string | null;
  expires_at: string;
}

export interface InviteAcceptRequest {
  /** Invite token */
  token: string;
  /** Desired username */
  username: string;
  /** Account email (must match invite email for non-reusable invites) */
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

// WorkForms types (mobile contract aligned with backend serializers)
export type WorkFormStatus = 'draft' | 'active' | 'archived' | string;

export interface WorkflowDefinition {
  nodes: any[];
  edges: any[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
}

export interface WorkForm {
  id: string;
  name: string;
  description?: string;
  status: WorkFormStatus;
  // Convenience field computed client-side
  is_active: boolean;
  node_count: number;
  edge_count?: number;
  version?: number;
  execution_count?: number;
  last_executed_at?: string | null;
  created_at?: string;
  updated_at: string;
  // Detail-only fields
  workflow_definition?: WorkflowDefinition;
  form_references?: string[];
}

export type WorkFormExecutionStatus = 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface WorkFormExecution {
  id: string;
  workform_id: string;
  workform_name: string;
  status: WorkFormExecutionStatus | string;
  started_at: string;
  completed_at: string | null;
  error_message: string;
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
