/**
 * JWT Token Management Service
 * 
 * Wave S1: Security Hardening - Frontend JWT Integration
 * 
 * Handles JWT token storage, refresh, and expiration checking.
 * Works with the backend JWT endpoints:
 * - POST /api/v1/auth/token/ - Obtain tokens
 * - POST /api/v1/auth/token/refresh/ - Refresh access token
 * - POST /api/v1/auth/token/verify/ - Verify token
 */

import axios from 'axios';
import { config } from '../config/runtime';

const API_BASE_URL = config.API_BASE_URL;

// Storage keys
const ACCESS_TOKEN_KEY = 'accessToken';
const REFRESH_TOKEN_KEY = 'refreshToken';
const TOKEN_EXPIRY_KEY = 'tokenExpiry';

// Legacy key for backward compatibility
const LEGACY_TOKEN_KEY = 'authToken';

// Token refresh buffer (refresh 1 minute before expiry)
const REFRESH_BUFFER_MS = 60 * 1000;

// Minimum time between refresh attempts (prevent rapid retries)
const MIN_REFRESH_INTERVAL_MS = 5000;

let lastRefreshAttempt = 0;
let refreshPromise: Promise<string | null> | null = null;

/**
 * Decode JWT payload without verification (for expiry check)
 */
function decodeJwtPayload(token: string): { exp?: number; [key: string]: unknown } | null {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Get token expiry time in milliseconds
 */
function getTokenExpiry(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (payload?.exp) {
    return payload.exp * 1000; // Convert to milliseconds
  }
  return null;
}

/**
 * Check if token is expired or about to expire
 */
function isTokenExpired(token: string, bufferMs: number = 0): boolean {
  const expiry = getTokenExpiry(token);
  if (!expiry) return true;
  return Date.now() >= expiry - bufferMs;
}

/**
 * Store JWT tokens
 */
export function storeTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  
  // Store expiry for quick checks without decoding
  const expiry = getTokenExpiry(accessToken);
  if (expiry) {
    localStorage.setItem(TOKEN_EXPIRY_KEY, expiry.toString());
  }
  
  // Remove legacy token if present
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Get access token (may trigger refresh if expired)
 */
export function getAccessToken(): string | null {
  // Check for JWT token first
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) {
    // Check if token is valid
    if (isTokenExpired(accessToken)) {
      console.debug('[JWT] Access token is expired');
      // Don't return expired token - let refresh handle it
      return null;
    }
    return accessToken;
  }
  
  // Fall back to legacy token for backward compatibility
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    console.debug('[JWT] Using legacy token');
  }
  return legacyToken;
}

/**
 * Get refresh token
 */
export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

/**
 * Check if using JWT (vs legacy token)
 */
export function isUsingJwt(): boolean {
  return !!localStorage.getItem(ACCESS_TOKEN_KEY);
}

/**
 * Check if access token needs refresh
 */
export function needsRefresh(): boolean {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return false;
  
  return isTokenExpired(accessToken, REFRESH_BUFFER_MS);
}

/**
 * Refresh the access token using the refresh token
 * Returns the new access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  // Prevent multiple simultaneous refresh attempts
  if (refreshPromise) {
    return refreshPromise;
  }
  
  // Rate limit refresh attempts
  const now = Date.now();
  if (now - lastRefreshAttempt < MIN_REFRESH_INTERVAL_MS) {
    console.debug('[JWT] Skipping refresh - too soon since last attempt');
    return getAccessToken();
  }
  
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    console.debug('[JWT] No refresh token available');
    return null;
  }
  
  // Check if refresh token itself is expired
  if (isTokenExpired(refreshToken)) {
    console.debug('[JWT] Refresh token expired');
    clearTokens();
    return null;
  }
  
  lastRefreshAttempt = now;
  
  refreshPromise = (async () => {
    try {
      console.debug('[JWT] Refreshing access token...');
      
      // Use axios directly to avoid interceptor loops
      const response = await axios.post(
        `${API_BASE_URL}/auth/token/refresh/`,
        { refresh: refreshToken },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000,
        }
      );
      
      const { access, refresh: newRefresh } = response.data;
      
      // Store new tokens (refresh token rotates)
      storeTokens(access, newRefresh || refreshToken);
      
      console.debug('[JWT] Token refreshed successfully');
      return access;
    } catch (error) {
      console.error('[JWT] Token refresh failed:', error);
      
      // If refresh fails with 401, tokens are invalid
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        clearTokens();
      }
      
      return null;
    } finally {
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
}

/**
 * Clear all tokens (logout)
 */
export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Get Authorization header value
 * Returns 'Bearer <token>' for JWT or 'Token <token>' for legacy
 */
export function getAuthHeader(): string | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (accessToken) {
    // Only return if token is not expired
    if (!isTokenExpired(accessToken)) {
      return `Bearer ${accessToken}`;
    }
    console.debug('[JWT] Access token expired, needs refresh');
    return null;
  }
  
  // Fall back to legacy token
  const legacyToken = localStorage.getItem(LEGACY_TOKEN_KEY);
  if (legacyToken) {
    console.debug('[JWT] Using legacy Token auth');
    return `Token ${legacyToken}`;
  }
  
  console.warn('[JWT] No auth token available');
  return null;
}

/**
 * Migrate from legacy token to JWT
 * Called after successful JWT login to clean up
 */
export function migrateLegacyToken(): void {
  localStorage.removeItem(LEGACY_TOKEN_KEY);
}

/**
 * Get token claims (decoded payload)
 */
export function getTokenClaims(): { [key: string]: unknown } | null {
  const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY);
  if (!accessToken) return null;
  return decodeJwtPayload(accessToken);
}

/**
 * Get tenant info from token claims
 */
export function getTenantFromToken(): {
  tenantIds?: string[];
  defaultTenantId?: string;
  defaultTenantSlug?: string;
} | null {
  const claims = getTokenClaims();
  if (!claims) return null;
  
  return {
    tenantIds: claims.tenant_ids as string[] | undefined,
    defaultTenantId: claims.default_tenant_id as string | undefined,
    defaultTenantSlug: claims.default_tenant_slug as string | undefined,
  };
}
