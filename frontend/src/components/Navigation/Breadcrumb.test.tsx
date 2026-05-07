/**
 * Tests for Breadcrumb Navigation Component
 * 
 * Updated: 2026-02-04 - Phase 1.1 changes
 * - Removed hardcoded Dashboard root
 * - Context-aware breadcrumbs (first segment is root)
 * - Returns null for root path
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumb from './Breadcrumb';

export {};

// Test wrapper
const renderWithRouter = (initialPath: string = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Breadcrumb />
    </MemoryRouter>
  );
};

describe('Breadcrumb', () => {
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
