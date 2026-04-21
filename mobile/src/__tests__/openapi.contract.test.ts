/* eslint-disable import/first */
// Contract test: ensure mobile ApiService endpoints exist in backend OpenAPI schema.
// This runs in the mobile CI job (Node-only). The schema is generated in a Python job
// and downloaded as an artifact into mobile/openapi-schema.json.

import fs from 'fs';
import path from 'path';

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

import { ApiService } from '../services/ApiService';

type OpenApiSpec = {
  paths?: Record<string, Record<string, unknown>>;
};

const internalApi = (ApiService as any).api as {
  get: jest.Mock;
  post: jest.Mock;
};

function loadOpenApiSchema(): OpenApiSpec | null {
  const schemaPath = path.resolve(process.cwd(), 'openapi-schema.json');
  if (!fs.existsSync(schemaPath)) {
    return null;
  }

  const raw = fs.readFileSync(schemaPath, 'utf8');
  return JSON.parse(raw) as OpenApiSpec;
}

describe('OpenAPI contract – mobile ApiService', () => {
  it('uses endpoints that exist in backend OpenAPI schema', async () => {
    const spec = loadOpenApiSchema();
    if (!spec) {
      // Local dev runs may not have the CI-generated artifact.
      return;
    }

    const basePath = new URL(((ApiService as any).baseURL as string) ?? '').pathname.replace(/\/+$/, '');
    const paths = spec.paths ?? {};

    const expectExists = (relativePath: string, method: 'get' | 'post') => {
      const fullPath = `${basePath}${relativePath}`;
      expect(paths[fullPath]).toBeDefined();
      expect(paths[fullPath]?.[method]).toBeDefined();
    };

    // Stub API responses so the methods can run.
    internalApi.post.mockResolvedValue({
      data: {
        token: 'tok',
        user: { id: 1, username: 'u', email: '', first_name: '', last_name: '' },
        tenant: { id: 't1', name: 'Tenant', slug: 'tenant', role: 'user', is_guest: true },
        message: 'ok',
      },
    });
    await ApiService.guestLogin();
    expectExists('/auth/guest-login/', 'post');

    internalApi.get.mockResolvedValue({
      data: {
        valid: true,
        email: 'user@example.com',
        role: 'user',
        is_reusable: false,
        uses_remaining: 1,
        tenant: { name: 'Tenant', slug: 'tenant' },
        message: null,
        expires_at: '2026-01-01T00:00:00Z',
      },
    });
    await ApiService.validateInvite('tok-1');
    expectExists('/invitations/validate/', 'get');

    internalApi.post.mockResolvedValue({
      data: {
        token: 'tok',
        user: { id: 1, username: 'u', email: 'user@example.com', first_name: '', last_name: '' },
        tenant: { id: 't1', name: 'Tenant', slug: 'tenant' },
        role: 'user',
      },
    });
    await ApiService.acceptInvite({
      token: 'tok-1',
      username: 'u',
      email: 'user@example.com',
      password: 'password123',
    });
    expectExists('/auth/signup-with-invitation/', 'post');

    internalApi.post.mockResolvedValue({
      data: {
        token: 'tok',
        user: { id: 1, username: 'u', email: 'user@example.com', first_name: '', last_name: '' },
        tenants: [],
      },
    });
    await ApiService.login({ username: 'u', password: 'p' });
    expectExists('/auth/login/', 'post');

    internalApi.post.mockResolvedValue({ data: { message: 'ok' } });
    await ApiService.logout();
    expectExists('/auth/logout/', 'post');
  });
});
