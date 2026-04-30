/* eslint-disable import/first */
// Tests for the new guest-mode and invite-only API methods in ApiService.
// Uses manual mocks to avoid native module dependencies.
jest.mock('axios', () => {
  const axiosMock = {
    create: jest.fn(() => ({
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

  return {
    __esModule: true,
    default: axiosMock,
    ...axiosMock,
  };
});

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: {
    expoConfig: {
      hostUri: '192.168.0.2:8081',
      extra: { apiBaseUrl: 'http://localhost:8000/api/v1' },
    },
  },
}));

import { ApiService } from '../services/ApiService';
import {
  getApiErrorPresentation,
  toApiErrorText,
} from '../services/apiErrorPresentation';

// Access the private internal axios instance via type cast
const internalApi = (ApiService as any).api as {
  get: jest.Mock;
  post: jest.Mock;
  defaults: { headers: { common: Record<string, string> } };
  interceptors: {
    response: {
      use: jest.Mock;
    };
  };
};

describe('ApiService – guest mode', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    internalApi.defaults.headers.common = {};
  });

  it('guestLogin POSTs to /auth/guest-login/', async () => {
    const mockSession = {
      token: 'tok_guest',
      user: {
        id: 1,
        username: 'guest',
        email: '',
        first_name: 'Guest',
        last_name: '',
        is_active: true,
        date_joined: '2026-03-19T00:00:00Z',
      },
      tenant: {
        id: 'uuid-1',
        name: 'Guest Tenant',
        slug: 'guest',
        role: 'admin',
        is_guest: true,
      },
      message: 'Welcome',
    };
    internalApi.post.mockResolvedValueOnce({ data: mockSession });

    const result = await ApiService.guestLogin();
    expect(result.token).toBe('tok_guest');
    expect(internalApi.post).toHaveBeenCalledWith('/auth/guest-login/');
  });
});

describe('ApiService – invite flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('validateInvite calls GET /invitations/validate/?token=...', async () => {
    const mockInvite = {
      valid: true,
      email: 'user@example.com',
      role: 'user',
      is_reusable: false,
      uses_remaining: 1,
      tenant: { name: 'Acme', slug: 'acme' },
      message: null,
      expires_at: '2026-03-25T00:00:00Z',
    };
    internalApi.get.mockResolvedValueOnce({ data: mockInvite });

    const result = await ApiService.validateInvite('tok-1');
    expect(result.token).toBe('tok-1');
    expect(result.valid).toBe(true);
    expect(internalApi.get).toHaveBeenCalledWith('/invitations/validate/', {
      params: { token: 'tok-1' },
    });
  });

  it('acceptInvite POSTs to /auth/signup-with-invitation/', async () => {
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
      tenant: {
        id: 'uuid-1',
        name: 'Acme',
        slug: 'acme',
      },
      role: 'user',
    };
    internalApi.post.mockResolvedValueOnce({ data: mockLoginResponse });

    const result = await ApiService.acceptInvite({
      token: 'tok-1',
      username: 'newuser',
      email: 'user@example.com',
      password: 'password123',
    });
    expect(result.token).toBe('auth-token-abc');
    expect(result.user.username).toBe('newuser');
    expect(internalApi.post).toHaveBeenCalledWith('/auth/signup-with-invitation/', {
      invitation_token: 'tok-1',
      username: 'newuser',
      email: 'user@example.com',
      password: 'password123',
      first_name: undefined,
      last_name: undefined,
    });
  });
});

describe('ApiService – tenant context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    internalApi.defaults.headers.common = {};
  });

  it('setTenantId sets X-Tenant-ID header', () => {
    ApiService.setTenantId('tenant-123');
    expect(internalApi.defaults.headers.common['X-Tenant-ID']).toBe('tenant-123');
  });

  it('clearTenantId removes X-Tenant-ID header', () => {
    ApiService.setTenantId('tenant-123');
    ApiService.clearTenantId();
    expect(internalApi.defaults.headers.common['X-Tenant-ID']).toBeUndefined();
  });
});

