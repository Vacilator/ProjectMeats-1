import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { LegacyCommandCenterTabRedirect } from './LegacyCommandCenterTabRedirect';

const LocationProbe: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-display">{`${location.pathname}${location.search}`}</div>;
};

describe('LegacyCommandCenterTabRedirect', () => {
  it('redirects legacy action-required routes to Command Center while preserving search params', () => {
    render(
      <MemoryRouter initialEntries={['/process-cockpit/reviews?draft=draft-1&item=review-9']}>
        <Routes>
          <Route
            path="/process-cockpit/*"
            element={<LegacyCommandCenterTabRedirect tab="action-required" />}
          />
          <Route
            path="/command-center"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/command-center?draft=draft-1&item=review-9&tab=action-required',
    );
  });

  it('redirects legacy pipeline routes to the Command Center pipeline tab', () => {
    render(
      <MemoryRouter initialEntries={['/trader-cockpit/session/123?view=legacy']}>
        <Routes>
          <Route
            path="/trader-cockpit/*"
            element={<LegacyCommandCenterTabRedirect tab="pipeline" />}
          />
          <Route
            path="/command-center"
            element={<LocationProbe />}
          />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId('location-display')).toHaveTextContent(
      '/command-center?view=legacy&tab=pipeline',
    );
  });
});
