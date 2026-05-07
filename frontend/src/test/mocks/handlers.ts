/**
 * MSW Handlers - Core API endpoint mocks
 *
 * Provides deterministic responses for frontend tests.
 * Handlers match the actual API contract shape.
 */

import { http, HttpResponse } from 'msw';

const BASE_URL = '/api/v1';

// -------------------------------------------------------------------
// Auth Handlers
// -------------------------------------------------------------------

const authHandlers = [
  http.post(`${BASE_URL}/auth/login/`, () => {
    return HttpResponse.json({
      access: 'mock-access-token',
      refresh: 'mock-refresh-token',
      user: {
        id: 'user-001',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        is_active: true,
      },
    });
  }),

  http.post(`${BASE_URL}/auth/refresh/`, () => {
    return HttpResponse.json({
      access: 'mock-refreshed-token',
    });
  }),

  http.get(`${BASE_URL}/auth/me/`, () => {
    return HttpResponse.json({
      id: 'user-001',
      email: 'test@example.com',
      first_name: 'Test',
      last_name: 'User',
      is_active: true,
      tenant_id: 'tenant-001',
    });
  }),
];

// -------------------------------------------------------------------
// Tenant Handlers
// -------------------------------------------------------------------

const tenantHandlers = [
  http.get(`${BASE_URL}/tenants/`, () => {
    return HttpResponse.json({
      results: [
        {
          id: 'tenant-001',
          name: 'Test Tenant',
          slug: 'test-tenant',
          is_active: true,
        },
      ],
      count: 1,
    });
  }),

  http.get(`${BASE_URL}/tenants/:id/`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Tenant',
      slug: 'test-tenant',
      is_active: true,
    });
  }),
];

// -------------------------------------------------------------------
// Entity Handlers
// -------------------------------------------------------------------

const entityHandlers = [
  http.get(`${BASE_URL}/entities/:entityType/`, ({ params }) => {
    return HttpResponse.json({
      results: [],
      count: 0,
      next: null,
      previous: null,
    });
  }),

  http.get(`${BASE_URL}/entities/:entityType/:id/`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      entity_type: params.entityType,
      data: {},
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
    });
  }),

  http.post(`${BASE_URL}/entities/:entityType/`, async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json(
      {
        id: 'new-entity-001',
        ...(body as Record<string, unknown>),
        created_at: new Date().toISOString(),
      },
      { status: 201 },
    );
  }),
];

// -------------------------------------------------------------------
// Workflow Handlers
// -------------------------------------------------------------------

const workflowHandlers = [
  http.get(`${BASE_URL}/workflows/`, () => {
    return HttpResponse.json({
      results: [],
      count: 0,
    });
  }),

  http.get(`${BASE_URL}/workflows/:id/`, ({ params }) => {
    return HttpResponse.json({
      id: params.id,
      name: 'Test Workflow',
      status: 'active',
      template_id: 'tpl-001',
      nodes: [],
      edges: [],
    });
  }),

  http.get(`${BASE_URL}/workflows/templates/`, () => {
    return HttpResponse.json({
      results: [
        {
          id: 'tpl-001',
          name: 'EndToEndInquiryToPOProcess',
          version: '1.2.0',
          is_official: true,
        },
      ],
      count: 1,
    });
  }),
];

// -------------------------------------------------------------------
// AI Assistant Handlers
// -------------------------------------------------------------------

const aiHandlers = [
  http.post(`${BASE_URL}/ai-assistant/suggestions/contextual/`, () => {
    return HttpResponse.json({
      suggestions: [],
      entity_type: 'unknown',
      entity_id: '',
      cache_hit: false,
      confidence: 0.0,
      evaluation_source: 'heuristic',
    });
  }),

  http.post(`${BASE_URL}/ai-assistant/anomaly/check/`, () => {
    return HttpResponse.json({
      results: [],
      has_warnings: false,
      has_critical: false,
      requires_confirmation: false,
    });
  }),

  http.post(`${BASE_URL}/ai-assistant/email-drafts/generate/`, () => {
    return HttpResponse.json({
      draft: null,
      available: false,
      reason: 'Mock: no context',
    });
  }),
];

// -------------------------------------------------------------------
// Health Check
// -------------------------------------------------------------------

const healthHandlers = [
  http.get(`${BASE_URL}/health/`, () => {
    return HttpResponse.json({ status: 'ok' });
  }),
];

// -------------------------------------------------------------------
// Export All Handlers
// -------------------------------------------------------------------

export const handlers = [
  ...authHandlers,
  ...tenantHandlers,
  ...entityHandlers,
  ...workflowHandlers,
  ...aiHandlers,
  ...healthHandlers,
];
