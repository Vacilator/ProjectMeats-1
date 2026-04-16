import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

import SearchableSelect from './SearchableSelect';

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        textPrimary: 'rgb(0,0,0)',
        primary: 'rgb(59,130,246)',
        danger: 'rgb(239,68,68)',
      },
    },
  }),
}));

describe('SearchableSelect (consolidated variants)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders multi variant via variant prop', () => {
    render(
      <SearchableSelect
        variant="multi"
        label="Industries"
        value={['a', 'b']}
        onChange={() => {}}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        error="Required"
      />
    );

    expect(screen.getByText('2 items selected')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('renders local variant via variant prop and filters with debounce', async () => {
    vi.useFakeTimers();

    render(
      <SearchableSelect
        variant="local"
        label="Customer"
        value={''}
        onChange={() => {}}
        options={[
          { id: 1, name: 'Beef Co' },
          { id: 2, name: 'Pork LLC' },
        ]}
      />
    );

    const input = screen.getByRole('textbox');
    fireEvent.click(input);

    fireEvent.change(input, { target: { value: 'por' } });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.queryByText('Beef Co')).not.toBeInTheDocument();
    expect(screen.getByText('Pork LLC')).toBeInTheDocument();
  });
});
