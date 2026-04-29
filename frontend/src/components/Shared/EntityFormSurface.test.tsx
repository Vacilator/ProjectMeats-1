import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  options: vi.fn(),
}));

const formLifecycle = vi.hoisted(() => ({
  mounts: 0,
  unmounts: 0,
  props: [] as Array<Record<string, unknown>>,
}));

vi.mock('../../services/businessApi', () => ({
  businessApi: businessApiMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuthState: () => ({ isAuthenticated: true, loading: false }),
}));

vi.mock('@/config/runtime', () => ({
  getRuntimeConfigBoolean: () => false,
}));

vi.mock('./UniversalEntityForm', async (importOriginal) => {
  const ReactModule = await import('react');
  const actual =
    await importOriginal<typeof import('./UniversalEntityForm')>();

  return {
    ...actual,
    __esModule: true,
    default: (props: Record<string, unknown>) => {
      formLifecycle.props.push(props);

      ReactModule.useEffect(() => {
        formLifecycle.mounts += 1;
        return () => {
          formLifecycle.unmounts += 1;
        };
      }, []);

      return <div data-testid="universal-entity-form" />;
    },
  };
});

import { EntityFormSurface } from './EntityFormSurface';

describe('EntityFormSurface', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    businessApiMock.options.mockReset();
    formLifecycle.mounts = 0;
    formLifecycle.unmounts = 0;
    formLifecycle.props.length = 0;
  });

  const renderWithQueryClient = (ui: React.ReactElement) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('preloads schema, record, and FK options once without remounting the form on query readiness', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === '/system/forms/schema/') {
        return Promise.resolve({
          data: {
            name: 'Plant',
            description: 'Plant schema',
            fields: [
              { key: 'name', label: 'Plant Name', type: 'text', required: true },
              {
                key: 'customer',
                label: 'Customer',
                type: 'foreign_key',
                related_entity: 'customers.Customer',
              },
            ],
          },
        });
      }

      if (url === 'plants/2769/') {
        return Promise.resolve({
          data: {
            id: 2769,
            name: 'North Plant',
            customer: '123',
          },
        });
      }

      if (url === 'customers/') {
        return Promise.resolve({
          data: {
            results: [{ id: '123', name: 'Acme Foods' }],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const Parent: React.FC = () => {
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick >= 4) return;
        setTick((prev) => prev + 1);
      }, [tick]);

      return (
        <EntityFormSurface
          entityType="plant"
          entityId="2769"
          mode="edit"
          variant="inline"
          isOpen
          onClose={() => {}}
          initialValues={{ export_approved: false }}
        />
      );
    };

    renderWithQueryClient(<Parent />);

    await waitFor(() => {
      expect(formLifecycle.props.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      const latest = formLifecycle.props.at(-1) as Record<string, unknown> | undefined;
      expect(latest?.externalLoading).toBe(false);
      expect((latest?.externalSchema as { name?: string } | undefined)?.name).toBe('Plant');
      expect((latest?.externalRecordValues as { name?: string } | undefined)?.name).toBe(
        'North Plant'
      );
      expect(
        (
          latest?.externalFkOptions as
            | Record<string, Array<{ id: string; name: string }>>
            | undefined
        )?.customer?.[0]?.name
      ).toBe('Acme Foods');
    });

    expect(businessApiMock.get).toHaveBeenCalledTimes(3);
    expect(formLifecycle.mounts).toBe(1);
    expect(formLifecycle.unmounts).toBe(0);
  });
});
