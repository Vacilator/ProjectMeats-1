import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SearchableSelect from './SearchableSelect';

const searchOptionsMock = vi.fn();

vi.mock('../../services/quickActionsService', () => ({
  entityOptionsService: {
    searchOptions: (...args: any[]) => searchOptionsMock(...args),
  },
}));

// Avoid pulling in the real modal implementation in unit tests.
const quickCreateModalPropsSpy = vi.fn();

vi.mock('../FormSubmission/QuickCreateModal', () => ({
  default: (props: any) => {
    quickCreateModalPropsSpy(props);
    return null;
  },
}));

describe('SearchableSelect', () => {
  beforeEach(() => {
    searchOptionsMock.mockReset();
    quickCreateModalPropsSpy.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('selects from provided initialOptions (no API call required)', async () => {
    const onChange = vi.fn();

    render(
      <SearchableSelect
        entityType="customer"
        value=""
        onChange={onChange}
        initialOptions={[
          { value: '1', label: 'Alpha' },
          { value: '2', label: 'Beta' },
        ]}
        allowCreate={false}
      />
    );

    expect(searchOptionsMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button'));

    await screen.findByRole('listbox');
    fireEvent.click(screen.getByRole('option', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith('2');
  });

  it('loads options via API when opened (search mode) and supports debounced search', async () => {
    const onChange = vi.fn();
    searchOptionsMock
      .mockResolvedValueOnce({
        entity_type: 'customer',
        entity_label: 'Customer',
        options: [
          { value: '1', label: 'Beef Co' },
          { value: '2', label: 'Pork LLC' },
        ],
        count: 2,
        can_create: true,
        total_count: 2,
        has_more: false,
      })
      .mockResolvedValueOnce({
        entity_type: 'customer',
        entity_label: 'Customer',
        options: [{ value: '2', label: 'Pork LLC' }],
        count: 1,
        can_create: true,
        total_count: 1,
        has_more: false,
      });

    render(
      <SearchableSelect
        entityType="customer"
        value=""
        onChange={onChange}
        forceSearch
        debounceMs={0}
        allowCreate={false}
        // Provide an initial option so the component doesn't auto-fetch on mount.
        initialOptions={[{ value: '0', label: 'Initial' }]}
      />
    );

    fireEvent.click(screen.getByRole('button'));

    // Initial load
    await waitFor(() => {
      expect(searchOptionsMock).toHaveBeenCalledWith('customer', '', expect.any(String), undefined);
    });

    // Search input exists in search mode
    const search = await screen.findByRole('textbox', { name: 'Search options' });
    fireEvent.change(search, { target: { value: 'por' } });

    // Immediate debounceMs=0 still schedules via setTimeout(0), so wait for the call.
    await waitFor(() => {
      expect(searchOptionsMock).toHaveBeenCalledWith('customer', 'por', expect.any(String), undefined);
    });

    // Option renders
    expect(await screen.findByRole('option', { name: 'Pork LLC' })).toBeInTheDocument();
  });

  it('supports keyboard navigation (ArrowDown + Enter selects highlighted option)', async () => {
    const onChange = vi.fn();

    render(
      <SearchableSelect
        entityType="customer"
        value=""
        onChange={onChange}
        initialOptions={[
          { value: '1', label: 'Alpha' },
          { value: '2', label: 'Beta' },
        ]}
        allowCreate={false}
      />
    );

    const trigger = screen.getByRole('button');
    fireEvent.keyDown(trigger, { key: 'Enter' });

    await screen.findByRole('listbox');

    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('1');
  });

  it('closes on outside click and calls onBlur', async () => {
    const onBlur = vi.fn();

    render(
      <SearchableSelect
        entityType="customer"
        value=""
        onChange={() => {}}
        onBlur={onBlur}
        initialOptions={[{ value: '1', label: 'Alpha' }]}
        allowCreate={false}
      />
    );

    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByRole('option', { name: 'Alpha' })).toBeInTheDocument();

    fireEvent.mouseDown(document.body);

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: 'Alpha' })).not.toBeInTheDocument();
    });

    expect(onBlur).toHaveBeenCalled();
  });

  it('opens QuickCreateModal when selecting the create sentinel and wires onCreated to onChange', async () => {
    const onChange = vi.fn();

    searchOptionsMock.mockResolvedValue({
      entity_type: 'customer',
      entity_label: 'Customer',
      options: [{ value: '3', label: 'Gamma' }],
      count: 1,
      can_create: true,
      total_count: 1,
      has_more: false,
    });

    render(
      <SearchableSelect
        entityType="customer"
        value=""
        onChange={onChange}
        initialOptions={[{ value: '1', label: 'Alpha' }]}
        allowCreate
      />
    );

    fireEvent.click(screen.getByRole('button'));

    const createOption = await screen.findByRole('option', { name: '+ Add new customer' });
    fireEvent.click(createOption);

    expect(onChange).not.toHaveBeenCalled();

    // Our QuickCreateModal mock captures props; assert it was opened.
    expect(quickCreateModalPropsSpy).toHaveBeenCalled();
    const lastCall = quickCreateModalPropsSpy.mock.calls.at(-1);
    const modalProps = lastCall?.[0];
    expect(modalProps?.isOpen).toBe(true);

    // Simulate successful creation (triggers internal state updates)
    await act(async () => {
      modalProps.onCreated({ value: '3', label: 'Gamma' });
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('3');
    });
  });
});
