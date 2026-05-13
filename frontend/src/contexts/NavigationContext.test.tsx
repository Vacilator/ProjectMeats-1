/**
 * Tests for NavigationContext
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { NavigationProvider, useNavigation } from './NavigationContext';

export {};

// Wrapper component for testing
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/']}>
    <NavigationProvider>{children}</NavigationProvider>
  </MemoryRouter>
);

const createWrapper = (initialPath: string) => {
  return ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={[initialPath]}>
      <NavigationProvider>{children}</NavigationProvider>
    </MemoryRouter>
  );
};

describe('NavigationContext', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('useNavigation hook', () => {
    it('throws error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useNavigation());
      }).toThrow('useNavigation must be used within a NavigationProvider');

      consoleSpy.mockRestore();
    });

    it('provides context when used inside provider', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.currentModule).toBeDefined();
    });
  });

  describe('currentModule', () => {
    it('returns "dashboard" for root path', () => {
      const { result } = renderHook(() => useNavigation(), {
        wrapper: createWrapper('/'),
      });

      expect(result.current.currentModule).toBe('dashboard');
    });

    it('returns first path segment as module', () => {
      const { result } = renderHook(() => useNavigation(), {
        wrapper: createWrapper('/suppliers'),
      });

      expect(result.current.currentModule).toBe('suppliers');
    });

    it('returns first segment for nested paths', () => {
      const { result } = renderHook(() => useNavigation(), {
        wrapper: createWrapper('/customers/123/edit'),
      });

      expect(result.current.currentModule).toBe('customers');
    });

    it('handles purchase-orders module', () => {
      const { result } = renderHook(() => useNavigation(), {
        wrapper: createWrapper('/purchase-orders'),
      });

      expect(result.current.currentModule).toBe('purchase-orders');
    });
  });

  describe('moduleData', () => {
    it('starts with empty module data', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.moduleData).toEqual({});
    });

    it('sets module data', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setModuleData('suppliers', { selectedId: '123' });
      });

      expect(result.current.moduleData.suppliers).toEqual({ selectedId: '123' });
    });

    it('merges data for same module', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setModuleData('suppliers', { selectedId: '123' });
      });

      act(() => {
        result.current.setModuleData('suppliers', { filter: 'active' });
      });

      expect(result.current.moduleData.suppliers).toEqual({
        selectedId: '123',
        filter: 'active',
      });
    });

    it('keeps data separate for different modules', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setModuleData('suppliers', { selectedId: '123' });
        result.current.setModuleData('customers', { selectedId: '456' });
      });

      expect(result.current.moduleData.suppliers).toEqual({ selectedId: '123' });
      expect(result.current.moduleData.customers).toEqual({ selectedId: '456' });
    });

    it('clears module data', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setModuleData('suppliers', { selectedId: '123' });
      });

      expect(result.current.moduleData.suppliers).toBeDefined();

      act(() => {
        result.current.clearModuleData('suppliers');
      });

      expect(result.current.moduleData.suppliers).toBeUndefined();
    });

    it('clearing one module preserves others', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setModuleData('suppliers', { data: 'a' });
        result.current.setModuleData('customers', { data: 'b' });
      });

      act(() => {
        result.current.clearModuleData('suppliers');
      });

      expect(result.current.moduleData.suppliers).toBeUndefined();
      expect(result.current.moduleData.customers).toEqual({ data: 'b' });
    });
  });

  describe('breadcrumbPath', () => {
    it('starts with empty breadcrumb path', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.breadcrumbPath).toEqual([]);
    });

    it('sets breadcrumb path', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setBreadcrumbPath(['Home', 'Suppliers', 'Details']);
      });

      expect(result.current.breadcrumbPath).toEqual(['Home', 'Suppliers', 'Details']);
    });

    it('replaces breadcrumb path', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setBreadcrumbPath(['Home', 'Suppliers']);
      });

      act(() => {
        result.current.setBreadcrumbPath(['Home', 'Customers']);
      });

      expect(result.current.breadcrumbPath).toEqual(['Home', 'Customers']);
    });
  });

  describe('hierarchyStack', () => {
    it('starts with empty hierarchy state', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.hierarchyStack).toEqual([]);
    });

    it('stores hierarchy stack entries', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      act(() => {
        result.current.setHierarchyStack([
          {
            entityType: 'supplier',
            entityId: '123',
            label: 'Acme Meats',
            routeTo: '/suppliers/123',
          },
        ]);
      });

      expect(result.current.hierarchyStack).toEqual([
        {
          entityType: 'supplier',
          entityId: '123',
          label: 'Acme Meats',
          routeTo: '/suppliers/123',
        },
      ]);
    });
  });

  describe('sidebarOpen', () => {
    it('defaults to false when no localStorage', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.sidebarOpen).toBe(false);
    });

    it('initializes from localStorage when set to true', () => {
      localStorage.setItem('sidebarKeepOpen', 'true');

      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.sidebarOpen).toBe(true);
    });

    it('initializes as false when localStorage is false', () => {
      localStorage.setItem('sidebarKeepOpen', 'false');

      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.sidebarOpen).toBe(false);
    });

    it('can toggle sidebar open state', () => {
      const { result } = renderHook(() => useNavigation(), { wrapper });

      expect(result.current.sidebarOpen).toBe(false);

      act(() => {
        result.current.setSidebarOpen(true);
      });

      expect(result.current.sidebarOpen).toBe(true);

      act(() => {
        result.current.setSidebarOpen(false);
      });

      expect(result.current.sidebarOpen).toBe(false);
    });
  });

  describe('function stability', () => {
    it('setModuleData is stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useNavigation(), { wrapper });

      const ref1 = result.current.setModuleData;
      rerender();
      const ref2 = result.current.setModuleData;

      expect(ref1).toBe(ref2);
    });

    it('clearModuleData is stable across rerenders', () => {
      const { result, rerender } = renderHook(() => useNavigation(), { wrapper });

      const ref1 = result.current.clearModuleData;
      rerender();
      const ref2 = result.current.clearModuleData;

      expect(ref1).toBe(ref2);
    });
  });

  describe('NavigationProvider', () => {
    it('renders children', () => {
      render(
        <MemoryRouter>
          <NavigationProvider>
            <div data-testid="child">Child content</div>
          </NavigationProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });
});
