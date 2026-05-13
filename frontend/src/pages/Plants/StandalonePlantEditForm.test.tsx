import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { message } from 'antd';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { businessApi } from '@/services/businessApi';

import StandalonePlantEditForm from './StandalonePlantEditForm';

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockedBusinessApi = vi.mocked(businessApi);

const PLANT_DATA = {
  id: 2,
  name: 'West Plant',
  plant_est_num: 'EST-22',
  plant_type: 'processing',
  address: '123 Market St',
  city: 'Chicago',
  state: 'IL',
  zip_code: '60601',
  country: 'USA',
  booking_contact_email: 'booking@example.com',
  booking_contact_phone: '555-0100',
  booking_contact_phone_type: 'office',
  capacity: 250,
  export_approved: true,
  is_active: true,
  fcfs: false,
  created_at: '2026-05-06T12:00:00Z',
  updated_at: '2026-05-06T13:00:00Z',
};

const renderForm = (props?: Partial<React.ComponentProps<typeof StandalonePlantEditForm>>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <StandalonePlantEditForm plantId="2" onCancel={vi.fn()} {...props} />
    </QueryClientProvider>
  );
};

describe('StandalonePlantEditForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(message, 'success').mockImplementation(() => undefined as never);
    vi.spyOn(message, 'error').mockImplementation(() => undefined as never);
    mockedBusinessApi.get.mockResolvedValue({ data: PLANT_DATA });
    mockedBusinessApi.patch.mockResolvedValue({
      data: { ...PLANT_DATA, name: 'Updated West Plant', updated_at: '2026-05-06T14:00:00Z' },
    });
  });

  it('loads plant data with a single query and submits updates through the plant service', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();

    renderForm({ onSaved });

    expect(mockedBusinessApi.get).toHaveBeenCalledWith('plants/2/');
    const nameInput = (await screen.findByDisplayValue('West Plant')) as HTMLInputElement;

    await user.clear(nameInput);
    await user.type(nameInput, 'Updated West Plant');
    await user.click(screen.getByRole('button', { name: /save plant/i }));

    await waitFor(() => {
      expect(mockedBusinessApi.patch).toHaveBeenCalledWith(
        'plants/2/',
        expect.objectContaining({
          name: 'Updated West Plant',
          plant_est_num: 'EST-22',
          is_active: true,
          plant_type: 'processing',
        })
      );
    });

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 2,
          name: 'Updated West Plant',
        })
      );
    });
  });
});
