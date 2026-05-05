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
}));

vi.mock('@/services/apiService', () => ({
  apiClient: {
    get: (url: string, config?: unknown) => apiGet(url, config),
  },
  apiService: {
    updatePlant: vi.fn(),
  },
}));

describe('PlantDetailView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStateMock.mockReturnValue({ loading: false, isAuthenticated: true });
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/plants/2/') {
        return {
          data: {
            id: 2,
            name: 'West Plant',
            plant_type: 'processing',
            city: 'Chicago',
            state: 'IL',
            country: 'USA',
            booking_contact_email: '',
          },
        };
      }

      if (url === 'contacts/') {
        return { data: { results: [] } };
      }

      return { data: {} };
    });
  });

  it('swaps into the static hardcoded plant form when edit is clicked', async () => {
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

    expect(await screen.findByRole('heading', { name: /edit plant/i })).toBeInTheDocument();
    expect(screen.getByText(/Static business-continuity form/i)).toBeInTheDocument();
    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
  });
});
