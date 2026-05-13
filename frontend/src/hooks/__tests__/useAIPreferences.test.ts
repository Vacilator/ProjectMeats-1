/**
 * Tests for useAIPreferences hook.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock aiService
vi.mock('../../services/aiService', () => ({
  userAIPreferencesApi: {
    get: vi.fn(),
    update: vi.fn(),
  },
}));

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
    },
  };
});

import { useAIPreferences } from '../useAIPreferences';
import { userAIPreferencesApi } from '../../services/aiService';

const mockPrefs = {
  id: 1,
  require_external_approval: true,
  approval_auto_approve_threshold: 0.99,
  show_ai_confidence_badges: true,
  show_ai_suggestions: true,
  feedback_detail_level: 'standard' as const,
  notification_frequency: 'realtime' as const,
  created_on: '2026-01-01T00:00:00Z',
  modified_on: '2026-01-01T00:00:00Z',
};

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useAIPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch preferences on mount', async () => {
    vi.mocked(userAIPreferencesApi.get).mockResolvedValue(mockPrefs);

    const { result } = renderHook(() => useAIPreferences(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.preferences).toEqual(mockPrefs);
    expect(userAIPreferencesApi.get).toHaveBeenCalledTimes(1);
  });

  it('should return null preferences on error', async () => {
    vi.mocked(userAIPreferencesApi.get).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useAIPreferences(), {
      wrapper: createWrapper(),
    });

    // Hook sets retry: 1, so we need to wait for the retry to also fail
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true);
      },
      { timeout: 5000 },
    );

    expect(result.current.preferences).toBeNull();
  });

  it('should toggle approval required', async () => {
    vi.mocked(userAIPreferencesApi.get).mockResolvedValue(mockPrefs);
    vi.mocked(userAIPreferencesApi.update).mockResolvedValue({
      ...mockPrefs,
      require_external_approval: false,
    });

    const { result } = renderHook(() => useAIPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.preferences).toEqual(mockPrefs);
    });

    act(() => {
      result.current.toggleApprovalRequired();
    });

    await waitFor(() => {
      expect(userAIPreferencesApi.update).toHaveBeenCalledWith({
        require_external_approval: false,
      });
    });
  });

  it('should toggle confidence badges', async () => {
    vi.mocked(userAIPreferencesApi.get).mockResolvedValue(mockPrefs);
    vi.mocked(userAIPreferencesApi.update).mockResolvedValue({
      ...mockPrefs,
      show_ai_confidence_badges: false,
    });

    const { result } = renderHook(() => useAIPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.preferences).toEqual(mockPrefs);
    });

    act(() => {
      result.current.toggleConfidenceBadges();
    });

    await waitFor(() => {
      expect(userAIPreferencesApi.update).toHaveBeenCalledWith({
        show_ai_confidence_badges: false,
      });
    });
  });

  it('should update arbitrary preference', async () => {
    vi.mocked(userAIPreferencesApi.get).mockResolvedValue(mockPrefs);
    vi.mocked(userAIPreferencesApi.update).mockResolvedValue({
      ...mockPrefs,
      notification_frequency: 'daily_digest',
    });

    const { result } = renderHook(() => useAIPreferences(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.preferences).toEqual(mockPrefs);
    });

    act(() => {
      result.current.updatePreference('notification_frequency', 'daily_digest');
    });

    await waitFor(() => {
      expect(userAIPreferencesApi.update).toHaveBeenCalledWith({
        notification_frequency: 'daily_digest',
      });
    });
  });
});
