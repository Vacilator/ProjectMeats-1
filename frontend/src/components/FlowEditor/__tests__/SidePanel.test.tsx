/**
 * Unit Tests for SidePanel Component
 * 
 * Tests the portal-based side panel wrapper used for config modals.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SidePanel } from '../SidePanel';

describe('SidePanel', () => {
  const mockOnClose = vi.fn();
  const testContent = <div>Test Content</div>;

  beforeEach(() => {
    mockOnClose.mockClear();
  });

  it('renders nothing when isOpen is false', () => {
    render(
      <SidePanel isOpen={false} onClose={mockOnClose}>
        {testContent}
      </SidePanel>
    );
    
    expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
  });

  it('renders content when isOpen is true', () => {
    render(
      <SidePanel isOpen={true} onClose={mockOnClose}>
        {testContent}
      </SidePanel>
    );
    
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('calls onClose when Escape key is pressed', () => {
    render(
      <SidePanel isOpen={true} onClose={mockOnClose}>
        {testContent}
      </SidePanel>
    );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    render(
      <SidePanel isOpen={true} onClose={mockOnClose}>
        {testContent}
      </SidePanel>
    );
    
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('renders portal to document.body', () => {
    render(
      <SidePanel isOpen={true} onClose={mockOnClose}>
        <div data-testid="portal-content">Portal Content</div>
      </SidePanel>
    );
    
    const portalContent = screen.getByTestId('portal-content');
    expect(portalContent).toBeInTheDocument();
  });
});
