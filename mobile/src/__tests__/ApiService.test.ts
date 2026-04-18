/* eslint-disable import/first */
// Tests for the new guest-mode and invite-only API methods in ApiService.
// Uses manual mocks to avoid native module dependencies.
jest.mock('axios', () => {
  const actualAxios = jest.requireActual('axios');
  return {
    ...actualAxios,
    create: jest.fn(() => ({
      ...actualAxios.create(),
      get: jest.fn(),
      post: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: jest.fn() },
        response: { use: jest.fn() },
      },
    })),
  };
});

import { ApiService } from '../services/ApiService';

// Access the private internal axios instance via type cast
const internalApi = (ApiService as any).api as {
  get: jest.Mock;
  post: jest.Mock;
  defaults: { headers: { common: Record<string, string> } };
};

describe('ApiService – guest mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    internalApi.defaults.headers.common = {};
  });

  it('setGuestToken sets Authorization header with GuestToken scheme', () => {
    ApiService.setGuestToken('gt_abc123');
    expect(internalApi.defaults.headers.common['Authorization']).toBe(
      'GuestToken gt_abc123'
    );
  });

  it('loginAsGuest POSTs to /auth/guest-session/ with tenant_slug', async () => {
    const mockSession = {
      guest_token: 'gt_test',
      tenant_id: 'uuid-1',
      tenant_name: 'Test',
      tenant_slug: 'test',
      expires_at: '2026-03-19T00:00:00Z',
      permissions: ['view_workforms'],
    };
    internalApi.post.mockResolvedValueOnce({ data: mockSession });

    const result = await ApiService.loginAsGuest('test');
    expect(result.guest_token).toBe('gt_test');
    expect(internalApi.post).toHaveBeenCalledWith('/auth/guest-session/', {
      tenant_slug: 'test',
    });
  });

  it('loginAsGuest includes access_code when provided', async () => {
    internalApi.post.mockResolvedValueOnce({ data: {} });

    await ApiService.loginAsGuest('secure', 'SECRET');
    expect(internalApi.post).toHaveBeenCalledWith('/auth/guest-session/', {
      tenant_slug: 'secure',
      access_code: 'SECRET',
    });
  });

  it('loginAsGuest omits access_code when not provided', async () => {
    internalApi.post.mockResolvedValueOnce({ data: {} });

    await ApiService.loginAsGuest('no-code');
    const callArgs = internalApi.post.mock.calls[0][1];
    expect(callArgs).not.toHaveProperty('access_code');
  });
});

describe('ApiService – invite flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validateInvite calls GET /auth/invites/{token}/', async () => {
    const mockInvite = {
      token: 'tok-1',
      tenant_id: 'uuid-1',
      tenant_name: 'Acme',
      tenant_slug: 'acme',
      invited_by: 'admin',
      invited_email: 'user@example.com',
      role: 'user',
      expires_at: '2026-03-25T00:00:00Z',
      is_expired: false,
      is_accepted: false,
    };
    internalApi.get.mockResolvedValueOnce({ data: mockInvite });

    const result = await ApiService.validateInvite('tok-1');
    expect(result.token).toBe('tok-1');
    expect(result.is_expired).toBe(false);
    expect(internalApi.get).toHaveBeenCalledWith('/auth/invites/tok-1/');
  });

  it('acceptInvite POSTs to /auth/invites/accept/', async () => {
    const mockLoginResponse = {
      token: 'auth-token-abc',
      user: {
        id: 1,
        username: 'newuser',
        email: 'user@example.com',
        first_name: 'New',
        last_name: 'User',
        is_active: true,
        date_joined: '2026-03-18T00:00:00Z',
      },
    };
    internalApi.post.mockResolvedValueOnce({ data: mockLoginResponse });

    const result = await ApiService.acceptInvite({
      token: 'tok-1',
      username: 'newuser',
      password: 'password123',
    });
    expect(result.token).toBe('auth-token-abc');
    expect(result.user.username).toBe('newuser');
    expect(internalApi.post).toHaveBeenCalledWith('/auth/invites/accept/', {
      token: 'tok-1',
      username: 'newuser',
      password: 'password123',
    });
  });
});

describe('ApiService – workforms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getWorkForms calls GET /workflows/ and returns results', async () => {
    const mockResponse = {
      count: 2,
      results: [
        {
          id: 'wf-1',
          name: 'Intake',
          tenant: 't-1',
          is_active: true,
          node_count: 3,
          created_at: '',
          updated_at: '',
        },
      ],
    };
    internalApi.get.mockResolvedValueOnce({ data: mockResponse });

    const result = await ApiService.getWorkForms();
    expect(result.count).toBe(2);
    expect(result.results[0].name).toBe('Intake');
    expect(internalApi.get).toHaveBeenCalledWith('/workflows/');
  });

  it('getWorkForm calls GET /workflows/{id}/', async () => {
    const mockForm = {
      id: 'wf-1',
      name: 'Intake',
      tenant: 't-1',
      is_active: true,
      node_count: 3,
      created_at: '',
      updated_at: '',
    };
    internalApi.get.mockResolvedValueOnce({ data: mockForm });

    const result = await ApiService.getWorkForm('wf-1');
    expect(result.id).toBe('wf-1');
    expect(internalApi.get).toHaveBeenCalledWith('/workflows/wf-1/');
  });
});
