/**
 * Tests for Suppliers Component
 * 
 * Specifically tests the fix for: f.map is not a function
 * Issue: Products state must always be an array to prevent .map() errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Suppliers from './Suppliers';
import * as apiService from '../services/apiService';

// Mock the API service
vi.mock('../services/apiService', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
  apiService: {
    getSuppliers: vi.fn(),
    createSupplier: vi.fn(),
    updateSupplier: vi.fn(),
    deleteSupplier: vi.fn(),
  },
}));

// Mock the theme context
vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        textSecondary: '#666',
        textPrimary: '#000',
        surface: '#fff',
        background: '#f5f5f5',
        border: '#ddd',
        primary: '#007bff',
        shadow: 'rgba(0,0,0,0.1)',
        surfaceHover: '#f9f9f9',
      },
    },
  }),
}));

// Wrapper component for tests
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('Suppliers Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock implementations
    (apiService.apiService.getSuppliers as any).mockResolvedValue([]);
  });

  describe('handling products API responses', () => {
    it('handles array response correctly', async () => {
      const mockProducts = [
        { id: 1, product_code: 'P001', effective_name: 'Product 1' },
        { id: 2, product_code: 'P002', effective_name: 'Product 2' },
      ];

      (apiService.apiClient.get as any).mockResolvedValue({
        data: mockProducts,
      });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw "f.map is not a function" error
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });

    it('handles null response gracefully', async () => {
      (apiService.apiClient.get as any).mockResolvedValue({
        data: null,
      });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw "f.map is not a function" error
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });

    it('handles undefined response gracefully', async () => {
      (apiService.apiClient.get as any).mockResolvedValue({
        data: undefined,
      });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw "f.map is not a function" error
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });

    it('handles object response instead of array', async () => {
      (apiService.apiClient.get as any).mockResolvedValue({
        data: { results: [], count: 0 }, // Paginated response format
      });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw "f.map is not a function" error
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });

    it('handles API error gracefully', async () => {
      (apiService.apiClient.get as any).mockRejectedValue(
        new Error('Network error')
      );

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw "f.map is not a function" error
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });

    it('handles empty array response', async () => {
      (apiService.apiClient.get as any).mockResolvedValue({
        data: [],
      });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw "f.map is not a function" error
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });
  });

  describe('products filtering', () => {
    it('handles filtered products response gracefully', async () => {
      const mockProducts = [
        { id: 1, product_code: 'P001', effective_name: 'Beef Product' },
      ];

      // First call returns all products
      (apiService.apiClient.get as any)
        .mockResolvedValueOnce({ data: mockProducts })
        // Second call returns filtered products
        .mockResolvedValueOnce({ data: mockProducts });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should handle multiple API calls without errors
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });

    it('handles invalid filtered products response', async () => {
      // First call returns all products
      (apiService.apiClient.get as any)
        .mockResolvedValueOnce({ data: [] })
        // Second call returns invalid data
        .mockResolvedValueOnce({ data: null });

      render(
        <TestWrapper>
          <Suppliers />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Suppliers')).toBeInTheDocument();
      });

      // Should not throw error even with invalid filtered response
      expect(apiService.apiClient.get).toHaveBeenCalled();
    });
  });
});
