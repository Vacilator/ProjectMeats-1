/**
 * Tests for AuthService
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AuthService } from './authService';

// Mock localStorage
const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', { value: mockLocalStorage });

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    mockLocalStorage.clear();
    vi.clearAllMocks();
    authService = new AuthService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('initializes with null token when localStorage is empty', () => {
      expect(authService.getToken()).toBeNull();
      expect(authService.getUser()).toBeNull();
    });

    it('initializes with stored token from localStorage', () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({ id: 1, username: 'test' }));

      const newService = new AuthService();
      expect(newService.getToken()).toBe('test-token');
      expect(newService.getUser()).toEqual(expect.objectContaining({ id: 1, username: 'test' }));
    });

    it('handles invalid JSON in stored user gracefully', () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', 'invalid-json');

      const newService = new AuthService();
      expect(newService.getToken()).toBe('test-token');
      expect(newService.getUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns false when not authenticated', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns true when token and user are present', () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({ id: 1, username: 'test' }));

      const newService = new AuthService();
      expect(newService.isAuthenticated()).toBe(true);
    });
  });

  describe('isAdmin', () => {
    it('returns false when user is null', () => {
      expect(authService.isAdmin()).toBe(false);
    });

    it('returns true when user is staff', () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'admin',
        is_staff: true,
        is_superuser: false
      }));

      const newService = new AuthService();
      expect(newService.isAdmin()).toBe(true);
    });

    it('returns true when user is superuser', () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'superadmin',
        is_staff: false,
        is_superuser: true
      }));

      const newService = new AuthService();
      expect(newService.isAdmin()).toBe(true);
    });

    it('returns false when user is neither staff nor superuser', () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({
        id: 1,
        username: 'regular',
        is_staff: false,
        is_superuser: false
      }));

      const newService = new AuthService();
      expect(newService.isAdmin()).toBe(false);
    });
  });

  describe('logout', () => {
    it('clears all auth-related localStorage items', async () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({ id: 1 }));
      mockLocalStorage.setItem('tenantId', 'tenant-123');
      mockLocalStorage.setItem('tenantName', 'Test Tenant');
      mockLocalStorage.setItem('tenantSlug', 'test-tenant');

      const newService = new AuthService();
      await newService.logout();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('authToken');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('user');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tenantId');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tenantName');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('tenantSlug');
    });

    it('clears internal state after logout', async () => {
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify({ id: 1 }));

      const newService = new AuthService();
      expect(newService.isAuthenticated()).toBe(true);

      await newService.logout();

      expect(newService.getToken()).toBeNull();
      expect(newService.getUser()).toBeNull();
      expect(newService.isAuthenticated()).toBe(false);
    });
  });

  describe('getCurrentUser', () => {
    it('returns null when no token exists', async () => {
      const result = await authService.getCurrentUser();
      expect(result).toBeNull();
    });

    it('returns stored user when available', async () => {
      const user = { id: 1, username: 'test', email: 'test@example.com' };
      mockLocalStorage.setItem('authToken', 'test-token');
      mockLocalStorage.setItem('user', JSON.stringify(user));

      const newService = new AuthService();
      const result = await newService.getCurrentUser();
      expect(result).toEqual(expect.objectContaining(user));
    });
  });
});
