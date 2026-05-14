/**
 * Tests for Breadcrumb Navigation Component
 *
 * Updated: 2026-05-14 — Hierarchical breadcrumb rework
 * - "Workspace" only shows for /workspace/* paths or ?ref=search
 * - Single-segment pages render no trail (page header only)
 * - Multi-level paths build naturally from URL hierarchy
 * - /records/:entityType/:id synthesizes parent list crumb
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

  describe('single-segment top-level pages', () => {
    it('renders nothing for /suppliers (page header is the content)', () => {
      const { container } = renderWithRouter('/suppliers');
      // Single segment = no trail, no breadcrumb
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for /customers', () => {
      const { container } = renderWithRouter('/customers');
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for /purchase-orders', () => {
      const { container } = renderWithRouter('/purchase-orders');
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for /inquiries', () => {
      const { container } = renderWithRouter('/inquiries');
      expect(container.firstChild).toBeNull();
    });

    it('does NOT show "Workspace" for top-level pages', () => {
      renderWithRouter('/suppliers');
      expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    });
  });

  describe('workspace child pages', () => {
    it('renders Workspace as root for /workspace/option-lists', () => {
      renderWithRouter('/workspace/option-lists');

      expect(screen.getByText('Workspace')).toBeInTheDocument();
      // "Option Lists" is the last segment → page header, not in trail
      expect(screen.queryByText('Option Lists')).not.toBeInTheDocument();
    });

    it('renders Workspace as root for /workspace/configurations', () => {
      renderWithRouter('/workspace/configurations');

      expect(screen.getByText('Workspace')).toBeInTheDocument();
    });

    it('renders Workspace as link pointing to /', () => {
      renderWithRouter('/workspace/option-lists');

      const homeLink = screen.getByRole('link', { name: 'Workspace' });
      expect(homeLink).toHaveAttribute('href', '/');
    });
  });

  describe('search-initiated navigation', () => {
    it('renders Workspace root when ?ref=search is present', () => {
      renderWithRouter('/suppliers?ref=search');

      expect(screen.getByText('Workspace')).toBeInTheDocument();
    });
  });

  describe('multi-level hierarchy', () => {
    it('renders parent segments for /suppliers/details', () => {
      renderWithRouter('/suppliers/details');

      // "Suppliers" is the trail, "Details" is the page header (dropped)
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByText('Workspace')).not.toBeInTheDocument();
    });

    it('renders nav element for multi-level paths', () => {
      renderWithRouter('/suppliers/details');
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders Suppliers as link to /suppliers', () => {
      renderWithRouter('/suppliers/details');

      const link = screen.getByRole('link', { name: 'Suppliers' });
      expect(link).toHaveAttribute('href', '/suppliers');
    });

    it('renders accounting hierarchy: Accounting / Receivables', () => {
      renderWithRouter('/accounting/receivables/invoices');

      expect(screen.getByText('Accounting')).toBeInTheDocument();
      expect(screen.getByText('Receivables')).toBeInTheDocument();
      // "Invoices" is the page header (dropped from trail)
      expect(screen.queryByText('Invoices')).not.toBeInTheDocument();
    });

    it('renders separator between segments', () => {
      renderWithRouter('/accounting/receivables/invoices');

      const separators = screen.getAllByText('/');
      expect(separators.length).toBeGreaterThanOrEqual(1);
    });

    it('resolves supplier UUID into display name', async () => {
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

      // Trail: Suppliers / Acme Meats / Plants   |   Page header: North Plant (dropped)
      expect(await screen.findByText('Acme Meats')).toBeInTheDocument();
      expect(screen.getByText('Plants')).toBeInTheDocument();
      expect(screen.queryByText('supplier-uuid-1234')).not.toBeInTheDocument();
    });

    it('falls back to contextual details labels when entity lookup fails', async () => {
      vi.mocked(businessApi.get).mockRejectedValue(new Error('lookup failed'));

      renderWithRouter(
        '/suppliers/123e4567-e89b-12d3-a456-426614174000/plants/987e6543-e21b-12d3-a456-426614174000'
      );

      expect(await screen.findByText('Supplier Details')).toBeInTheDocument();
      expect(screen.queryByText('123e4567-e89b-12d3-a456-426614174000')).not.toBeInTheDocument();
    });
  });

  describe('/records/:entityType/:id paths', () => {
    it('synthesizes parent list crumb for /records/supplier/:id', () => {
      renderWithRouter('/records/supplier/123');

      // Trail: Suppliers (linked to /suppliers)
      // Page header: Supplier 123 (dropped)
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Suppliers' });
      expect(link).toHaveAttribute('href', '/suppliers');
    });

    it('synthesizes parent list crumb for /records/purchase_order/:id', () => {
      renderWithRouter('/records/purchase_order/42');

      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
      const link = screen.getByRole('link', { name: 'Purchase Orders' });
      expect(link).toHaveAttribute('href', '/purchase-orders');
    });
  });

  describe('unknown paths', () => {
    it('renders nothing for single-segment unmapped routes', () => {
      const { container } = renderWithRouter('/custom-page');
      expect(container.firstChild).toBeNull();
    });

    it('replaces UUID segments with readable details label in multi-level', () => {
      const uuid = '7d9154f4-1a4d-4f47-b7d4-6223479c1fe7';
      renderWithRouter(`/suppliers/${uuid}`);

      // Trail: Suppliers   |   Page header: Supplier Details (dropped)
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByText(uuid)).not.toBeInTheDocument();
    });
  });
});
