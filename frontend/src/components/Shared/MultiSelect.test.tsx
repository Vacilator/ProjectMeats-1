import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MultiSelect from './MultiSelect';

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

describe('MultiSelect', () => {
  it('renders selected count and error text', () => {
    render(
      <MultiSelect
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
});
