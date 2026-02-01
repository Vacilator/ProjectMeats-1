/**
 * Tests for Breadcrumb Navigation Component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
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
    it('shows Dashboard when at root', () => {
      renderWithRouter('/');
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    it('does not render separator at root', () => {
      renderWithRouter('/');
      expect(screen.queryByText('/')).not.toBeInTheDocument();
    });
  });

  describe('single level path', () => {
    it('renders suppliers breadcrumb', () => {
      renderWithRouter('/suppliers');
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
    });

    it('renders customers breadcrumb', () => {
      renderWithRouter('/customers');
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Customers')).toBeInTheDocument();
    });

    it('renders purchase-orders breadcrumb', () => {
      renderWithRouter('/purchase-orders');
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Purchase Orders')).toBeInTheDocument();
    });

    it('renders accounts-receivables breadcrumb', () => {
      renderWithRouter('/accounts-receivables');
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Accounts Receivables')).toBeInTheDocument();
    });

    it('renders contacts breadcrumb', () => {
      renderWithRouter('/contacts');
      
      expect(screen.getByText('Contacts')).toBeInTheDocument();
    });

    it('renders carriers breadcrumb', () => {
      renderWithRouter('/carriers');
      
      expect(screen.getByText('Carriers')).toBeInTheDocument();
    });

    it('renders ai-assistant breadcrumb', () => {
      renderWithRouter('/ai-assistant');
      
      expect(screen.getByText('AI Assistant')).toBeInTheDocument();
    });

    it('renders profile breadcrumb', () => {
      renderWithRouter('/profile');
      
      expect(screen.getByText('Profile')).toBeInTheDocument();
    });

    it('renders settings breadcrumb', () => {
      renderWithRouter('/settings');
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('navigation structure', () => {
    it('renders nav element', () => {
      renderWithRouter('/suppliers');
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders Dashboard as a link when not at root', () => {
      renderWithRouter('/suppliers');
      
      const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
      expect(dashboardLink).toHaveAttribute('href', '/');
    });

    it('renders last item as text, not link', () => {
      renderWithRouter('/suppliers');
      
      // Suppliers should be text, not link
      const suppliersText = screen.getByText('Suppliers');
      expect(suppliersText.tagName).not.toBe('A');
    });
  });

  describe('multi-level path', () => {
    it('renders all path segments', () => {
      renderWithRouter('/suppliers/details');
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
      expect(screen.getByText('details')).toBeInTheDocument();
    });

    it('renders middle segments as links', () => {
      renderWithRouter('/suppliers/details');
      
      const suppliersLink = screen.getByRole('link', { name: 'Suppliers' });
      expect(suppliersLink).toHaveAttribute('href', '/suppliers');
    });

    it('renders separators between segments', () => {
      renderWithRouter('/suppliers/details');
      
      const separators = screen.getAllByText('/');
      expect(separators.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('unknown paths', () => {
    it('displays pathname as-is for unmapped routes', () => {
      renderWithRouter('/custom-page');
      
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
      expect(screen.getByText('custom-page')).toBeInTheDocument();
    });
  });
});
