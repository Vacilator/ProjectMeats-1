import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { IngestionMonitor } from './IngestionMonitor';

describe('IngestionMonitor', () => {
  it('routes operators to the canonical process cockpit surface', async () => {
    render(
      <MemoryRouter>
        <IngestionMonitor />
      </MemoryRouter>,
    );

    expect(
      screen.getByText(/Email Ingestion now lives in Process Cockpit/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Open Process Cockpit/i })).toBeInTheDocument();
  });
});
