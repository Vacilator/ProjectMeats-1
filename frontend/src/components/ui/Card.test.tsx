/**
 * Tests for Card Components (Design System)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardContent, CardFooter } from './Card';

export {};

describe('Card', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(
        <Card>
          <div>Card Content</div>
        </Card>
      );
      expect(screen.getByText('Card Content')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <Card className="custom-card">Content</Card>
      );
      const card = container.firstChild;
      expect(card).toHaveClass('custom-card');
    });
  });

  describe('padding variants', () => {
    it('defaults to md padding', () => {
      const { container } = render(<Card>Content</Card>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts none padding', () => {
      const { container } = render(<Card padding="none">Content</Card>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts sm padding', () => {
      const { container } = render(<Card padding="sm">Content</Card>);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('accepts lg padding', () => {
      const { container } = render(<Card padding="lg">Content</Card>);
      expect(container.firstChild).toBeInTheDocument();
    });
  });
});

describe('CardHeader', () => {
  it('renders title correctly', () => {
    render(<CardHeader title="Test Title" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders title as h3', () => {
    render(<CardHeader title="Heading" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Heading');
  });

  it('renders description when provided', () => {
    render(<CardHeader title="Title" description="A description" />);
    expect(screen.getByText('A description')).toBeInTheDocument();
  });

  it('does not render description when not provided', () => {
    render(<CardHeader title="Title" />);
    expect(screen.queryByText('A description')).not.toBeInTheDocument();
  });

  it('renders actions when provided', () => {
    render(
      <CardHeader 
        title="Title" 
        actions={<button>Action</button>} 
      />
    );
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });
});

describe('CardContent', () => {
  it('renders children correctly', () => {
    render(
      <CardContent>
        <p>Main content here</p>
      </CardContent>
    );
    expect(screen.getByText('Main content here')).toBeInTheDocument();
  });

  it('renders multiple children', () => {
    render(
      <CardContent>
        <p>First</p>
        <p>Second</p>
      </CardContent>
    );
    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
  });
});

describe('CardFooter', () => {
  it('renders children correctly', () => {
    render(
      <CardFooter>
        <button>Cancel</button>
        <button>Save</button>
      </CardFooter>
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });
});

describe('Card composition', () => {
  it('renders complete card with all parts', () => {
    render(
      <Card>
        <CardHeader 
          title="Dashboard" 
          description="Your overview"
          actions={<button>Settings</button>}
        />
        <CardContent>
          <p>Welcome to your dashboard</p>
        </CardContent>
        <CardFooter>
          <button>Refresh</button>
        </CardFooter>
      </Card>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Your overview')).toBeInTheDocument();
    expect(screen.getByText('Welcome to your dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});
