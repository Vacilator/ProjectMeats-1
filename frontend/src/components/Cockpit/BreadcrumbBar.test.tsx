import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const cockpitNavigationMock = vi.hoisted(() => ({
  path: [] as Array<{
    id: string;
    type: string;
    label: string;
    subtitle?: string;
    timestamp: number;
  }>,
  goToStep: vi.fn(),
  clearPath: vi.fn(),
}));

vi.mock('../../contexts/CockpitNavigationContext', () => ({
  useCockpitNavigation: () => cockpitNavigationMock,
}));

import { BreadcrumbBar } from './BreadcrumbBar';

describe('BreadcrumbBar', () => {
  beforeEach(() => {
    cockpitNavigationMock.path = [];
    cockpitNavigationMock.goToStep.mockReset();
    cockpitNavigationMock.clearPath.mockReset();
  });

  it('masks UUID labels with a human-readable entity detail label', () => {
    cockpitNavigationMock.path = [
      {
        id: '7d9154f4-1a4d-4f47-b7d4-6223479c1fe7',
        type: 'plant',
        label: '7d9154f4-1a4d-4f47-b7d4-6223479c1fe7',
        timestamp: Date.now(),
      },
    ];

    render(<BreadcrumbBar />);

    expect(screen.getByText('Plant Details')).toBeInTheDocument();
    expect(
      screen.queryByText('7d9154f4-1a4d-4f47-b7d4-6223479c1fe7')
    ).not.toBeInTheDocument();
  });
});
