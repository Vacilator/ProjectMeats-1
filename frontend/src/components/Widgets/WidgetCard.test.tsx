/**
 * WidgetCard Component Tests
 * 
 * Tests for dashboard widget card wrapper:
 * - Title and icon rendering
 * - Loading state display
 * - Error state display
 * - Refresh functionality
 * - Custom actions
 * - Padding options
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WidgetCard } from './WidgetCard';
import { Activity } from 'lucide-react';

describe('WidgetCard', () => {
  describe('Basic Rendering', () => {
    it('should render title', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Test Widget')).toBeInTheDocument();
    });

    it('should render children content', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Widget Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Widget Content')).toBeInTheDocument();
    });

    it('should render icon when provided', () => {
      render(
        <WidgetCard title="Test Widget" icon={<Activity data-testid="icon" />}>
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
      const { container } = render(
        <WidgetCard title="Test Widget" className="custom-class">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });
  });

  describe('Loading State', () => {
    it('should show loading overlay when loading', () => {
      render(
        <WidgetCard title="Test Widget" loading={true}>
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    it('should not show loading when loading is false', () => {
      render(
        <WidgetCard title="Test Widget" loading={false}>
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should show error message when error provided', () => {
      render(
        <WidgetCard title="Test Widget" error="Failed to load data">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Failed to load data')).toBeInTheDocument();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });

    it('should not show error when error is null', () => {
      render(
        <WidgetCard title="Test Widget" error={null}>
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should prioritize loading over error', () => {
      render(
        <WidgetCard title="Test Widget" loading={true} error="Error message">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Error message')).not.toBeInTheDocument();
    });
  });

  describe('Refresh Functionality', () => {
    it('should show refresh button when onRefresh provided', () => {
      const onRefresh = vi.fn();
      render(
        <WidgetCard title="Test Widget" onRefresh={onRefresh}>
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });

    it('should not show refresh button when onRefresh not provided', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.queryByTitle('Refresh')).not.toBeInTheDocument();
    });

    it('should call onRefresh when refresh button clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();
      
      render(
        <WidgetCard title="Test Widget" onRefresh={onRefresh}>
          <div>Content</div>
        </WidgetCard>
      );
      
      await user.click(screen.getByTitle('Refresh'));
      
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('should disable refresh button when loading', () => {
      const onRefresh = vi.fn();
      render(
        <WidgetCard title="Test Widget" onRefresh={onRefresh} loading={true}>
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByTitle('Refresh')).toBeDisabled();
    });
  });

  describe('Custom Actions', () => {
    it('should render custom actions', () => {
      render(
        <WidgetCard 
          title="Test Widget" 
          actions={<button data-testid="custom-action">Action</button>}
        >
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
    });

    it('should render actions alongside refresh button', () => {
      const onRefresh = vi.fn();
      render(
        <WidgetCard 
          title="Test Widget" 
          onRefresh={onRefresh}
          actions={<button data-testid="custom-action">Action</button>}
        >
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByTestId('custom-action')).toBeInTheDocument();
      expect(screen.getByTitle('Refresh')).toBeInTheDocument();
    });
  });

  describe('Padding Options', () => {
    it('should render content when noPadding is false', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Content</div>
        </WidgetCard>
      );
      
      // Just verify content renders - styled-components handles the styling
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should render content when noPadding is true', () => {
      render(
        <WidgetCard title="Test Widget" noPadding={true}>
          <div>Content</div>
        </WidgetCard>
      );
      
      // Just verify content renders - styled-components handles the styling
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('Default Props', () => {
    it('should have default loading as false', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('should have default error as null', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('should render normally with default props', () => {
      render(
        <WidgetCard title="Test Widget">
          <div>Content</div>
        </WidgetCard>
      );
      
      expect(screen.getByText('Test Widget')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });
});
