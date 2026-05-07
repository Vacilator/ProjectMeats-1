import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { PlantDetailView } from './PlantDetailView';

const useAuthStateMock = vi.fn(() => ({ loading: false, isAuthenticated: true }));
const apiGet = vi.fn();

vi.mock('@/contexts/AuthContext', () => ({
  useAuthState: () => useAuthStateMock(),
}));

vi.mock('@/components/Shared', () => ({
  EntityFormSurface: ({ entityType, mode }: { entityType: string; mode: string }) => (
    <div data-testid="entity-form-surface">
      {entityType}:{mode}
    </div>
  ),
  ActivityFeed: ({ entityType, entityId }: { entityType: string; entityId: string | number }) => (
    <div data-testid="activity-feed">
      {entityType}:{String(entityId)}
    </div>
  ),
}));

vi.mock('./StandalonePlantEditForm', () => ({
  default: ({
    plantId,
  }: {
    plantId: string;
  }) => <div data-testid="standalone-plant-edit-form">standalone:{plantId}</div>,
}));

vi.mock('@/services/apiService', () => ({
  apiClient: {
    get: (url: string, config?: unknown) => apiGet(url, config),
  },
}));

describe('PlantDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStateMock.mockReturnValue({ loading: false, isAuthenticated: true });
    apiGet.mockImplementation(async (url: string) => {
      if (url === 'contacts/') {
        return { data: { results: [] } };
      }

      return { data: {} };
    });
  });

  it('unmounts the detail surface and mounts the standalone plant edit form when edit is clicked', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/plants/2']}>
        <Routes>
          <Route path="/plants/:id" element={<PlantDetailView />} />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByTestId('entity-form-surface')).toHaveTextContent('plant:view');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit plant/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /edit plant/i }));

    expect(await screen.findByTestId('standalone-plant-edit-form')).toHaveTextContent('standalone:2');
    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
  });

  it('shows an activity tab for the plant record', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/plants/2']}>
        <Routes>
          <Route path="/plants/:id" element={<PlantDetailView />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('tab', { name: /activity/i }));
    expect(await screen.findByTestId('activity-feed')).toHaveTextContent('plant:2');
  });
});
