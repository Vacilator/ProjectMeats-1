import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Catalog from './Catalog';
import { getAvailableWorkForms } from '../../services/workformsApi';
import { ApiServiceError } from '../../services/apiErrors';
import { quickActionsService } from '@/services/quickActionsService';

vi.mock('../../services/workformsApi', () => ({
  getAvailableWorkForms: vi.fn(),
  createFormSubmission: vi.fn(),
}));

vi.mock('@/services/quickActionsService', () => ({
  quickActionsService: {
    getAvailableForms: vi.fn(),
  },
}));

vi.mock('../../hooks/useWorkFormPermissions', () => ({
  useWorkFormPermissions: () => ({
    permissions: {
      can_create: true,
      can_edit: true,
      can_publish: true,
      can_archive: true,
      can_delete: true,
      allowed_modes: ['wizard', 'visual', 'expert'],
      allowed_node_categories: [],
      can_access_system_templates: true,
      can_create_global_templates: false,
      max_active_flows: null,
      role: 'owner',
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  getUpgradeMessage: () => null,
}));

vi.mock('../../contexts/QuickActionsContext', () => ({
  useQuickActions: () => ({
    refreshQuickActions: vi.fn(),
  }),
}));

describe('WorkForms Catalog error state', () => {
  it('shows a retryable error state when both WorkForms and forms fail to load', async () => {
    const err = { response: { status: 500, data: { detail: 'Boom' } } };

    vi.mocked(getAvailableWorkForms).mockRejectedValueOnce(err);
    vi.mocked(quickActionsService.getAvailableForms).mockRejectedValueOnce(err);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/catalog']}>
          <Routes>
            <Route path="/workforms/catalog" element={<Catalog />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Couldn't load catalog")).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();
    expect(screen.getByText(/status 500/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('surfaces circuit-breaker friendly errors with status', async () => {
    const err = new ApiServiceError('Server error. Please try again shortly.', {
      kind: 'circuit_breaker',
      status: 503,
      code: 'CIRCUIT_BREAKER',
    });

    vi.mocked(getAvailableWorkForms).mockRejectedValueOnce(err);
    vi.mocked(quickActionsService.getAvailableForms).mockRejectedValueOnce(err);

    const client = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/catalog']}>
          <Routes>
            <Route path="/workforms/catalog" element={<Catalog />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText("Couldn't load catalog")).toBeInTheDocument();
    expect(screen.getByText('Server error. Please try again shortly.')).toBeInTheDocument();
    expect(screen.getByText(/status 503/i)).toBeInTheDocument();
  });
});
