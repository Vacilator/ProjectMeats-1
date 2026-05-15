import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import LocalSearchableSelect from './LocalSearchableSelect';

describe('LocalSearchableSelect', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters options locally with debounce', async () => {
    vi.useFakeTimers();

    const onChange = vi.fn();

    render(
      <LocalSearchableSelect
        label="Customer"
        value={''}
        onChange={onChange}
        options={[
          { id: 1, name: 'Beef Co' },
          { id: 2, name: 'Pork LLC' },
        ]}
        placeholder="Select Customer"
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.click(input);

    // Type query
    fireEvent.change(input, { target: { value: 'por' } });

    // Debounce is 180ms
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    // With fake timers enabled, avoid waitFor (it uses timers internally).
    // After advancing the debounce, the filtered list should be updated.
    expect(screen.queryByText('Beef Co')).not.toBeInTheDocument();
    expect(screen.getByText('Pork LLC')).toBeInTheDocument();
  });

  it('selects an item by click and calls onChange', async () => {
    vi.useFakeTimers();

    const onChange = vi.fn();

    render(
      <LocalSearchableSelect
        label="Customer"
        value={''}
        onChange={onChange}
        options={[
          { id: 1, name: 'Beef Co' },
          { id: 2, name: 'Pork LLC' },
        ]}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.click(input);

    // Initial mount sets a short "Typing..." debounce; advance it so options render.
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    fireEvent.click(screen.getByText('Pork LLC'));

    expect(onChange).toHaveBeenCalledWith(2, expect.objectContaining({ id: 2, name: 'Pork LLC' }));
  });
});
