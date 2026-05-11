import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';

import { SHORTCUT_REGISTRY, useGlobalShortcuts } from './useGlobalShortcuts';

const noop = vi.fn();

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}</div>;
};

const Harness: React.FC = () => {
  useGlobalShortcuts({
    onOpenCommandPalette: noop,
    onToggleAIAgentWidget: noop,
    onOpenOmnibox: noop,
    onShowCheatsheet: noop,
  });

  return <LocationProbe />;
};

describe('useGlobalShortcuts', () => {
  it('maps g d to Command Center', async () => {
    render(
      <MemoryRouter initialEntries={['/customers']}>
        <Routes>
          <Route path="*" element={<Harness />} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.keyDown(document, { key: 'g' });
    fireEvent.keyDown(document, { key: 'd' });

    await waitFor(() => {
      expect(screen.getByTestId('location-probe')).toHaveTextContent('/command-center');
    });
  });

  it('documents g d as Command Center in the shortcut registry', () => {
    expect(SHORTCUT_REGISTRY.find((shortcut) => shortcut.keys === 'g d')?.label).toBe('Go to Command Center');
  });
});
