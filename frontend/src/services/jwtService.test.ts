/**
 * Tests for JWT Token Management Service
 * 
 * Wave S1: Security Hardening - Frontend JWT Integration
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isUsingJwt,
  needsRefresh,
  getAuthHeader,
  getTokenClaims,
  getTenantFromToken,
} from './jwtService';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Helper to create a test JWT token
function createTestToken(payload: object, expiresInSeconds: number = 900): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const payloadWithExp = { ...payload, exp };
  const payloadBase64 = btoa(JSON.stringify(payloadWithExp));
  const signature = 'test-signature';
  return `${header}.${payloadBase64}.${signature}`;
}

describe('jwtService', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  describe('storeTokens', () => {
    it('stores access and refresh tokens', () => {
      const accessToken = createTestToken({ user_id: 1 });
      const refreshToken = createTestToken({ user_id: 1 }, 604800); // 7 days

      storeTokens(accessToken, refreshToken);

      expect(localStorage.getItem('accessToken')).toBe(accessToken);
      expect(localStorage.getItem('refreshToken')).toBe(refreshToken);
    });

    it('stores token expiry', () => {
      const accessToken = createTestToken({ user_id: 1 }, 900);
      const refreshToken = createTestToken({ user_id: 1 }, 604800);

      storeTokens(accessToken, refreshToken);

      const expiry = localStorage.getItem('tokenExpiry');
      expect(expiry).toBeTruthy();
      expect(parseInt(expiry!)).toBeGreaterThan(Date.now());
    });

    it('removes legacy token when storing JWT', () => {
      localStorage.setItem('authToken', 'legacy-token');

      const accessToken = createTestToken({ user_id: 1 });
      const refreshToken = createTestToken({ user_id: 1 }, 604800);
      storeTokens(accessToken, refreshToken);

      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });

  describe('getAccessToken', () => {
    it('returns JWT access token when available', () => {
      const accessToken = createTestToken({ user_id: 1 });
      localStorage.setItem('accessToken', accessToken);

      expect(getAccessToken()).toBe(accessToken);
    });

    it('falls back to legacy token when no JWT', () => {
      localStorage.setItem('authToken', 'legacy-token');

      expect(getAccessToken()).toBe('legacy-token');
    });

    it('returns null when no tokens', () => {
      expect(getAccessToken()).toBeNull();
    });
  });

  describe('getRefreshToken', () => {
    it('returns refresh token when available', () => {
      const refreshToken = createTestToken({ user_id: 1 }, 604800);
      localStorage.setItem('refreshToken', refreshToken);

      expect(getRefreshToken()).toBe(refreshToken);
    });

    it('returns null when no refresh token', () => {
      expect(getRefreshToken()).toBeNull();
    });
  });

  describe('isUsingJwt', () => {
    it('returns true when JWT access token exists', () => {
      localStorage.setItem('accessToken', createTestToken({ user_id: 1 }));

      expect(isUsingJwt()).toBe(true);
    });

    it('returns false when only legacy token exists', () => {
      localStorage.setItem('authToken', 'legacy-token');

      expect(isUsingJwt()).toBe(false);
    });

    it('returns false when no tokens exist', () => {
      expect(isUsingJwt()).toBe(false);
    });
  });

  describe('needsRefresh', () => {
    it('returns false when token is not close to expiry', () => {
      const accessToken = createTestToken({ user_id: 1 }, 900); // 15 min
      localStorage.setItem('accessToken', accessToken);

      expect(needsRefresh()).toBe(false);
    });

    it('returns true when token is close to expiry', () => {
      const accessToken = createTestToken({ user_id: 1 }, 30); // 30 seconds
      localStorage.setItem('accessToken', accessToken);

      expect(needsRefresh()).toBe(true);
    });

    it('returns false when no JWT token', () => {
      expect(needsRefresh()).toBe(false);
    });
  });

  describe('clearTokens', () => {
    it('clears all tokens and expiry', () => {
      localStorage.setItem('accessToken', 'access');
      localStorage.setItem('refreshToken', 'refresh');
      localStorage.setItem('tokenExpiry', '123456');
      localStorage.setItem('authToken', 'legacy');

      clearTokens();

      expect(localStorage.getItem('accessToken')).toBeNull();
      expect(localStorage.getItem('refreshToken')).toBeNull();
      expect(localStorage.getItem('tokenExpiry')).toBeNull();
      expect(localStorage.getItem('authToken')).toBeNull();
    });
  });

  describe('getAuthHeader', () => {
    it('returns Bearer header for JWT', () => {
      const accessToken = createTestToken({ user_id: 1 });
      localStorage.setItem('accessToken', accessToken);

      expect(getAuthHeader()).toBe(`Bearer ${accessToken}`);
    });

    it('returns Token header for legacy', () => {
      localStorage.setItem('authToken', 'legacy-token');

      expect(getAuthHeader()).toBe('Token legacy-token');
    });

    it('returns null when no tokens', () => {
      expect(getAuthHeader()).toBeNull();
    });

    it('prefers JWT over legacy token', () => {
      const accessToken = createTestToken({ user_id: 1 });
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('authToken', 'legacy-token');

      expect(getAuthHeader()).toBe(`Bearer ${accessToken}`);
    });
  });

  describe('getTokenClaims', () => {
    it('returns decoded claims from JWT', () => {
      const accessToken = createTestToken({
        user_id: 1,
        username: 'testuser',
        email: 'test@example.com',
      });
      localStorage.setItem('accessToken', accessToken);

      const claims = getTokenClaims();

      expect(claims).toBeTruthy();
      expect(claims!.user_id).toBe(1);
      expect(claims!.username).toBe('testuser');
      expect(claims!.email).toBe('test@example.com');
    });

    it('returns null when no token', () => {
      expect(getTokenClaims()).toBeNull();
    });
  });

  describe('getTenantFromToken', () => {
    it('extracts tenant info from token claims', () => {
      const accessToken = createTestToken({
        user_id: 1,
        tenant_ids: ['tenant-1', 'tenant-2'],
        default_tenant_id: 'tenant-1',
        default_tenant_slug: 'my-tenant',
      });
      localStorage.setItem('accessToken', accessToken);

      const tenantInfo = getTenantFromToken();

      expect(tenantInfo).toBeTruthy();
      expect(tenantInfo!.tenantIds).toEqual(['tenant-1', 'tenant-2']);
      expect(tenantInfo!.defaultTenantId).toBe('tenant-1');
      expect(tenantInfo!.defaultTenantSlug).toBe('my-tenant');
    });

    it('returns null when no token', () => {
      expect(getTenantFromToken()).toBeNull();
    });
  });
});
