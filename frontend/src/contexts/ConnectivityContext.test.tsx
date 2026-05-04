import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConnectivityProvider, useConnectivity } from './ConnectivityContext';

const setNavigatorOnline = (value: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
};

const ConnectivityProbe: React.FC = () => {
  const { status, isOnline } = useConnectivity();

  return (
    <div>
      <span data-testid="connectivity-status">{status}</span>
      <span data-testid="connectivity-is-online">{String(isOnline)}</span>
    </div>
  );
};

describe('ConnectivityProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setNavigatorOnline(true);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('starts online when the browser is connected', () => {
    render(
      <ConnectivityProvider>
        <ConnectivityProbe />
      </ConnectivityProvider>
    );

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('online');
    expect(screen.getByTestId('connectivity-is-online')).toHaveTextContent('true');
  });

  it('starts offline when the browser is disconnected', () => {
    setNavigatorOnline(false);

    render(
      <ConnectivityProvider>
        <ConnectivityProbe />
      </ConnectivityProvider>
    );

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('offline');
    expect(screen.getByTestId('connectivity-is-online')).toHaveTextContent('false');
  });

  it('transitions through reconnecting before returning online', () => {
    render(
      <ConnectivityProvider>
        <ConnectivityProbe />
      </ConnectivityProvider>
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('offline');

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('reconnecting');
    expect(screen.getByTestId('connectivity-is-online')).toHaveTextContent('false');

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('online');
    expect(screen.getByTestId('connectivity-is-online')).toHaveTextContent('true');
  });

  it('falls back to offline if connectivity drops during the reconnect window', () => {
    render(
      <ConnectivityProvider>
        <ConnectivityProbe />
      </ConnectivityProvider>
    );

    act(() => {
      setNavigatorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });

    act(() => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('reconnecting');

    act(() => {
      setNavigatorOnline(false);
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByTestId('connectivity-status')).toHaveTextContent('offline');
    expect(screen.getByTestId('connectivity-is-online')).toHaveTextContent('false');
  });
});
