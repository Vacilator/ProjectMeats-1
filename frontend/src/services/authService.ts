/**
 * Authentication service for managing user authentication state.
 *
 * Wave S1: Security Hardening - JWT Authentication
 * - Uses JWT tokens (access + refresh) for authentication
 * - Short-lived access tokens (15 min) with automatic refresh
 * - Falls back to legacy token auth for backward compatibility
 */
import { apiClient } from './apiService';
import { UserProfile } from '../types';
import { logger } from '../utils/logger';

const normalizeUserProfile = (raw: Record<string, unknown>): UserProfile => {
  const isActive =
    typeof raw?.is_active === 'boolean'
      ? raw.is_active
      : typeof raw?.isActive === 'boolean'
        ? raw.isActive
        : true;

  return {
    id: Number(raw?.id ?? 0),
    username: String(raw?.username ?? ''),
    email: String(raw?.email ?? ''),
    first_name: String(raw?.first_name ?? ''),
    last_name: String(raw?.last_name ?? ''),
    is_active: isActive,
    is_staff: typeof raw?.is_staff === 'boolean' ? raw.is_staff : undefined,
    is_superuser: typeof raw?.is_superuser === 'boolean' ? raw.is_superuser : undefined,
    role: raw?.role as string | undefined,
    tenants: raw?.tenants as UserProfile['tenants'],
  };
};
import {
  storeTokens,
  clearTokens,
  getAccessToken,
  isUsingJwt,
} from './jwtService';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface SignUpCredentials {
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  company?: string;
  token?: string;
}

export interface AuthResponse {
  // JWT response
  access?: string;
  refresh?: string;
  // Legacy response
  token?: string;
  // Common fields
  user: UserProfile;
  tenants?: Array<{
    tenant__id: string;
    tenant__name: string;
    tenant__slug: string;
    role: string;
  }>;
}

export class AuthService {
  private user: UserProfile | null = null;

