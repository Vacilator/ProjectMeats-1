import React, { useEffect, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

const businessApiMock = vi.hoisted(() => ({
  get: vi.fn(),
  options: vi.fn(),
}));

const capturedDynamicFormProps = vi.hoisted(
  () => [] as Array<{ schema: unknown; initialValues: unknown }>
);

const documentsApiMock = vi.hoisted(() => ({
  list: vi.fn(async () => []),
  upload: vi.fn(),
}));

const schemaExtractionApiMock = vi.hoisted(() => ({
  extractToSchema: vi.fn(),
}));

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

vi.mock('../../services/aiService', () => ({
  documentsApi: documentsApiMock,
  schemaExtractionApi: schemaExtractionApiMock,
}));

import { UniversalEntityForm } from './UniversalEntityForm';

describe('UniversalEntityForm stability', () => {
  beforeEach(() => {
    businessApiMock.get.mockReset();
    businessApiMock.options.mockReset();
    capturedDynamicFormProps.length = 0;
    documentsApiMock.list.mockReset();
    documentsApiMock.upload.mockReset();
    schemaExtractionApiMock.extractToSchema.mockReset();
    documentsApiMock.list.mockResolvedValue([]);
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

  it('normalizes transactional snapshot fields into nested form state and applies AI autofill drafts', async () => {
    const user = userEvent.setup();

    documentsApiMock.list.mockResolvedValue([
      { id: 'doc-1', original_filename: 'sales-order.pdf' },
    ]);
    schemaExtractionApiMock.extractToSchema.mockResolvedValue({
      document_id: 'doc-1',
      entity_type: 'sales_order',
      serializer_name: 'SalesOrderSerializer',
      parser: 'openai',
      model_name: 'AIDocument',
      warnings: [],
      extracted_data: {
        billing_contact_name: 'Pat Buyer',
        billing_contact_email: 'ap@example.com',
        billing_address_city: 'Chicago',
        billing_address_state_zip: 'IL 60601',
        items: [
          {
            protein_type: 'Beef',
            quantity: '12',
          },
        ],
      },
    });

    render(
      <UniversalEntityForm
        entityType="sales_order"
        variant="inline"
        mode="create"
        isOpen
        onClose={() => {}}
        externalSchema={{
          name: 'Sales Order',
          fields: [
            { key: 'billing_contact_name', label: 'Billing Name', type: 'text' },
            { key: 'billing_contact_email', label: 'Billing Email', type: 'text' },
            { key: 'billing_address_city', label: 'Billing City', type: 'text' },
            { key: 'billing_address_state_zip', label: 'Billing State / ZIP', type: 'text' },
          ],
        }}
        externalRecordValues={null}
        initialValues={{
          billing_contact_name: 'Existing Buyer',
          billing_address_city: 'Omaha',
        }}
      />
    );

    await waitFor(() => {
      expect(capturedDynamicFormProps.length).toBeGreaterThan(0);
    });

    const initial = capturedDynamicFormProps.at(-1);
    expect(initial?.initialValues).toMatchObject({
      billing_contact: {
        name: 'Existing Buyer',
      },
      billing_address: {
        city: 'Omaha',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /autofill from document/i })).toBeEnabled();
    });

    await user.click(screen.getByRole('button', { name: /autofill from document/i }));

    await waitFor(() => {
      expect(schemaExtractionApiMock.extractToSchema).toHaveBeenCalledWith({
        document_id: 'doc-1',
        entity_type: 'sales_order',
      });
    });

    await waitFor(() => {
      expect(capturedDynamicFormProps.at(-1)?.initialValues).toMatchObject({
        billing_contact: {
          name: 'Pat Buyer',
          email: 'ap@example.com',
        },
        billing_address: {
          city: 'Chicago',
          state_zip: 'IL 60601',
        },
        items: [
          {
            protein_type: 'Beef',
            quantity: '12',
          },
        ],
      });
    });

  });
});
