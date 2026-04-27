import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DynamicFormEngine from './DynamicFormEngine';

vi.mock('../../services/configService', () => ({
  resolveConfig: vi.fn(async (_key: string, fallback: unknown) => ({ value: fallback })),
}));

describe('DynamicFormEngine visible_when', () => {
  it('clears hidden field values when visible_when becomes false', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <DynamicFormEngine
        schema={{
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
        }}
        initialValues={{
          export_approved: true,
          export_documents_handled: 'LOG (Letter of Guarantee)',
        }}
        onSubmit={onSubmit}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: 'Export Approved' }));
    await user.click(screen.getByRole('button', { name: /submit|save/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));

    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      export_approved: false,
      export_documents_handled: '',
    });
  });
});
