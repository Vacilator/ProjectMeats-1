import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DynamicFormEngine from './DynamicFormEngine';

describe('DynamicFormEngine stability', () => {
  it('does not hit maximum update depth when schema and initialValues objects are rebuilt', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const Parent: React.FC = () => {
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick >= 10) return;
        setTick((prev) => prev + 1);
      }, [tick]);

      const schema = {
        step_index: 0,
        name: 'Plant Profile',
        fields: [
          {
            key: 'export_approved',
            label: 'Export Approved',
            type: 'checkbox',
            required: false,
          },
          {
            key: 'export_documents_handled',
            label: 'Export Documents Handled',
            type: 'text',
            required: false,
            ui: {
              visible_when: {
                field: 'export_approved',
                equals: true,
              },
            },
          },
        ],
      };

      const initialValues = {
        export_approved: false,
        export_documents_handled: 'LOG (Letter of Guarantee)',
      };

      return <DynamicFormEngine schema={schema as any} initialValues={initialValues} onSubmit={onSubmit} />;
    };

    render(<Parent />);

    expect(screen.getByRole('checkbox', { name: 'Export Approved' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /submit|save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      export_approved: false,
      export_documents_handled: '',
    });
  });

  it('applies keyed remount initial values without looping', async () => {
    const onSubmit = vi.fn();

    const Parent: React.FC = () => {
      const [loaded, setLoaded] = useState(false);
      const [tick, setTick] = useState(0);

      useEffect(() => {
        setLoaded(true);
      }, []);

      useEffect(() => {
        if (!loaded || tick >= 6) return;
        setTick((prev) => prev + 1);
      }, [loaded, tick]);

      const schema = {
        step_index: 0,
        name: 'Plant Profile',
        fields: [
          {
            key: 'name',
            label: 'Plant Name',
            type: 'text',
            required: true,
          },
        ],
      };

      return (
        <DynamicFormEngine
          key={loaded ? 'loaded' : 'loading'}
          schema={schema as any}
          initialValues={loaded ? { name: 'North Fabrication Plant' } : {}}
          onSubmit={onSubmit}
          submitLabel="Save"
        />
      );
    };

    render(<Parent />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('North Fabrication Plant')).toBeInTheDocument();
    });
  });

  it('hydrates dotted-path initial values and submits nested objects', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DynamicFormEngine
        schema={{
          step_index: 0,
          name: 'Sales Order',
          fields: [
            {
              key: 'billing_address.city',
              label: 'Billing City',
              type: 'text',
              required: false,
            },
            {
              key: 'billing_address.state_zip',
              label: 'Billing State / ZIP',
              type: 'text',
              required: false,
            },
          ],
        }}
        initialValues={{
          billing_address: {
            city: 'Chicago',
            state_zip: 'IL 60601',
          },
        }}
        onSubmit={onSubmit}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Chicago')).toBeInTheDocument();
      expect(screen.getByDisplayValue('IL 60601')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /submit|save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      billing_address: {
        city: 'Chicago',
        state_zip: 'IL 60601',
      },
    });
  });

  it('filters cascading options in memory from preloaded dropdown dictionaries', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DynamicFormEngine
        schema={{
          step_index: 0,
          name: 'Plant Profile',
          fields: [
            {
              key: 'protein_types',
              label: 'Protein Types',
              type: 'select',
              options: [{ value: 'Beef', label: 'Beef' }],
              ui: {
                widget: 'multi_select',
              },
            },
            {
              key: 'master_products',
              label: 'Master Products',
              type: 'select',
              dependencies: ['protein_types'],
              ui: {
                widget: 'multi_select',
                data_source: {
                  type: 'master_products',
                },
              },
            },
          ],
        }}
        initialValues={{
          protein_types: ['Beef'],
          master_products: ['1', '2'],
        }}
        dropdownOptions={{
          master_products: [
            {
              value: '1',
              label: 'Beef Brisket',
              metadata: { protein_types: ['Beef'] },
            },
            {
              value: '2',
              label: 'Chicken Breast',
              metadata: { protein_types: ['Chicken'] },
            },
          ],
        }}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('button', { name: /submit|save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      protein_types: ['Beef'],
      master_products: ['1'],
    });
  });
});
