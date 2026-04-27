import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import NotificationBell from './NotificationBell';
import * as NotificationsContext from '../../contexts/NotificationsContext';

vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('./NotificationPanel', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="notification-panel">
      <button onClick={onClose}>Close panel</button>
    </div>
  ),
}));

const mockUseNotifications = NotificationsContext.useNotifications as unknown as ReturnType<typeof vi.fn>;

describe('NotificationBell', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('shows unread badge + accessible label when unreadCount > 0', () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 3,
      fetchNotifications: vi.fn(),
    });

    render(<NotificationBell />);

    expect(screen.getByTestId('notification-bell-badge')).toHaveTextContent('3');
    expect(screen.getByRole('button', { name: /Notifications \(3 unread\)/i })).toBeInTheDocument();
  });

  it('calls fetchNotifications when opening the panel', async () => {
    const fetchNotifications = vi.fn();
    mockUseNotifications.mockReturnValue({
      unreadCount: 0,
      fetchNotifications,
    });

    render(<NotificationBell />);

    const btn = screen.getByTestId('notification-bell-button');
    expect(btn).toHaveAttribute('aria-expanded', 'false');

    await userEvent.click(btn);
    expect(fetchNotifications).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when Escape is pressed', async () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 0,
      fetchNotifications: vi.fn(),
    });

    render(<NotificationBell />);

    const btn = screen.getByTestId('notification-bell-button');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes when clicking outside', async () => {
    mockUseNotifications.mockReturnValue({
      unreadCount: 0,
      fetchNotifications: vi.fn(),
    });

    render(
      <div>
        <NotificationBell />
        <button data-testid="outside">Outside</button>
      </div>
    );

    const btn = screen.getByTestId('notification-bell-button');
    await userEvent.click(btn);
    expect(btn).toHaveAttribute('aria-expanded', 'true');

    fireEvent.mouseDown(screen.getByTestId('outside'));
    expect(btn).toHaveAttribute('aria-expanded', 'false');
  });
});
