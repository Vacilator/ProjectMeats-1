/**
 * Tests for useActionItemCounts hook
 */
import { renderHook, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import axios from 'axios';
import { useActionItemCounts } from './useActionItemCounts';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('useActionItemCounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const mockCounts = {
    total: 10,
    overdue: 2,
    due_today: 3,
    due_this_week: 5,
    by_priority: {
      urgent: 2,
      high: 3,
      normal: 5,
    },
    by_form: [
      { form_name: 'Supplier Onboarding', count: 5 },
      { form_name: 'Credit Application', count: 3 },
      { form_name: 'Quote Request', count: 2 },
    ],
  };

  it('should fetch counts on mount', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: mockCounts });

    const { result } = renderHook(() => useActionItemCounts());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.counts.total).toBe(0);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.counts).toEqual(mockCounts);
    expect(result.current.error).toBeNull();
    expect(mockedAxios.get).toHaveBeenCalledWith('/api/v1/workflows/action-items/counts/');
  });

  it('should handle API errors gracefully', async () => {
    const errorMessage = 'Network error';
    mockedAxios.get.mockRejectedValueOnce(new Error(errorMessage));

    const { result } = renderHook(() => useActionItemCounts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error?.message).toBe(errorMessage);
    expect(result.current.counts.total).toBe(0);
  });

  it('should poll for updates at the specified interval', async () => {
    const mockCounts1 = { ...mockCounts, total: 10 };
    const mockCounts2 = { ...mockCounts, total: 12 };

    mockedAxios.get.mockResolvedValueOnce({ data: mockCounts1 });

    const { result } = renderHook(() => useActionItemCounts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.counts.total).toBe(10);

    // Mock second response
    mockedAxios.get.mockResolvedValueOnce({ data: mockCounts2 });

    // Fast-forward 60 seconds
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(result.current.counts.total).toBe(12);
    });

    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should not fetch when disabled', async () => {
    const { result } = renderHook(() => useActionItemCounts({ enabled: false }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(mockedAxios.get).not.toHaveBeenCalled();
    expect(result.current.counts.total).toBe(0);
  });

  it('should use custom polling interval', async () => {
    mockedAxios.get.mockResolvedValue({ data: mockCounts });

    renderHook(() => useActionItemCounts({ pollingInterval: 30000 }));

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    // Fast-forward 30 seconds
    act(() => {
      jest.advanceTimersByTime(30000);
    });

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  it('should refetch on demand', async () => {
    const mockCounts1 = { ...mockCounts, total: 10 };
    const mockCounts2 = { ...mockCounts, total: 15 };

    mockedAxios.get.mockResolvedValueOnce({ data: mockCounts1 });

    const { result } = renderHook(() => useActionItemCounts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.counts.total).toBe(10);

    // Mock second response
    mockedAxios.get.mockResolvedValueOnce({ data: mockCounts2 });

    // Manually refetch
    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.counts.total).toBe(15);
    expect(mockedAxios.get).toHaveBeenCalledTimes(2);
  });

  it('should preserve existing counts on subsequent errors', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: mockCounts });

    const { result } = renderHook(() => useActionItemCounts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.counts.total).toBe(10);

    // Next poll fails
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    act(() => {
      jest.advanceTimersByTime(60000);
    });

    await waitFor(() => {
      expect(result.current.error).not.toBeNull();
    });

    // Counts should still be from the last successful fetch
    expect(result.current.counts.total).toBe(10);
  });

  it('should cleanup polling interval on unmount', async () => {
    mockedAxios.get.mockResolvedValue({ data: mockCounts });

    const { unmount } = renderHook(() => useActionItemCounts());

    await waitFor(() => {
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    unmount();

    // Fast-forward time after unmount
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    // Should not have made another call
    expect(mockedAxios.get).toHaveBeenCalledTimes(1);
  });

  it('should return default counts structure', () => {
    mockedAxios.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useActionItemCounts());

    expect(result.current.counts).toEqual({
      total: 0,
      overdue: 0,
      due_today: 0,
      due_this_week: 0,
      by_priority: {},
      by_form: [],
    });
  });

  it('should handle Axios errors with response data', async () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        data: {
          message: 'Unauthorized',
        },
      },
      message: 'Request failed with status code 401',
    };

    mockedAxios.get.mockRejectedValueOnce(axiosError);
    mockedAxios.isAxiosError.mockReturnValueOnce(true);

    const { result } = renderHook(() => useActionItemCounts());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error?.message).toBe('Unauthorized');
  });
});
