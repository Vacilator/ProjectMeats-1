import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import Plants from './Plants';

const apiGetMock = vi.hoisted(() => vi.fn());
const entityFormSurfaceMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/utils/logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock('@/utils/uiDialogs', () => ({
  confirmDialog: vi.fn(),
}));

vi.mock('../../services/apiService', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
    delete: vi.fn(),
  },
}));

vi.mock('../../components/Shared/EntityFormSurface', () => ({
  default: (props: Record<string, unknown>) => entityFormSurfaceMock(props),
}));

describe('Plants create modal wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiGetMock.mockImplementation(async (url: string) => {
      if (url === 'plants/' || url === 'suppliers/') {
        return { data: { results: [] } };
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    entityFormSurfaceMock.mockImplementation(
      (props: { isOpen?: boolean; initialValues?: unknown }) =>
        props.isOpen ? (
          <div data-testid="entity-form-surface">{JSON.stringify(props.initialValues ?? {})}</div>
        ) : null
    );
  });

  it('opens the supplier-scoped Add Plant modal with stable modal props', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/7186/plants']}>
        <Routes>
          <Route path="/suppliers/:supplierId/plants" element={<Plants />} />
        </Routes>
      </MemoryRouter>
    );

    await user.click(await screen.findByRole('button', { name: /add plant/i }));

    expect(await screen.findByTestId('entity-form-surface')).toBeInTheDocument();

    const latestProps = entityFormSurfaceMock.mock.calls.at(-1)?.[0] as
      | {
          entityType?: string;
          mode?: string;
          variant?: string;
          isOpen?: boolean;
          initialValues?: Record<string, unknown>;
        }
      | undefined;

    expect(latestProps).toMatchObject({
      entityType: 'plant',
      mode: 'create',
      variant: 'modal',
      isOpen: true,
      initialValues: {
        supplier: '7186',
        plant_type: 'processing',
        country: 'USA',
      },
    });
  });
});
