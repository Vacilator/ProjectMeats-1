import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

const capturedDynamicFormProps = vi.hoisted(
  () =>
    [] as Array<{
      schema: unknown;
      initialValues: unknown;
      dropdownOptions?: Record<string, Array<{ value: string; label: string }>>;
      formConfig?: Record<string, unknown>;
    }>
);

vi.mock('../../features/system/DynamicFormEngine', () => ({
  default: (props: {
    schema: unknown;
    initialValues: unknown;
    dropdownOptions?: Record<string, Array<{ value: string; label: string }>>;
    formConfig?: Record<string, unknown>;
  }) => {
    capturedDynamicFormProps.push({
      schema: props.schema,
      initialValues: props.initialValues,
      dropdownOptions: props.dropdownOptions,
      formConfig: props.formConfig,
    });

    return <div data-testid="dynamic-form-engine" />;
  },
}));

import { UniversalEntityForm } from './UniversalEntityForm';

describe('UniversalEntityForm stability', () => {
  beforeEach(() => {
    capturedDynamicFormProps.length = 0;
  });

  it('maps transactional snapshot fields into nested form state before mounting the renderer', () => {
    render(
      <UniversalEntityForm
        entityType="sales_order"
        variant="inline"
        mode="create"
        isOpen
        onClose={() => {}}
        onSubmit={vi.fn()}
        schema={{
          name: 'Sales Order',
          fields: [
            { key: 'billing_contact_name', label: 'Billing Name', type: 'text' },
            { key: 'billing_contact_email', label: 'Billing Email', type: 'text' },
            { key: 'billing_address_city', label: 'Billing City', type: 'text' },
            { key: 'billing_address_state_zip', label: 'Billing State / ZIP', type: 'text' },
          ],
        }}
        initialData={{
          billing_contact_name: 'Pat Buyer',
          billing_contact_email: 'ap@example.com',
          billing_address_city: 'Chicago',
          billing_address_state_zip: 'IL 60601',
        }}
      />
    );

    const latest = capturedDynamicFormProps.at(-1);
    expect(latest?.initialValues).toMatchObject({
      billing_contact: {
        name: 'Pat Buyer',
        email: 'ap@example.com',
      },
      billing_address: {
        city: 'Chicago',
        state_zip: 'IL 60601',
      },
    });
  });

  it('forwards preloaded dropdown dictionaries and form config to the dumb renderer', () => {
    render(
      <UniversalEntityForm
        entityType="plant"
        variant="inline"
        mode="edit"
        isOpen
        onClose={() => {}}
        onSubmit={vi.fn()}
        schema={{
          name: 'Plant',
          fields: [{ key: 'master_products', label: 'Master Products', type: 'select' }],
        }}
        initialData={{}}
        dropdownOptions={{
          master_products: [{ value: '1', label: 'Brisket' }],
        }}
        formConfig={{
          submitButtonText: 'Save',
          validateOnChange: true,
        }}
      />
    );

    const latest = capturedDynamicFormProps.at(-1);
    expect(latest?.dropdownOptions?.master_products?.[0]).toEqual({
      value: '1',
      label: 'Brisket',
    });
    expect(latest?.formConfig).toMatchObject({
      submitButtonText: 'Save',
      validateOnChange: true,
    });
  });

  it('renders the autofill toolbar from loader-provided callbacks instead of owning async state', async () => {
    const user = userEvent.setup();
    const onExtract = vi.fn();
    const onUpload = vi.fn();
    const onDocumentChange = vi.fn();

    render(
      <UniversalEntityForm
        entityType="sales_order"
        variant="inline"
        mode="create"
        isOpen
        onClose={() => {}}
        onSubmit={vi.fn()}
        schema={{
          name: 'Sales Order',
          fields: [{ key: 'order_number', label: 'Order Number', type: 'text' }],
        }}
        initialData={{}}
        autofill={{
          documents: [{ id: 'doc-1', original_filename: 'sales-order.pdf' }],
          selectedDocumentId: 'doc-1',
          onDocumentChange,
          onExtract,
          onUpload,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: /autofill from document/i }));
    expect(onExtract).toHaveBeenCalledTimes(1);
  });
});
