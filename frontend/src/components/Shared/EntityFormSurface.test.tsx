import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  options: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

const authState = vi.hoisted(() => ({
  isAuthenticated: true,
  loading: false,
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
  useAuthState: () => authState,
}));

vi.mock('@/config/runtime', () => ({
  getRuntimeConfigBoolean: () => false,
}));

vi.mock('../../services/configService', () => ({
  resolveConfig: vi.fn(async (_key: string, fallback: unknown) => ({ value: fallback })),
}));

vi.mock('./UniversalEntityForm', async (importOriginal) => {
  const ReactModule = await import('react');
  const actual =
    await importOriginal<typeof import('./UniversalEntityForm')>();

  return {
    ...actual,
    __esModule: true,
    default: function MockUniversalEntityForm(props: Record<string, unknown>) {
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
    authState.isAuthenticated = true;
    authState.loading = false;
    businessApiMock.get.mockReset();
    businessApiMock.options.mockReset();
    businessApiMock.patch.mockReset();
    businessApiMock.post.mockReset();
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

  it('preloads schema, record, and dropdown dictionaries at the smart-loader boundary', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === '/system/forms/schema/') {
        return Promise.resolve({
          data: {
            name: 'Plant',
            description: 'Plant schema',
            fields: [
              { key: 'name', label: 'Plant Name', type: 'text', required: true },
              {
                key: 'payment_terms',
                label: 'Payment Terms',
                type: 'select',
                ui: {
                  data_source: {
                    type: 'choice_list',
                    list: 'payment_terms',
                  },
                },
              },
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
            payment_terms: 'Wire',
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

      if (url === '/master-products/') {
        return Promise.resolve({
          data: {
            results: [],
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

    expect(screen.getByTestId('entity-form-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('universal-entity-form')).not.toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('universal-entity-form')).toBeInTheDocument();
    });

    const latest = formLifecycle.props.at(-1) as Record<string, unknown> | undefined;
    expect((latest?.schema as { name?: string } | undefined)?.name).toBe('Plant');
    expect((latest?.initialData as { name?: string; customer?: string } | undefined)?.name).toBe(
      'North Plant'
    );

    expect(businessApiMock.get).toHaveBeenCalledWith('/system/forms/schema/', {
      params: { entity_type: 'plant' },
    });
    expect(businessApiMock.get).toHaveBeenCalledWith('plants/2769/');
    expect(businessApiMock.get.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(formLifecycle.mounts).toBe(1);
    expect(formLifecycle.unmounts).toBe(0);
  });

  it('does not churn cached resource queries when parent rebuilds identical seed objects', async () => {
    const queryClient = createQueryClient();
    const schema = {
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
    };

    queryClient.setQueryData(['entity-form-schema', 'plant'], schema);
    queryClient.setQueryData(['entity-form-record', 'plant', '2769'], {
      id: 2769,
      name: 'North Plant',
      customer: '123',
    });
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === 'customers/') {
        return Promise.resolve({
          data: {
            results: [{ id: '123', name: 'Acme Foods' }],
          },
        });
      }

      if (url === '/master-products/') {
        return Promise.resolve({
          data: {
            results: [],
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

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

    expect(businessApiMock.get).toHaveBeenCalledTimes(2);
    expect(formLifecycle.mounts).toBe(1);
    expect(formLifecycle.unmounts).toBe(0);

    const latest = formLifecycle.props.at(-1) as Record<string, unknown> | undefined;
    expect((latest?.schema as { name?: string } | undefined)?.name).toBe('Plant');
    expect(
      (
        latest?.dropdownOptions as
          | Record<string, Array<{ value: string; label: string }>>
          | undefined
      )?.customer?.[0]?.label
    ).toBe('Acme Foods');
  });

  it('does not attempt protected loads when unauthenticated', async () => {
    authState.isAuthenticated = false;

    renderWithQueryClient(
      <EntityFormSurface
        entityType="plant"
        entityId="2769"
        mode="edit"
        variant="inline"
        isOpen
        onClose={() => {}}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('entity-form-load-error')).toBeInTheDocument();
    });

    expect(businessApiMock.get).not.toHaveBeenCalled();
    expect(screen.queryByTestId('universal-entity-form')).not.toBeInTheDocument();
  });
});
