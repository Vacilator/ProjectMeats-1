import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { apiClient } from '../services/apiService';
import { canUseEditorMode, canUseNodeCategory, useWorkFormPermissions } from './useWorkFormPermissions';

const VALID_UUID = '11111111-1111-4111-8111-111111111111';

vi.mock('../services/apiService', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const createWrapper = () => {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );

  return { client, wrapper };
};

describe('useWorkFormPermissions', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('returns default permissions when API fails (non-401)', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({
      response: { status: 500, data: { detail: 'Boom' } },
      message: 'Boom',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkFormPermissions(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(apiClient.get).toHaveBeenCalledWith('/workflows/permissions/');
    expect(result.current.error).toBeNull();
    expect(result.current.permissions.role).toBe('anonymous');
    expect(result.current.permissions.can_create).toBe(false);
  });

  it('propagates 401 errors so auth handling can run', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce({
      response: { status: 401, data: { detail: 'Unauthorized' } },
      message: 'Unauthorized',
    });

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkFormPermissions(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });

    expect(apiClient.get).toHaveBeenCalledWith('/workflows/permissions/');
    expect(result.current.permissions.role).toBe('anonymous');
  });

  it('scopes the permissions query key by tenant id', async () => {
    localStorage.setItem('tenantId', VALID_UUID);
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: {
        can_create: true,
        can_edit: true,
        can_publish: false,
        can_archive: false,
        can_delete: false,
        allowed_modes: ['visual'],
        allowed_node_categories: ['core'],
        can_access_system_templates: false,
        can_create_global_templates: false,
        max_active_flows: 5,
        role: 'admin',
      },
    });

    const { client, wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkFormPermissions(), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(client.getQueryCache().getAll().map((query) => query.queryKey)).toContainEqual([
      'tenant',
      VALID_UUID,
      'workforms',
      'permissions',
    ]);
  });
});

describe('WorkForms permission helpers', () => {
  it('canUseEditorMode fails closed when permissions are missing', () => {
    expect(canUseEditorMode(undefined, 'visual')).toBe(false);
  });

  it('canUseNodeCategory allows all categories when allowed_node_categories is empty', () => {
    expect(
      canUseNodeCategory(
        {
          can_create: false,
          can_edit: false,
          can_publish: false,
          can_archive: false,
          can_delete: false,
          allowed_modes: [],
          allowed_node_categories: [],
          can_access_system_templates: false,
          can_create_global_templates: false,
          max_active_flows: 0,
          role: 'anonymous',
        },
        'anything'
      )
    ).toBe(true);
  });
});
