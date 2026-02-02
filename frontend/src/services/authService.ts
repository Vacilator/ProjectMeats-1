/**
 * Authentication service for managing user authentication state.
 * 
 * Wave S1: Security Hardening - JWT Authentication
 * - Uses JWT tokens (access + refresh) for authentication
 * - Short-lived access tokens (15 min) with automatic refresh
 * - Falls back to legacy token auth for backward compatibility
 */
import { apiClient } from './apiService';
import { config } from '../config/runtime';
import { UserProfile } from '../types';
import {
  storeTokens,
  clearTokens,
  getAccessToken,
  migrateLegacyToken,
  isUsingJwt,
} from './jwtService';

const API_BASE_URL = config.API_BASE_URL;

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
        this.user = JSON.parse(storedUser);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
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
        this.user = user;
        localStorage.setItem('user', JSON.stringify(user));
        
        // Store tenant information
        if (tenants && tenants.length > 0) {
          const primaryTenant = tenants[0];
          localStorage.setItem('tenantId', primaryTenant.tenant__id);
          localStorage.setItem('tenantName', primaryTenant.tenant__name);
          localStorage.setItem('tenantSlug', primaryTenant.tenant__slug);
        }

        console.debug('[Auth] JWT login successful');
        return user;
      }
      
      throw new Error('Invalid JWT response');
    } catch (jwtError: any) {
      // If JWT fails with 404 (endpoint not available), fall back to legacy
      if (jwtError.response?.status === 404) {
        console.debug('[Auth] JWT endpoint not available, using legacy login');
        return this.legacyLogin(credentials);
      }
      
      throw new Error(jwtError.response?.data?.detail || jwtError.response?.data?.error || 'Login failed');
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
    this.user = user;
    localStorage.setItem('user', JSON.stringify(user));
    
    // Store tenant information
    if (tenants && tenants.length > 0) {
      const primaryTenant = tenants[0];
      localStorage.setItem('tenantId', primaryTenant.tenant__id);
      localStorage.setItem('tenantName', primaryTenant.tenant__name);
      localStorage.setItem('tenantSlug', primaryTenant.tenant__slug);
    }

    return user;
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
      
      this.user = user;
      localStorage.setItem('user', JSON.stringify(user));

      // CRITICAL FIX: Store the new tenant context immediately
      if (tenant) {
        localStorage.setItem('tenantId', tenant.id);
        localStorage.setItem('tenantName', tenant.name);
        localStorage.setItem('tenantSlug', tenant.slug);
      }

      return user;
    } catch (error: any) {
      // Enhanced error handling to capture validation errors
      const serverData = error.response?.data;
      let errorMessage = 'Sign up failed';
      
      if (serverData) {
          if (serverData.error) {
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
      console.error('Logout error:', error);
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
        this.user = JSON.parse(storedUser);
        return this.user;
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        localStorage.removeItem('user');
      }
    }

    // If we have a token but no user data, something went wrong - clear auth state
    console.warn('Token exists but no user data found - clearing auth state');
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
