import React, { useEffect, useState } from 'react';
import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  options: vi.fn(),
}));

const capturedDynamicFormProps = vi.hoisted(
  () => [] as Array<{ schema: unknown; initialValues: unknown }>
);

vi.mock('../../services/businessApi', () => ({
  businessApi: businessApiMock,
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuthState: () => ({ isAuthenticated: true, loading: false }),
}));

vi.mock('../../features/system/DynamicFormEngine', () => ({
  default: (props: { schema: unknown; initialValues: unknown }) => {
    capturedDynamicFormProps.push({
      schema: props.schema,
      initialValues: props.initialValues,
    });

    return <div data-testid="dynamic-form-engine" />;
  },
}));

import { UniversalEntityForm } from './UniversalEntityForm';

describe('UniversalEntityForm stability', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    businessApiMock.options.mockReset();
    capturedDynamicFormProps.length = 0;
  });

  it('dedupes plant edit loads when parent rebuilds initialValues objects', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === '/system/forms/schema/') {
        return Promise.resolve({
          data: {
            name: 'Plant',
            description: 'Plant schema',
            fields: [
              { key: 'name', label: 'Plant Name', type: 'text', required: true },
              { key: 'export_approved', label: 'Export Approved', type: 'checkbox' },
            ],
          },
        });
      }

      if (url === 'plants/2769/') {
        return Promise.resolve({
          data: {
            id: 2769,
            name: 'North Plant',
            export_approved: false,
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
        <UniversalEntityForm
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

    render(<Parent />);

    await waitFor(() => {
      expect(capturedDynamicFormProps.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(businessApiMock.get).toHaveBeenCalledTimes(2);
    });

    expect(businessApiMock.get).toHaveBeenCalledWith('/system/forms/schema/', {
      params: { entity_type: 'plant' },
    });
    expect(businessApiMock.get).toHaveBeenCalledWith('plants/2769/');

    const latest = capturedDynamicFormProps.at(-1);
    expect(latest?.initialValues).toMatchObject({
      name: 'North Plant',
      export_approved: false,
    });
  });

  it('loads once when the form opens from a closed state', async () => {
    businessApiMock.get.mockImplementation((url: string) => {
      if (url === '/system/forms/schema/') {
        return Promise.resolve({
          data: {
            name: 'Plant',
            description: 'Plant schema',
            fields: [{ key: 'name', label: 'Plant Name', type: 'text', required: true }],
          },
        });
      }

      if (url === 'plants/2769/') {
        return Promise.resolve({
          data: {
            id: 2769,
            name: 'North Plant',
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    const Parent: React.FC = () => {
      const [isOpen, setIsOpen] = useState(false);

      useEffect(() => {
        setIsOpen(true);
      }, []);

      return (
        <UniversalEntityForm
          entityType="plant"
          entityId="2769"
          mode="edit"
          variant="inline"
          isOpen={isOpen}
          onClose={() => {}}
          initialValues={{}}
        />
      );
    };

    render(<Parent />);

    await waitFor(() => {
      expect(capturedDynamicFormProps.length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(businessApiMock.get).toHaveBeenCalledTimes(2);
    });
  });
});
