import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

const capturedDynamicFormProps = vi.hoisted(
  () =>
    [] as Array<{
      schema: unknown;
      initialValues: unknown;
      dropdownOptions?: Record<string, Array<{ value: string; label: string; metadata?: Record<string, unknown> }>>;
      formConfig?: Record<string, unknown>;
    }>
);

vi.mock('../../features/system/DynamicFormEngine', () => ({
  default: (props: {
    schema: unknown;
    initialValues: unknown;
    dropdownOptions?: Record<string, Array<{ value: string; label: string; metadata?: Record<string, unknown> }>>;
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

const businessApiGet = vi.hoisted(() => vi.fn(async () => ({ data: { results: [] } })));

vi.mock('../../services/businessApi', () => ({
  businessApi: {
    get: businessApiGet,
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

import { augmentSchemaForFrontend, UniversalEntityForm } from './UniversalEntityForm';

describe('UniversalEntityForm stability', () => {
  beforeEach(() => {
    capturedDynamicFormProps.length = 0;
    businessApiGet.mockReset();
    businessApiGet.mockResolvedValue({ data: { results: [] } });
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

  it('prioritizes plant contact type and department-driven fields for plant contacts', () => {
    const augmented = augmentSchemaForFrontend(
      'contact',
      {
        name: 'Contact',
        fields: [
          {
            key: 'department',
            label: 'Department',
            type: 'select',
            choices: [
              { value: 'sales', label: 'Sales' },
              { value: 'qa', label: 'Quality Assurance' },
              { value: 'shipping', label: 'Shipping / Loadout' },
              { value: 'certification', label: 'Certification' },
              { value: 'accounting', label: 'Accounting' },
              { value: 'booking', label: 'Booking (Deprecated)' },
            ],
          },
          { key: 'contact_type', label: 'Contact Type', type: 'select' },
          { key: 'first_name', label: 'First Name', type: 'text' },
          { key: 'last_name', label: 'Last Name', type: 'text' },
          { key: 'email', label: 'Email', type: 'email' },
          { key: 'position', label: 'Position', type: 'text' },
          { key: 'mobile_phone', label: 'Mobile Phone', type: 'text' },
          { key: 'office_phone', label: 'Office Phone', type: 'text' },
          { key: 'office_phone_ext', label: 'Office Ext', type: 'text' },
          { key: 'protein_types_responsible', label: 'Protein Types Responsible For', type: 'select' },
          { key: 'items_responsible', label: 'Items Responsible For', type: 'select' },
          { key: 'documents_responsible_for', label: 'Documents Responsible For', type: 'select' },
          { key: 'notes', label: 'Notes', type: 'textarea' },
        ],
      },
      { plant: '2', supplier: '1' }
    );

    const departmentField = augmented?.fields.find((field) => field.key === 'department');
    const contactTypeField = augmented?.fields.find((field) => field.key === 'contact_type');
    const shippingTitleField = augmented?.fields.find((field) => field.key === 'shipping_loadout_title');
    const proteinField = augmented?.fields.find((field) => field.key === 'protein_types_responsible');
    const itemsField = augmented?.fields.find((field) => field.key === 'items_responsible');
    const documentsField = augmented?.fields.find((field) => field.key === 'documents_responsible_for');

    expect(augmented?.key_fields?.slice(0, 5)).toEqual([
      'department',
      'first_name',
      'last_name',
      'email',
      'mobile_phone',
    ]);
    expect(departmentField).toMatchObject({
      label: 'Plant Contact Type',
      required: true,
      help_text: 'Department this contact belongs to',
    });
    expect(departmentField?.choices).toEqual([
      { value: 'sales', label: 'Sales' },
      { value: 'qa', label: 'QA' },
      { value: 'shipping', label: 'Shipping / Loadout' },
      { value: 'certification', label: 'Certification' },
      { value: 'accounting', label: 'Accounting' },
    ]);
    expect(contactTypeField).toBeUndefined();
    expect(shippingTitleField).toMatchObject({
      api_key: 'position',
      label: 'Title',
      choices: [
        { value: 'Shipping Supervisor', label: 'Shipping Supervisor' },
        { value: 'Load Coordinator', label: 'Load Coordinator' },
        { value: 'Billing', label: 'Billing' },
        { value: 'Prepay / Frozen Shipping', label: 'Prepay / Frozen Shipping' },
        { value: 'DC Shipping', label: 'DC Shipping' },
      ],
      ui: {
        widget: 'select',
        visible_when: {
          field: 'department',
          equals: 'shipping',
        },
      },
    });
    expect(proteinField?.ui).toMatchObject({
      visible_when: {
        field: 'department',
        in: ['sales', 'qa'],
      },
    });
    expect(itemsField?.ui).toMatchObject({
      visible_when: {
        field: 'department',
        in: ['sales', 'qa'],
      },
    });
    expect(documentsField?.ui).toMatchObject({
      visible_when: {
        field: 'department',
        truthy: true,
      },
    });
    expect(
      (documentsField?.ui as { option_groups?: Record<string, Array<{ value: string; label: string }>> } | undefined)
        ?.option_groups?.certification
    ).toEqual(
      expect.arrayContaining([
        { value: 'COAs', label: 'COAs' },
        { value: 'Spec Sheets', label: 'Spec Sheets' },
        { value: 'Picture of Label', label: 'Picture of Label' },
        { value: 'Certification Documents', label: 'Certification Documents' },
      ])
    );
    expect(
      (documentsField?.ui as { option_groups?: Record<string, Array<{ value: string; label: string }>> } | undefined)
        ?.option_groups?.accounting
    ).toEqual(
      expect.arrayContaining([
        { value: 'Statements', label: 'Statements' },
        { value: 'Claims', label: 'Claims' },
        { value: 'Credits', label: 'Credits' },
        { value: 'Checks', label: 'Checks' },
        { value: 'Bills', label: 'Bills' },
      ])
    );
  });

  it('loads master-product options for responsibility multi-selects from the service layer', async () => {
    businessApiGet.mockImplementation(async (url: string) => {
      if (url === '/master-products/') {
        return {
          data: {
            results: [
              { id: 1, display_name: 'Beef Brisket', protein: 'Beef' },
              { id: 2, display_name: 'Chicken Breast', protein: 'Chicken' },
            ],
          },
        };
      }

      return { data: { results: [] } };
    });

    render(
      <UniversalEntityForm
        entityType="contact"
        variant="inline"
        mode="create"
        isOpen
        onClose={() => {}}
        onSubmit={vi.fn()}
        schema={{
          name: 'Contact',
          fields: [
            {
              key: 'department',
              label: 'Department',
              type: 'select',
              choices: [
                { value: 'sales', label: 'Sales' },
                { value: 'qa', label: 'QA' },
                { value: 'shipping', label: 'Shipping / Loadout' },
                { value: 'certification', label: 'Certification' },
                { value: 'accounting', label: 'Accounting' },
              ],
            },
            { key: 'first_name', label: 'First Name', type: 'text' },
            { key: 'last_name', label: 'Last Name', type: 'text' },
            { key: 'email', label: 'Email', type: 'email' },
            { key: 'protein_types_responsible', label: 'Protein Types Responsible For', type: 'select' },
            { key: 'items_responsible', label: 'Items Responsible For', type: 'select' },
            { key: 'documents_responsible_for', label: 'Documents Responsible For', type: 'select' },
          ],
        }}
        initialData={{
          supplier: '1',
          plant: '2',
          department: 'sales',
          items_responsible: ['Legacy Cut'],
        }}
      />
    );

    await waitFor(() =>
      expect(capturedDynamicFormProps.at(-1)?.dropdownOptions?.items_responsible).toEqual(
        expect.arrayContaining([
          { value: 'Legacy Cut', label: 'Legacy Cut' },
          {
            value: 'Beef Brisket',
            label: 'Beef Brisket',
            metadata: { protein_types: ['Beef'] },
          },
          {
            value: 'Chicken Breast',
            label: 'Chicken Breast',
            metadata: { protein_types: ['Chicken'] },
          },
        ])
      )
    );
    expect(businessApiGet).toHaveBeenCalledWith('/master-products/', {
      params: { page_size: 5000, limit: 5000, is_active: true },
    });
  });
});
