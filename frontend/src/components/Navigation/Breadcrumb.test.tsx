/**
 * Tests for Breadcrumb Navigation Component
 * 
 * Updated: 2026-02-04 - Phase 1.1 changes
 * - Removed hardcoded Dashboard root
 * - Context-aware breadcrumbs (first segment is root)
 * - Returns null for root path
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { businessApi } from '@/services/businessApi';
import Breadcrumb from './Breadcrumb';

export {};

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: vi.fn(),
  },
}));

// Test wrapper
const renderWithRouter = (initialPath: string = '/') => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Breadcrumb />
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Breadcrumb', () => {
  beforeEach(() => {
    vi.mocked(businessApi.get).mockReset();
  });

  describe('root path', () => {
    it('returns null for root path (no breadcrumb)', () => {
      const { container } = renderWithRouter('/');
      expect(container.firstChild).toBeNull();
    });
  });

  describe('single level path', () => {
    it('renders suppliers breadcrumb without root prefix', () => {
      renderWithRouter('/suppliers');
      
      // Should show only "Suppliers", no Dashboard
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders customers breadcrumb without root prefix', () => {
      renderWithRouter('/customers');
      
      expect(screen.getByText('Customers')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders purchase-orders breadcrumb without root prefix', () => {
      renderWithRouter('/purchase-orders');
      
      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders accounts-receivables breadcrumb without root prefix', () => {
      renderWithRouter('/accounts-receivables');
      
      expect(screen.getByText('Accounts Receivables')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders contacts breadcrumb without root prefix', () => {
      renderWithRouter('/contacts');
      
      expect(screen.getByText('Contacts')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders carriers breadcrumb without root prefix', () => {
      renderWithRouter('/carriers');
      
      expect(screen.getByText('Carriers')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders ai-assistant breadcrumb without root prefix', () => {
      renderWithRouter('/ai-assistant');
      
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders profile breadcrumb without root prefix', () => {
      renderWithRouter('/profile');
      
      expect(screen.getByText('Profile')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders settings breadcrumb without root prefix', () => {
      renderWithRouter('/settings');
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });
  });

  describe('navigation structure', () => {
    it('renders nav element', () => {
      renderWithRouter('/suppliers');
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders first segment as link when multi-level', () => {
      renderWithRouter('/suppliers/details');
      
      const suppliersLink = screen.getByRole('link', { name: 'Suppliers' });
      expect(suppliersLink).toHaveAttribute('href', '/suppliers');
    });

    it('renders last item as text, not link', () => {
      renderWithRouter('/suppliers');
      
      // Suppliers should be text, not link (it's the only/current page)
      const suppliersText = screen.getByText('Suppliers');
      expect(suppliersText.tagName).not.toBe('A');
    });
  });

  describe('multi-level path', () => {
    it('renders all path segments without Dashboard', () => {
      renderWithRouter('/suppliers/details');
      
      // First segment is root (no Dashboard)
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders first segment as link in multi-level', () => {
      renderWithRouter('/suppliers/details');
      
      const suppliersLink = screen.getByRole('link', { name: 'Suppliers' });
      expect(suppliersLink).toHaveAttribute('href', '/suppliers');
    });

    it('renders separator between segments', () => {
      renderWithRouter('/suppliers/details');
      
      const separators = screen.getAllByText('/');
      expect(separators.length).toBeGreaterThanOrEqual(1); // Changed from 2 to 1
    });

    it('resolves supplier and plant breadcrumb ids into display names', async () => {
      vi.mocked(businessApi.get).mockImplementation((url: string) => {
        if (url === 'suppliers/supplier-uuid-1234/') {
          return Promise.resolve({ data: { name: 'Acme Meats' } } as never);
        }

        if (url === 'plants/plant-uuid-5678/') {
          return Promise.resolve({ data: { name: 'North Plant' } } as never);
        }

        return Promise.reject(new Error(`Unexpected GET ${url}`));
      });

      renderWithRouter('/suppliers/supplier-uuid-1234/plants/plant-uuid-5678');

      expect(await screen.findByText('Acme Meats')).toBeInTheDocument();
      expect(await screen.findByText('North Plant')).toBeInTheDocument();
      expect(screen.queryByText('supplier-uuid-1234')).not.toBeInTheDocument();
      expect(screen.queryByText('plant-uuid-5678')).not.toBeInTheDocument();
    });

    it('falls back to contextual details labels when entity lookup fails', async () => {
      vi.mocked(businessApi.get).mockRejectedValue(new Error('lookup failed'));

      renderWithRouter(
        '/suppliers/123e4567-e89b-12d3-a456-426614174000/plants/987e6543-e21b-12d3-a456-426614174000'
      );

      expect(await screen.findByText('Supplier Details')).toBeInTheDocument();
      expect(await screen.findByText('Plant Details')).toBeInTheDocument();
      expect(screen.queryByText('123e4567-e89b-12d3-a456-426614174000')).not.toBeInTheDocument();
      expect(screen.queryByText('987e6543-e21b-12d3-a456-426614174000')).not.toBeInTheDocument();
    });
  });

  describe('unknown paths', () => {
    it('displays pathname as-is for unmapped routes', () => {
      renderWithRouter('/custom-page');
      
      // Should display custom-page as title-cased, no Dashboard
      expect(screen.getByText('Custom page')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('replaces UUID path segments with a readable details label', () => {
      const uuid = '7d9154f4-1a4d-4f47-b7d4-6223479c1fe7';
      renderWithRouter(`/suppliers/${uuid}`);

      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.getByText('Supplier Details')).toBeInTheDocument();
      expect(screen.queryByText(uuid)).not.toBeInTheDocument();
    });
  });
});
