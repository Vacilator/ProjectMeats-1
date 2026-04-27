/**
 * WorkForms API (tenant guard) tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockApiClient = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  delete: vi.fn(),
}));

vi.mock('./apiService', () => ({
  apiClient: mockApiClient,
}));

import { getAvailableWorkForms, listTenantWorkForms } from './workformsApi';

describe('workformsApi tenant guards', () => {
  const TENANT_ID = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('getAvailableWorkForms: does not request when tenantId is missing', async () => {
    const result = await getAvailableWorkForms();

    expect(mockApiClient.get).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('getAvailableWorkForms: includes params when tenantId is present', async () => {
    localStorage.setItem('tenantId', TENANT_ID);

    mockApiClient.get.mockResolvedValue({
      data: {
        results: [
          {
            id: 'wf-1',
            name: 'WorkForm 1',
            description: '',
            status: 'active',
            node_count: 0,
            edge_count: 0,
            updated_at: '2026-02-01T00:00:00Z',
          },
        ],
      },
    });

    const result = await getAvailableWorkForms({ status: 'active' });

    expect(mockApiClient.get).toHaveBeenCalledWith('/tenant-workforms/', { params: { status: 'active' } });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('wf-1');
  });

  it('listTenantWorkForms: does not request when tenantId is missing', async () => {
    const result = await listTenantWorkForms();

    expect(mockApiClient.get).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it('listTenantWorkForms: requests when tenantId is present', async () => {
    localStorage.setItem('tenantId', TENANT_ID);

    mockApiClient.get.mockResolvedValue({
      data: {
        results: [
          {
            id: 'wf-1',
            tenant: TENANT_ID,
            name: 'WorkForm 1',
            description: '',
            status: 'active',
            workflow_definition: {},
            form_references: [],
            version: 1,
            execution_count: 0,
            clone_count: 0,
            node_count: 0,
            edge_count: 0,
            node_types_summary: {},
            validation_status: { valid: true, missing_forms: [], total_references: 0 },
            created_at: '2026-02-01T00:00:00Z',
            updated_at: '2026-02-01T00:00:00Z',
          },
        ],
      },
    });

    const result = await listTenantWorkForms({ search: 'abc' });

    expect(mockApiClient.get).toHaveBeenCalledWith('/tenant-workforms/', { params: { search: 'abc' } });
    expect(result).toHaveLength(1);
  });
});
