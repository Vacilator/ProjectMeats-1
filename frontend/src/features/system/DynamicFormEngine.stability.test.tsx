import React, { useEffect, useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DynamicFormEngine from './DynamicFormEngine';

vi.mock('../../services/configService', () => ({
  resolveConfig: vi.fn(async (_key: string, fallback: unknown) => ({ value: fallback })),
}));

describe('DynamicFormEngine stability', () => {
  it('does not hit maximum update depth when schema/initialValues objects are rebuilt', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    const Parent: React.FC = () => {
      const [tick, setTick] = useState(0);

      useEffect(() => {
        if (tick >= 10) return;
        setTick((prev) => prev + 1);
      }, [tick]);

      // Recreate objects each render to simulate parent rebuilds.
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

    // Ensure the form is interactive and can be submitted.
    expect(screen.getByRole('checkbox', { name: 'Export Approved' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit|save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      export_approved: false,
      export_documents_handled: '',
    });
  });

  it('applies async-loaded initial values after a keyed remount without looping', async () => {
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

      const initialValues = loaded ? { name: 'North Fabrication Plant' } : {};

      return (
        <DynamicFormEngine
          key={loaded ? 'loaded' : 'loading'}
          schema={schema as any}
          initialValues={initialValues}
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
});
