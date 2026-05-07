import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
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
import { withTenantQueryKey } from '@/utils/queryKeys';

const FK_BATCH_SIGNATURE = JSON.stringify([
  { fieldKey: 'customer', relatedEntity: 'customers.Customer' },
]);

describe('EntityFormSurface', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    businessApiMock.options.mockReset();
    formLifecycle.mounts = 0;
    formLifecycle.unmounts = 0;
    formLifecycle.props.length = 0;
  });

  const createQueryClient = () =>
    new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
  const renderWithQueryClient = (ui: React.ReactElement, queryClient = createQueryClient()) => {

    return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  };

  it('waits for schema, record, and FK options before mounting the form once', async () => {
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

    expect(screen.queryByTestId('universal-entity-form')).not.toBeInTheDocument();
    expect(formLifecycle.mounts).toBe(0);

    await waitFor(() => {
      expect(screen.getByTestId('universal-entity-form')).toBeInTheDocument();
    });

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

    expect(businessApiMock.get).toHaveBeenCalledTimes(3);
    expect(formLifecycle.mounts).toBe(1);
    expect(formLifecycle.unmounts).toBe(0);
  });

  it('does not churn cached FK batch queries when parent rebuilds identical seed objects', async () => {
    const queryClient = createQueryClient();

    queryClient.setQueryData(withTenantQueryKey('entity-form-schema', 'plant'), {
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
    });
    queryClient.setQueryData(withTenantQueryKey('entity-form-record', 'plant', '2769'), {
      id: 2769,
      name: 'North Plant',
      customer: '123',
    });
    queryClient.setQueryData(
      withTenantQueryKey('entity-form-fk-options-batch', 'plant', FK_BATCH_SIGNATURE),
      {
        customer: [{ id: '123', name: 'Acme Foods' }],
      }
    );

    const Parent: React.FC = () => {
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick >= 6) return;
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

    renderWithQueryClient(<Parent />, queryClient);

    await waitFor(() => {
      expect(screen.getByTestId('universal-entity-form')).toBeInTheDocument();
    });

    expect(businessApiMock.get).not.toHaveBeenCalled();
    expect(formLifecycle.mounts).toBe(1);
    expect(formLifecycle.unmounts).toBe(0);

    const latest = formLifecycle.props.at(-1) as Record<string, unknown> | undefined;
    expect(
      (
        latest?.externalFkOptions as
          | Record<string, Array<{ id: string; name: string }>>
        | undefined
      )?.customer?.[0]?.name
    ).toBe('Acme Foods');
  });

  it('keeps modal form content unmounted until ready and tears it down on close', async () => {
    const queryClient = createQueryClient();

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

    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <EntityFormSurface
          entityType="plant"
          entityId="2769"
          mode="edit"
          variant="modal"
          isOpen
          onClose={() => {}}
          initialValues={{ export_approved: false }}
        />
      </QueryClientProvider>
    );

    expect(screen.queryByTestId('universal-entity-form')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('universal-entity-form')).toBeInTheDocument();
    });

    expect(formLifecycle.mounts).toBe(1);
    expect((formLifecycle.props.at(-1) as Record<string, unknown> | undefined)?.variant).toBe(
      'inline'
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <EntityFormSurface
          entityType="plant"
          entityId="2769"
          mode="edit"
          variant="modal"
          isOpen={false}
          onClose={() => {}}
          initialValues={{ export_approved: false }}
        />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('universal-entity-form')).not.toBeInTheDocument();
    });

    expect(formLifecycle.unmounts).toBe(1);
  });
});
