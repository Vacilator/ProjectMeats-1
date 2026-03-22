/**
 * Tests for OptionListModal Component
 * 
 * Specifically tests the fix for: e.filter is not a function
 * Issue: API responses that are not arrays should be handled gracefully
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { OptionListModal } from './OptionListModal';
import * as apiService from '../../../services/apiService';

vi.mock(import('../../../hooks/useToast'), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    useToast: () => ({
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn(),
    }),
  };
});

// Mock the API service
vi.mock('../../../services/apiService', () => ({
  adminClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock Modal component to simplify testing
vi.mock('../../../components/Modal/Modal', () => ({
  default: ({ children, isOpen }: any) => isOpen ? <div data-testid="modal">{children}</div> : null,
}));

describe('OptionListModal', () => {
  const mockProps = {
    listSlug: 'test-list',
    listName: 'Test List',
    isExtensible: true,
    isOpen: true,
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handling API responses', () => {
    it('handles array response correctly', async () => {
      const mockItems = [
        {
          id: '1',
          choice_list: 'test-list',
          tenant: null,
          value: 'TEST1',
          label: 'Test 1',
          extra_data: {},
          order: 0,
          is_active: true,
          is_default: false,
          is_system_defined: false,
          created_at: '2024-01-01',
          updated_at: '2024-01-01',
        },
      ];

      vi.mocked(apiService.adminClient.get).mockResolvedValue({
        data: mockItems,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      render(<OptionListModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
      });

      // Should render the item
      expect(screen.getByDisplayValue('TEST1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test 1')).toBeInTheDocument();
    });

    it('handles non-array response gracefully (the fix)', async () => {
      // Simulate API returning an object instead of array (the bug scenario)
      const badResponse = { message: 'Some error', items: [] };

      vi.mocked(apiService.adminClient.get).mockResolvedValue({
        data: badResponse as any, // Not an array!
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      render(<OptionListModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
      });

      // Should not crash and should show the empty state or add button
      expect(screen.getByText('Add Custom Item')).toBeInTheDocument();
    });

    it('handles null response gracefully', async () => {
      vi.mocked(apiService.adminClient.get).mockResolvedValue({
        data: null as any,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      render(<OptionListModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
      });

      // Should not crash
      expect(screen.getByText('Add Custom Item')).toBeInTheDocument();
    });

    it('handles undefined response gracefully', async () => {
      vi.mocked(apiService.adminClient.get).mockResolvedValue({
        data: undefined as any,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      render(<OptionListModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
      });

      // Should not crash
      expect(screen.getByText('Add Custom Item')).toBeInTheDocument();
    });

    it('handles error response gracefully', async () => {
      vi.mocked(apiService.adminClient.get).mockRejectedValue(new Error('Network error'));

      render(<OptionListModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
      });

      // Should not crash and should handle the error
      expect(screen.getByText('Add Custom Item')).toBeInTheDocument();
    });
  });

  describe('system-locked list', () => {
    it('does not show add button for non-extensible list', async () => {
      vi.mocked(apiService.adminClient.get).mockResolvedValue({
        data: [],
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
      });

      render(<OptionListModal {...mockProps} isExtensible={false} />);

      await waitFor(() => {
        expect(screen.queryByText('Loading items...')).not.toBeInTheDocument();
      });

      // Should not show add button
      expect(screen.queryByText('Add Custom Item')).not.toBeInTheDocument();
    });
  });
});
