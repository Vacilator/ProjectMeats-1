import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectivityMock = vi.hoisted(() => ({
  useConnectivity: vi.fn(),
}));

vi.mock('../../contexts/ConnectivityContext', () => ({
  useConnectivity: connectivityMock.useConnectivity,
}));

vi.mock('../../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#f8f9fa',
        surface: '#ffffff',
        borderLight: '#e5e5e5',
        error: 'rgb(239, 68, 68)',
        warning: 'rgb(234, 179, 8)',
      },
    },
  }),
}));

import { ConnectivityBanner } from './ConnectivityBanner';

describe('ConnectivityBanner', () => {
  beforeEach(() => {
    connectivityMock.useConnectivity.mockReturnValue({
      status: 'online',
      isOnline: true,
      lastChangedAt: null,
    });
  });

  it('does not render while online', () => {
    const { container } = render(<ConnectivityBanner />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders the offline banner copy', () => {
    connectivityMock.useConnectivity.mockReturnValue({
      status: 'offline',
      isOnline: false,
      lastChangedAt: Date.now(),
    });

    render(<ConnectivityBanner />);

    expect(screen.getByTestId('connectivity-banner')).toHaveTextContent("You're offline");
  });

  it('renders the reconnecting banner copy', () => {
    connectivityMock.useConnectivity.mockReturnValue({
      status: 'reconnecting',
      isOnline: false,
      lastChangedAt: Date.now(),
    });

    render(<ConnectivityBanner />);

    expect(screen.getByTestId('connectivity-banner')).toHaveTextContent('Reconnecting...');
  });
});
