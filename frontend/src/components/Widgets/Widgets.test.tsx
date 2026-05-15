/**
 * Tests for Widget Components (Wave 2: Cockpit Command Center)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import React from 'react';

// Components under test
import { WidgetCard } from './WidgetCard';
import { QuickActionsWidget } from './QuickActionsWidget';

// This file is a module (required for TypeScript isolatedModules)
export {};

// Test wrapper with router context
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('WidgetCard', () => {
  it('renders title correctly', () => {
    render(
      <WidgetCard title="Test Widget">
        <div>Content</div>
      </WidgetCard>
    );
    
    expect(screen.getByText('Test Widget')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const TestIcon = () => <span data-testid="test-icon">Icon</span>;
    
    render(
      <WidgetCard title="Test Widget" icon={<TestIcon />}>
        <div>Content</div>
      </WidgetCard>
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <WidgetCard title="Test Widget" loading={true}>
        <div>Content</div>
      </WidgetCard>
    );
    
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('shows error state', () => {
    render(
      <WidgetCard title="Test Widget" error="Failed to load">
        <div>Content</div>
      </WidgetCard>
    );
    
    expect(screen.getByText('Failed to load')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('calls onRefresh when refresh button clicked', () => {
    const onRefresh = vi.fn();
    
    render(
      <WidgetCard title="Test Widget" onRefresh={onRefresh}>
        <div>Content</div>
      </WidgetCard>
    );
    
    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);
    
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button when loading', () => {
    const onRefresh = vi.fn();
    
    render(
      <WidgetCard title="Test Widget" loading={true} onRefresh={onRefresh}>
        <div>Content</div>
      </WidgetCard>
    );
    
    const refreshButton = screen.getByTitle('Refresh');
    expect(refreshButton).toBeDisabled();
  });
});

describe('QuickActionsWidget', () => {
  it('renders without crashing', () => {
    render(
      <TestWrapper>
        <QuickActionsWidget />
      </TestWrapper>
    );
    
    expect(screen.getByText('Quick Actions')).toBeInTheDocument();
  });

  it('renders default actions', () => {
    render(
      <TestWrapper>
        <QuickActionsWidget />
      </TestWrapper>
    );
    
    // Check for default action buttons
    expect(screen.getByText('New Purchase Order')).toBeInTheDocument();
    expect(screen.getByText('New Sales Order')).toBeInTheDocument();
    expect(screen.getByText('New Invoice')).toBeInTheDocument();
    expect(screen.getByText('New Customer')).toBeInTheDocument();
    expect(screen.getByText('Universal Search')).toBeInTheDocument();
    expect(screen.getByText('Manage Carriers')).toBeInTheDocument();
  });

  it('shows keyboard shortcuts', () => {
    render(
      <TestWrapper>
        <QuickActionsWidget />
      </TestWrapper>
    );
    
    expect(screen.getByText('Alt + P')).toBeInTheDocument();
    expect(screen.getByText('Ctrl + K')).toBeInTheDocument();
  });

  it('calls onOpenSearch when search action clicked', () => {
    const onOpenSearch = vi.fn();
    
    render(
      <TestWrapper>
        <QuickActionsWidget onOpenSearch={onOpenSearch} />
      </TestWrapper>
    );
    
    // Find and click the search button
    const searchButton = screen.getByText('Universal Search').closest('button');
    if (searchButton) {
      fireEvent.click(searchButton);
    }
    
    expect(onOpenSearch).toHaveBeenCalledTimes(1);
  });
});
