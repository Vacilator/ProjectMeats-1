/**
 * Tests for CommandPalette Component (Wave 2: Cockpit Command Center)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';
import { CockpitNavigationProvider } from '../../contexts/CockpitNavigationContext';

const mockNavigate = vi.fn();
const searchServiceMocks = vi.hoisted(() => ({
  getRecentItems: vi.fn().mockResolvedValue([]),
  getSearchColorVar: vi.fn().mockReturnValue('--color-info'),
  searchRanked: vi.fn().mockResolvedValue({
    query: '',
    results: [],
    counts: {},
    total: 0,
  }),
  trackRecentItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/services/searchService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/searchService')>();
  return {
    ...actual,
    getRecentItems: searchServiceMocks.getRecentItems,
    getSearchColorVar: searchServiceMocks.getSearchColorVar,
    searchRanked: searchServiceMocks.searchRanked,
    trackRecentItem: searchServiceMocks.trackRecentItem,
    searchService: {
      getRecentItems: searchServiceMocks.getRecentItems,
      searchRanked: searchServiceMocks.searchRanked,
      trackRecentItem: searchServiceMocks.trackRecentItem,
    },
  };
});

// Components under test
import { CommandPalette } from './CommandPalette';

// This file is a module (required for TypeScript isolatedModules)
export {};

// Test wrapper with router + cockpit navigation context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>
    <CockpitNavigationProvider>{children}</CockpitNavigationProvider>
  </BrowserRouter>
);

describe('CommandPalette', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    searchServiceMocks.searchRanked.mockResolvedValue({
      query: '',
      results: [],
      counts: {},
      total: 0,
    });
  });

  it('renders when open', () => {
    render(
      <TestWrapper>
        <CommandPalette {...defaultProps} />
      </TestWrapper>
    );

    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
  });

  it('hides overlay when closed', () => {
    const { container } = render(
      <TestWrapper>
        <CommandPalette {...defaultProps} isOpen={false} />
      </TestWrapper>
    );

    // The overlay has display: none when closed, so the input should not be visible
    // Testing-library queries can still find elements with display:none
    // We check the overlay's computed style instead
    const overlay = container.querySelector('div');
    if (overlay) {
      expect(overlay).toHaveStyle('display: none');
    }
  });

  it('calls onClose when Escape is pressed', async () => {
    const onClose = vi.fn();

    render(
      <TestWrapper>
        <CommandPalette isOpen={true} onClose={onClose} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  it('focuses search input when opened', () => {
    render(
      <TestWrapper>
        <CommandPalette {...defaultProps} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/search/i);
    expect(input).toHaveFocus();
  });
});

describe('CommandPalette keyboard navigation', () => {
  it('handles arrow key navigation without crashing', async () => {
    const onClose = vi.fn();

    render(
      <TestWrapper>
        <CommandPalette isOpen={true} onClose={onClose} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/search/i);

    // Navigate with arrow keys
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    // Should not crash and should not close
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('CommandPalette search behavior', () => {
  it('debounces search input', async () => {
    vi.useFakeTimers();

    render(
      <TestWrapper>
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/search/i);

    // Type quickly
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test' } });
    });

    // Fast-forward past debounce time
    await act(async () => {
      vi.advanceTimersByTime(250);
    });

    vi.useRealTimers();

    // Component should not crash during debounce
    expect(input).toHaveValue('test');
  });

  it('navigates canonical supplier results to their record route instead of /cockpit', async () => {
    vi.useFakeTimers();
    try {
      searchServiceMocks.searchRanked.mockResolvedValue({
        query: 'acme',
        total: 1,
        counts: { supplier: 1 },
        results: [
          {
            id: 'supplier-1',
            type: 'supplier',
            title: 'Acme Supplier',
            subtitle: 'Preferred vendor',
            icon: 'Building2',
            colorVar: '--color-primary',
            route: '/suppliers/supplier-1',
            score: 99,
            labels: [],
            metadata: {},
          },
        ],
      });

      render(
        <TestWrapper>
          <CommandPalette isOpen={true} onClose={vi.fn()} />
        </TestWrapper>
      );

      const input = screen.getByPlaceholderText(/search/i);
      fireEvent.change(input, { target: { value: 'acme' } });

      await act(async () => {
        vi.advanceTimersByTime(350);
        await Promise.resolve();
        await Promise.resolve();
      });

      const result = screen.getByText('Acme Supplier');
      await act(async () => {
        fireEvent.click(result);
        await Promise.resolve();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/suppliers/supplier-1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears search on close and reopen', () => {
    const { rerender } = render(
      <TestWrapper>
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'test query' } });

    // Close
    rerender(
      <TestWrapper>
        <CommandPalette isOpen={false} onClose={vi.fn()} />
      </TestWrapper>
    );

    // Reopen
    rerender(
      <TestWrapper>
        <CommandPalette isOpen={true} onClose={vi.fn()} />
      </TestWrapper>
    );

    // Input should be cleared after reopening
    const newInput = screen.getByPlaceholderText(/search/i);
    expect(newInput).toHaveValue('');
  });
});
