import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

import Plants from './Plants';

const apiGet = vi.fn();
const entityFormSurfaceMock = vi.fn(
  ({
    entityType,
    mode,
    isOpen,
  }: {
    entityType: string;
    mode: string;
    isOpen?: boolean;
  }) =>
    isOpen ? <div data-testid="entity-form-surface">{entityType}:{mode}</div> : null
);

vi.mock('../../components/Shared/EntityFormSurface', () => ({
  default: (props: { entityType: string; mode: string; isOpen?: boolean }) =>
    entityFormSurfaceMock(props),
}));

vi.mock('../../services/apiService', () => ({
  apiClient: {
    get: (url: string, config?: unknown) => apiGet(url, config),
    delete: vi.fn(),
  },
}));

vi.mock('@/utils/uiDialogs', () => ({
  confirmDialog: vi.fn(),
}));

const SupplierPlantRouteProbe: React.FC = () => {
  const location = useLocation();
  const startEditing = Boolean(
    (location.state as { startEditing?: boolean } | null)?.startEditing
  );

  return (
    <div data-testid="supplier-plant-route">
      editing:{String(startEditing)}
    </div>
  );
};

describe('Supplier plants edit routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiGet.mockImplementation(async (url: string) => {
      if (url === 'suppliers/') {
        return { data: { results: [{ id: 1, name: 'Supplier One' }] } };
      }

      if (url === 'plants/') {
        return {
          data: {
            results: [
              {
                id: 2,
                name: 'Plant Two',
                supplier: 1,
                supplier_name: 'Supplier One',
                plant_type: 'processing',
              },
            ],
          },
        };
      }

      return { data: { results: [] } };
    });
  });

  it('routes the list edit button to the safe supplier detail edit path', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants" element={<Plants />} />
          <Route
            path="/suppliers/:supplierId/plants/:plantId"
            element={<SupplierPlantRouteProbe />}
          />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Plant Two');
    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(await screen.findByTestId('supplier-plant-route')).toHaveTextContent('editing:true');
  });

  it('keeps add plant on the create modal surface', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/1/plants']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants" element={<Plants />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Plant Two');
    await user.click(screen.getByRole('button', { name: /add plant/i }));

    expect(await screen.findByTestId('entity-form-surface')).toHaveTextContent('plant:create');
  });
});
