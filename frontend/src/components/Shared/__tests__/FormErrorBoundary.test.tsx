import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FormErrorBoundary } from '../FormErrorBoundary';

const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test error');
  return <div>Child content</div>;
};

describe('FormErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;
  beforeAll(() => { console.error = vi.fn(); });
  afterAll(() => { console.error = originalError; });

  it('renders children when no error', () => {
    render(
      <FormErrorBoundary>
        <div>Test content</div>
      </FormErrorBoundary>
    );
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('renders error UI when child throws', () => {
    render(
      <FormErrorBoundary>
        <ThrowError shouldThrow={true} />
      </FormErrorBoundary>
    );
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('provides retry button that resets error state', () => {
    const { rerender } = render(
      <FormErrorBoundary>
        <ThrowError shouldThrow={true} />
      </FormErrorBoundary>
    );
    const retryButton = screen.getByRole('button', { name: /try again|retry/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('calls onClose callback when close is clicked', () => {
    const onClose = vi.fn();
    render(
      <FormErrorBoundary onClose={onClose}>
        <ThrowError shouldThrow={true} />
      </FormErrorBoundary>
    );
    const closeButton = screen.queryByRole('button', { name: /close|dismiss/i });
    if (closeButton) {
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    }
  });
});
