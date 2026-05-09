/**
 * EntityEdge Component Tests (Wave 2: Cockpit Command Center)
 */
import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EntityEdge from './EntityEdge';

// Mock @xyflow/react with all needed exports
vi.mock('@xyflow/react', () => ({
  getBezierPath: vi.fn(() => ['M 0 0 C 50 0, 50 100, 100 100', 50, 50]),
  EdgeLabelRenderer: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  BaseEdge: ({ id, path, style }: any) => (
    <path data-testid={`edge-${id}`} d={path} style={style} />
  ),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  Position: {
    Top: 'top',
    Bottom: 'bottom',
    Left: 'left',
    Right: 'right',
  },
}));

const defaultProps = {
  id: 'edge-1',
  sourceX: 0,
  sourceY: 0,
  targetX: 100,
  targetY: 100,
  sourcePosition: 'bottom' as const,
  targetPosition: 'top' as const,
  source: 'node-1',
  target: 'node-2',
};

describe('EntityEdge', () => {
  it('renders without crashing', () => {
    const { container } = render(
      <svg>
        <EntityEdge {...defaultProps} />
      </svg>
    );
    expect(container.querySelector('[data-testid="edge-edge-1"]')).toBeInTheDocument();
  });

  it('renders with label', () => {
    const { getByText } = render(
      <svg>
        <EntityEdge 
          {...defaultProps} 
          data={{ label: 'supplies', relationship: 'supplies' }}
        />
      </svg>
    );
    expect(getByText('supplies')).toBeInTheDocument();
  });

  it('applies correct color for supplies relationship', () => {
    const { container } = render(
      <svg>
        <EntityEdge 
          {...defaultProps} 
          data={{ label: 'supplies', relationship: 'supplies' }}
        />
      </svg>
    );
    const edge = container.querySelector('[data-testid="edge-edge-1"]');
    expect(edge).toHaveStyle({ stroke: 'rgb(var(--color-success))' });
  });

  it('applies correct color for purchases relationship', () => {
    const { container } = render(
      <svg>
        <EntityEdge 
          {...defaultProps} 
          data={{ label: 'purchases', relationship: 'purchases' }}
        />
      </svg>
    );
    const edge = container.querySelector('[data-testid="edge-edge-1"]');
    expect(edge).toHaveStyle({ stroke: 'rgb(var(--color-info))' });
  });

  it('uses default color for unknown relationship', () => {
    const { container } = render(
      <svg>
        <EntityEdge 
          {...defaultProps} 
          data={{ label: 'unknown', relationship: 'unknown_type' }}
        />
      </svg>
    );
    const edge = container.querySelector('[data-testid="edge-edge-1"]');
    expect(edge).toHaveStyle({ stroke: 'rgb(var(--color-text-tertiary))' });
  });

  it('renders without label when not provided', () => {
    const { container } = render(
      <svg>
        <EntityEdge {...defaultProps} data={{}} />
      </svg>
    );
    // Should only have the edge path, no label
    expect(container.querySelectorAll('[data-testid="edge-edge-1"]')).toHaveLength(1);
  });
});