describe('ApiService – workforms', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('getWorkForms calls GET /tenant-workforms/ and maps list results', async () => {
    const mockResponse = {
      count: 2,
      results: [
        {
          id: 'wf-1',
          name: 'Intake',
          description: 'Desc',
          status: 'active',
          node_count: '3',
          edge_count: 2,
          version: 1,
          execution_count: 0,
          last_executed_at: null,
          updated_at: '2026-01-02T00:00:00Z',
        },
      ],
    };
    internalApi.get.mockResolvedValueOnce({ data: mockResponse });

    const result = await ApiService.getWorkForms();
    expect(result.count).toBe(2);
    expect(result.results[0].name).toBe('Intake');
    expect(result.results[0].status).toBe('active');
    expect(result.results[0].is_active).toBe(true);
    expect(result.results[0].edge_count).toBe(2);
    expect(internalApi.get).toHaveBeenCalledWith('/tenant-workforms/');
  });

  it('getWorkForm calls GET /tenant-workforms/{id}/ and maps detail response', async () => {
    const mockForm = {
      id: 'wf-1',
      name: 'Intake',
      description: 'Desc',
      status: 'draft',
      node_count: '1',
      workflow_definition: {
        nodes: [{ id: 'n1' }],
        edges: [],
      },
      form_references: [],
      updated_at: '2026-01-02T00:00:00Z',
    };
    internalApi.get.mockResolvedValueOnce({ data: mockForm });

    const result = await ApiService.getWorkForm('wf-1');
    expect(result.id).toBe('wf-1');
    expect(result.status).toBe('draft');
    expect(result.is_active).toBe(false);
    expect(result.node_count).toBe(1);
    expect(result.workflow_definition?.nodes?.length).toBe(1);
    expect(internalApi.get).toHaveBeenCalledWith('/tenant-workforms/wf-1/');
  });

  it('executeWorkForm POSTs to /tenant-workforms/{id}/execute/ with initial_data', async () => {
    const mockExecution = {
      id: 'exec-1',
      workform_id: 'wf-1',
      workform_name: 'Intake',
      status: 'in_progress',
      started_at: '2026-04-21T00:00:00Z',
      completed_at: null,
      error_message: '',
    };
    internalApi.post.mockResolvedValueOnce({ data: mockExecution });

    const result = await ApiService.executeWorkForm('wf-1', { foo: 'bar' });
    expect(result.id).toBe('exec-1');
    expect(internalApi.post).toHaveBeenCalledWith('/tenant-workforms/wf-1/execute/', {
      initial_data: { foo: 'bar' },
    });
  });
});

describe('ApiService – auth expiry handling', () => {
  const responseErrorHandler = internalApi.interceptors.response.use.mock.calls[0][1] as (
    error: unknown
  ) => Promise<never>;

  beforeEach(() => {
    jest.clearAllMocks();
    ApiService.setAuthFailureHandler(null);
  });

  it('invokes the registered auth failure handler for non-auth 401 responses', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    ApiService.setAuthFailureHandler(handler);

    const error = {
      response: { status: 401, data: { detail: 'Unauthorized' } },
      config: { url: '/customers/' },
      message: 'Request failed with status code 401',
    };

    await expect(responseErrorHandler(error)).rejects.toEqual(error);
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 401,
        kind: 'auth',
        friendlyMessage: 'Your session has expired. Please sign in again.',
      })
    );
  });

  it('does not invoke the auth failure handler for auth endpoint 401 responses', async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    ApiService.setAuthFailureHandler(handler);

    const error = {
      response: { status: 401, data: { detail: 'Invalid credentials' } },
      config: { url: '/auth/login/' },
      message: 'Request failed with status code 401',
    };

    await expect(responseErrorHandler(error)).rejects.toEqual(error);
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('apiErrorPresentation', () => {
  it('normalizes backend error codes into user-safe text', () => {
    const presentation = getApiErrorPresentation({
      response: {
        status: 503,
        data: { error_code: 'AI_NOT_CONFIGURED' },
      },
      message: 'Request failed with status code 503',
    });

    expect(presentation.kind).toBe('not_configured');
    expect(presentation.friendlyMessage).toContain('AI is not enabled');
  });

  it('uses field-array validation messages before falling back', () => {
    const message = toApiErrorText(
      {
        response: {
          status: 400,
          data: { username: ['This username is already taken.'] },
        },
        message: 'Request failed with status code 400',
      },
      { fallbackMessage: 'Unable to accept invite.' }
    );

    expect(message).toBe('This username is already taken.');
  });
});
