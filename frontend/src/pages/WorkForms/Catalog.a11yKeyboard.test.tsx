import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import Catalog from './Catalog';
import { getAvailableWorkForms } from '../../services/workformsApi';
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

describe('WorkForms Catalog keyboard a11y', () => {
  it('opens a catalog card via Enter key', async () => {
    vi.mocked(getAvailableWorkForms).mockResolvedValueOnce([
      {
        id: 'wf-1',
        name: 'Beta WorkForm',
        description: 'desc',
        status: 'draft',
        node_count: 1,
        edge_count: 0,
        updated_at: '2026-02-01T00:00:00Z',
      } as any,
    ]);

    vi.mocked(quickActionsService.getAvailableForms).mockResolvedValueOnce([] as any);

    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/workforms/catalog']}>
          <Routes>
            <Route path="/workforms/catalog" element={<Catalog />} />
            <Route path="/workforms/editor/:id" element={<div data-testid="editor-page" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for item to render
    const cardButton = await screen.findByRole('button', { name: /open beta workform/i });

    cardButton.focus();
    expect(cardButton).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(await screen.findByTestId('editor-page')).toBeInTheDocument();
  });
});
