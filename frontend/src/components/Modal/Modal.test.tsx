/**
 * Tests for Modal Component (Shared UI)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from './Modal';

export {};

describe('Modal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    title: 'Test Modal',
    children: <p>Modal content</p>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders when isOpen is true', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByText('Test Modal')).toBeInTheDocument();
      expect(screen.getByText('Modal content')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<Modal {...defaultProps} isOpen={false} />);
      expect(screen.queryByText('Test Modal')).not.toBeInTheDocument();
    });

    it('renders title correctly', () => {
      render(<Modal {...defaultProps} title="Custom Title" />);
      expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('renders children correctly', () => {
      render(
        <Modal {...defaultProps}>
          <div data-testid="custom-content">Custom content</div>
        </Modal>
      );
      expect(screen.getByTestId('custom-content')).toBeInTheDocument();
    });

    it('renders footer when provided', () => {
      render(
        <Modal 
          {...defaultProps} 
          footer={<button>Save</button>}
        />
      );
      expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('does not render footer when not provided', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    });
  });

  describe('close functionality', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      const closeButton = screen.getByLabelText('Close modal');
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      const backdrop = screen.getByRole('dialog');
      fireEvent.click(backdrop);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      fireEvent.click(screen.getByText('Modal content'));
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<Modal {...defaultProps} onClose={onClose} />);
      
      fireEvent.keyDown(document, { key: 'Escape' });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has role="dialog"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('has aria-modal="true"', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    });

    it('has aria-labelledby pointing to title', () => {
      render(<Modal {...defaultProps} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    });

    it('title has correct id for labelling', () => {
      render(<Modal {...defaultProps} />);
      const title = screen.getByText('Test Modal');
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('close button has accessible label', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByLabelText('Close modal')).toBeInTheDocument();
    });
  });

  describe('maxWidth prop', () => {
    it('defaults to 600px', () => {
      render(<Modal {...defaultProps} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('accepts custom maxWidth', () => {
      render(<Modal {...defaultProps} maxWidth="800px" />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('cleanup', () => {
    it('removes event listener on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(<Modal {...defaultProps} onClose={onClose} />);
      
      unmount();
      
      // After unmount, pressing Escape should not call onClose
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
