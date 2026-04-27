import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ActivityFeed } from './ActivityFeed';

const businessApiGet = vi.fn();

vi.mock('../../services/businessApi', () => ({
  businessApi: {
    get: (...args: unknown[]) => businessApiGet(...args),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe('ActivityFeed', () => {
  it('renders an error alert when loading fails', async () => {
    businessApiGet.mockRejectedValueOnce({
      response: {
        data: {
          detail: 'Activity failed',
        },
      },
    });

    render(<ActivityFeed entityType="plant" entityId="plant-uuid" />);

    expect(await screen.findByText('Activity failed')).toBeInTheDocument();
  });
});
