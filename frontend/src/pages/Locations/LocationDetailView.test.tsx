import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiClientMock = vi.hoisted(() => ({
  get: vi.fn(),
}));

const entityFormSurfaceMock = vi.hoisted(() =>
  vi.fn((props: Record<string, unknown>) =>
    props.isOpen ? (
      <div
        data-testid="entity-form-surface"
        data-entity-type={String(props.entityType || '')}
        data-mode={String(props.mode || '')}
        data-variant={String(props.variant || '')}
        data-entity-id={String(props.entityId || '')}
      />
    ) : null
  )
);

vi.mock('@/services/apiService', () => ({
  apiClient: apiClientMock,
}));

vi.mock('@/components/Cockpit', () => ({
  AIOverviewCard: () => <div data-testid="ai-overview-card" />,
  EntityProfileHeader: () => <div data-testid="entity-profile-header" />,
}));

vi.mock('@/components/Shared', () => ({
  EntityFormSurface: entityFormSurfaceMock,
}));

import LocationDetailView from './LocationDetailView';

describe('LocationDetailView', () => {
  beforeEach(() => {
    apiClientMock.get.mockReset();
    entityFormSurfaceMock.mockClear();
  });

  it('uses the record header and opens location edit in a modal surface', async () => {
    apiClientMock.get.mockImplementation((url: string) => {
      if (url === 'contacts/') {
        return Promise.resolve({
          data: {
            results: [],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(
      <MemoryRouter initialEntries={['/locations/123']}>
        <Routes>
          <Route path="/locations/:id" element={<LocationDetailView />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('entity-profile-header')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('entity-form-surface')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Location' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Location' }));

    await waitFor(() => {
      expect(screen.getByTestId('entity-form-surface')).toBeInTheDocument();
    });

    const formSurface = screen.getByTestId('entity-form-surface');
    expect(formSurface.getAttribute('data-entity-type')).toBe('location');
    expect(formSurface.getAttribute('data-mode')).toBe('edit');
    expect(formSurface.getAttribute('data-variant')).toBe('modal');
    expect(formSurface.getAttribute('data-entity-id')).toBe('123');
  });
});