  constructor() {
    // Initialize user from localStorage
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = normalizeUserProfile(JSON.parse(storedUser));
      } catch (error) {
        logger.error('Error parsing stored user data', { component: 'AuthService' }, error);
        localStorage.removeItem('user');
      }
    }
  }

  /**
   * Login with JWT authentication
   * Uses /api/v1/auth/token/ for JWT tokens
   */
  async login(credentials: LoginCredentials): Promise<UserProfile> {
    try {
      // Try JWT endpoint first
      const response = await apiClient.post('/auth/token/', credentials);
      const { access, refresh, user, tenants } = response.data;

      if (access && refresh) {
        // JWT login successful
        storeTokens(access, refresh);
        const normalizedUser = normalizeUserProfile(user);
        this.user = normalizedUser;
        localStorage.setItem('user', JSON.stringify(normalizedUser));

        // Store tenant information
        if (tenants && tenants.length > 0) {
          const primaryTenant = tenants[0];
          localStorage.setItem('tenantId', primaryTenant.tenant__id);
          localStorage.setItem('tenantName', primaryTenant.tenant__name);
          localStorage.setItem('tenantSlug', primaryTenant.tenant__slug);
        }

        logger.debug('JWT login successful', { component: 'AuthService' });
        return normalizedUser;
      }

      throw new Error('Invalid JWT response');
    } catch (jwtError: unknown) {
      // If JWT fails with 404 (endpoint not available), fall back to legacy
      const axiosErr = jwtError as { response?: { status?: number; data?: { detail?: string; error?: string } } };
      if (axiosErr.response?.status === 404) {
        logger.debug('JWT endpoint not available, using legacy login', { component: 'AuthService' });
        return this.legacyLogin(credentials);
      }

      throw new Error(axiosErr.response?.data?.detail || axiosErr.response?.data?.error || 'Login failed');
    }
  }

  /**
   * Legacy login for backward compatibility
   * Uses /api/v1/auth/login/ with Token authentication
   */
  private async legacyLogin(credentials: LoginCredentials): Promise<UserProfile> {
    const response = await apiClient.post('/auth/login/', credentials);
    const { token, user, tenants } = response.data;

    // Store legacy token
    localStorage.setItem('authToken', token);
    const normalizedUser = normalizeUserProfile(user);
    this.user = normalizedUser;
    localStorage.setItem('user', JSON.stringify(normalizedUser));

    // Store tenant information
    if (tenants && tenants.length > 0) {
      const primaryTenant = tenants[0];
      localStorage.setItem('tenantId', primaryTenant.tenant__id);
      localStorage.setItem('tenantName', primaryTenant.tenant__name);
      localStorage.setItem('tenantSlug', primaryTenant.tenant__slug);
    }

    return normalizedUser;
  }

  /**
   * Guest login (demo mode)
   * Uses /api/v1/auth/guest-login/ with legacy Token authentication.
   */
  async guestLogin(): Promise<UserProfile> {
    try {
      // Ensure we don't accidentally keep JWT tokens when switching into guest mode.
      clearTokens();

      const response = await apiClient.post('/auth/guest-login/', {});
      const { token, user, tenant, tenants } = response.data;

      if (!token) {
        throw new Error('Guest login failed: missing token');
      }

      localStorage.setItem('authToken', token);

      const normalizedUser = normalizeUserProfile(user);
      this.user = normalizedUser;
      localStorage.setItem('user', JSON.stringify(normalizedUser));

      // Guest endpoint returns a single tenant object; fallback to tenants[] if present.
      if (tenant?.id) {
        localStorage.setItem('tenantId', tenant.id);
        localStorage.setItem('tenantName', tenant.name);
        localStorage.setItem('tenantSlug', tenant.slug);
      } else if (tenants && tenants.length > 0) {
        const primaryTenant = tenants[0];
        localStorage.setItem('tenantId', primaryTenant.tenant__id);
        localStorage.setItem('tenantName', primaryTenant.tenant__name);
        localStorage.setItem('tenantSlug', primaryTenant.tenant__slug);
      }

      return normalizedUser;
    } catch (error: unknown) {
      const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      const serverMessage = (typeof data.error === 'string' ? data.error : '') || (typeof data.detail === 'string' ? data.detail : '');
      throw new Error(serverMessage || 'Guest login failed');
    }
  }

  async signUp(credentials: SignUpCredentials): Promise<UserProfile> {
    try {
      // Determine endpoint based on presence of token
      const endpoint = credentials.token
        ? '/auth/signup-with-invitation/'
        : '/auth/signup/';

      // Construct payload with correct field mapping
      // Backend expects snake_case and 'invitation_token'
      const payload = {
        username: credentials.username,
        email: credentials.email,
        password: credentials.password,
        first_name: credentials.firstName,      // Fix: Map to snake_case
        last_name: credentials.lastName,        // Fix: Map to snake_case
        ...(credentials.token ? { invitation_token: credentials.token } : {}), // Fix: Map 'token' to 'invitation_token'
      };

      const response = await apiClient.post(endpoint, payload);

      // EXTRACT TENANT INFO HERE
      const { token, access, refresh, user, tenant } = response.data;

      // Check if we got JWT tokens
      if (access && refresh) {
        storeTokens(access, refresh);
      } else if (token) {
        // Legacy token
        localStorage.setItem('authToken', token);
      }

      const normalizedUser = normalizeUserProfile(user);
      this.user = normalizedUser;
      localStorage.setItem('user', JSON.stringify(normalizedUser));

      // CRITICAL FIX: Store the new tenant context immediately
      if (tenant) {
        localStorage.setItem('tenantId', tenant.id);
        localStorage.setItem('tenantName', tenant.name);
        localStorage.setItem('tenantSlug', tenant.slug);
      }

      return normalizedUser;
    } catch (error: unknown) {
      const errObj = (error && typeof error === 'object' ? error : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const serverData = (resp.data && typeof resp.data === 'object' ? resp.data : null) as Record<string, unknown> | null;
      // Enhanced error handling to capture validation errors
      let errorMessage = 'Sign up failed';

      if (serverData) {
          if (typeof serverData.error === 'string') {
              errorMessage = serverData.error;
          } else if (typeof serverData === 'object') {
              // Combine validation errors into a string
              // e.g. {"invitation_token": ["This field is required."]}
              errorMessage = Object.entries(serverData)
                  .map(([key, msgs]) => `${key}: ${(Array.isArray(msgs) ? msgs : [msgs]).join(' ')}`)
                  .join(' | ');
          }
      }
      throw new Error(errorMessage);
    }
  }

  async logout(): Promise<void> {
    try {
      // Only call logout endpoint if using legacy tokens
      // JWT tokens don't need server-side invalidation (they expire)
      if (!isUsingJwt()) {
        await apiClient.post('/auth/logout/', {});
      }
    } catch (error) {
      logger.error('Logout request failed', { component: 'AuthService' }, error);
    } finally {
      // Clear all tokens and local state
      clearTokens();
      this.user = null;
      localStorage.removeItem('user');
      localStorage.removeItem('tenantId');
      localStorage.removeItem('tenantName');
      localStorage.removeItem('tenantSlug');
    }
  }

  async getCurrentUser(): Promise<UserProfile | null> {
    const token = getAccessToken();
    if (!token) {
      return null;
    }

    // If we have a stored user, return it
    if (this.user) {
      return this.user;
    }

    // Try to get user from localStorage if we have a token but no user in memory
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        this.user = normalizeUserProfile(JSON.parse(storedUser));
        return this.user;
      } catch (error) {
        logger.error('Error parsing stored user data', { component: 'AuthService' }, error);
        localStorage.removeItem('user');
      }
    }

    // If we have a token but no user data, something went wrong - clear auth state
    logger.warn('Token exists but no user data found - clearing auth state', {
      component: 'AuthService',
    });
    await this.logout();
    return null;
  }

  getToken(): string | null {
    return getAccessToken();
  }

  getUser(): UserProfile | null {
    return this.user;
  }

  isAuthenticated(): boolean {
    return !!getAccessToken() && !!this.user;
  }

  isAdmin(): boolean {
    return this.user?.is_staff || this.user?.is_superuser || false;
  }
}

// Export singleton instance
export const authService = new AuthService();
