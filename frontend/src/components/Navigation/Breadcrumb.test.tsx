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
    it('renders Home breadcrumb for single-segment paths (entity name is page header)', () => {
      renderWithRouter('/suppliers');

      // Last segment is dropped (shown as page header), breadcrumb shows Home
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders Home breadcrumb for customers path', () => {
      renderWithRouter('/customers');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for purchase-orders path', () => {
      renderWithRouter('/purchase-orders');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for accounts-receivables path', () => {
      renderWithRouter('/accounts-receivables');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for contacts path', () => {
      renderWithRouter('/contacts');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for carriers path', () => {
      renderWithRouter('/carriers');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for ai-assistant path', () => {
      renderWithRouter('/ai-assistant');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for profile path', () => {
      renderWithRouter('/profile');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });

    it('renders Home breadcrumb for settings path', () => {
      renderWithRouter('/settings');

      expect(screen.getByText('Home')).toBeInTheDocument();
    });
  });

  describe('navigation structure', () => {
    it('renders nav element', () => {
      renderWithRouter('/suppliers');
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders Home as link when multi-level', () => {
      renderWithRouter('/suppliers/details');

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders last trail item as link to parent', () => {
      renderWithRouter('/suppliers/details');

      // "Suppliers" is the last item in the trail — still a link to the parent route
      const suppliersLink = screen.getByText('Suppliers');
      expect(suppliersLink.tagName).toBe('A');
    });
  });

  describe('multi-level path', () => {
    it('renders Home and intermediate segments, drops last', () => {
      renderWithRouter('/suppliers/details');

      // Home is root link, Suppliers is trail text (Details is page header, not in breadcrumb)
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('renders Home as link in multi-level', () => {
      renderWithRouter('/suppliers/details');

      const homeLink = screen.getByRole('link', { name: 'Home' });
      expect(homeLink).toHaveAttribute('href', '/');
    });

    it('renders separator between segments', () => {
      renderWithRouter('/suppliers/details');

      const separators = screen.getAllByText('/');
      expect(separators.length).toBeGreaterThanOrEqual(1);
    });

    it('resolves supplier breadcrumb ids into display names, drops last segment', async () => {
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

      // Acme Meats is in the trail; North Plant is the page header (dropped from breadcrumb)
      expect(await screen.findByText('Acme Meats')).toBeInTheDocument();
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

  describe('unknown paths', () => {
    it('displays Home for single-segment unmapped routes', () => {
      renderWithRouter('/custom-page');

      // Single segment: breadcrumb shows Home (custom-page is page header)
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
    });

    it('replaces UUID path segments with a readable details label', () => {
      const uuid = '7d9154f4-1a4d-4f47-b7d4-6223479c1fe7';
      renderWithRouter(`/suppliers/${uuid}`);

      // Home / Suppliers (uuid resolved as page header, dropped from trail)
      expect(screen.getByText('Home')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.queryByText(uuid)).not.toBeInTheDocument();
    });
  });
});
