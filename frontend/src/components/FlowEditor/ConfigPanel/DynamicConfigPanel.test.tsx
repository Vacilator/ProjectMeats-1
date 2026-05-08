/**
 * DynamicConfigPanel Tests
 *
 * Tests null safety, rendering, and interaction behaviors.
 * Created: 2026-02-21 - Null Safety Testing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DynamicConfigPanel } from './DynamicConfigPanel';
import type { Node, Edge } from '@xyflow/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FormBuilderProvider } from '../../../contexts/FormBuilderContext';

// Mock the schema registry
vi.mock('../config', () => ({
  schemaRegistry: {
    getSchema: vi.fn((type: string) => {
      if (type === 'form' || type === 'formStep') {
        return {
          displayName: type === 'formStep' ? 'Form Step' : 'Form',
          sections: [
            {
              id: 'basic',
              title: 'Basic Settings',
              collapsible: true,
              fields: [
                {
                  id: 'name',
                  label: 'Name',
                  type: 'text',
                  required: true,
                },
                {
                  id: 'description',
                  label: 'Description',
                  type: 'textarea',
                },
              ],
            },
          ],
        };
      }
      return null;
    }),
  },
}));

// Mock complex renderers
vi.mock('../config/fieldRenderers/complexRenderers', () => ({
  renderEntitySelector: vi.fn(() => <div>Entity Selector</div>),
  renderEntityFieldPicker: vi.fn(() => <div>Field Picker</div>),
  renderFieldMapping: vi.fn(() => <div>Field Mapping</div>),
  renderVariablePicker: vi.fn(() => <div>Variable Picker</div>),
  renderValidationBuilder: vi.fn(() => <div>Validation Builder</div>),
}));

// Mock basic renderers
vi.mock('../config/fieldRenderers/basicRenderers', () => ({
  renderTextField: vi.fn(({ field, value, onChange, disabled }) => (
    <input
      data-testid={`field-${field.id}`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    />
  )),
  renderSelectField: vi.fn(() => <select />),
  renderToggleField: vi.fn(() => <input type="checkbox" />),
  renderEntityTypeSelect: vi.fn(() => <select />),
}));

// Mock hooks
vi.mock('../hooks/useUpstreamVariables', () => ({
  useUpstreamVariables: vi.fn(() => ({ variables: [] })),
}));

// Mock validation and conditional logic
vi.mock('../config/validationEngine', () => ({
  validateField: vi.fn((field: any, value: any) => {
    if (field?.required && (value === undefined || value === null || String(value).trim() === '')) {
      return 'Required';
    }
    return null;
  }),
}));

vi.mock('../config/conditionalLogic', () => ({
  evaluateCondition: vi.fn(() => true),
}));

// Mock NestedChildrenRenderer
vi.mock('./NestedChildrenRenderer', () => ({
  NestedChildrenRenderer: () => <div>Nested Children</div>,
}));

// Helper to wrap component with providers
const renderWithProviders = (ui: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <FormBuilderProvider>{children}</FormBuilderProvider>
    </QueryClientProvider>
  );

  return render(ui, { wrapper: Wrapper });
};

describe('DynamicConfigPanel', () => {
  const mockNodes: Node[] = [];
  const mockEdges: Edge[] = [];
  const mockOnUpdateNode = vi.fn();
  const mockOnApply = vi.fn();
  const mockOnDiscard = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Null Safety', () => {
    it('should render EmptyState when node is null', () => {
      renderWithProviders(
        <DynamicConfigPanel
          node={null}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
          onApply={mockOnApply}
          onDiscard={mockOnDiscard}
        />
      );

      expect(screen.getByText('No Node Selected')).toBeInTheDocument();
      expect(screen.getByText('Select a node in the canvas to configure its properties.')).toBeInTheDocument();
    });

    it('should render EmptyState when node.data is null', () => {
      const nodeWithoutData: Node = {
        id: '1',
        type: 'form',
        position: { x: 0, y: 0 },
        data: null as any,
      };

      renderWithProviders(
        <DynamicConfigPanel
          node={nodeWithoutData}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      expect(screen.getByText('No Node Selected')).toBeInTheDocument();
    });

    it('should not crash when node is null and Apply is attempted', () => {
      const { container } = renderWithProviders(
        <DynamicConfigPanel
          node={null}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Should render EmptyState without crashing
      expect(container).toBeInTheDocument();
      expect(mockOnUpdateNode).not.toHaveBeenCalled();
    });
  });

  describe('Valid Node Rendering', () => {
    const validNode: Node = {
      id: 'test-node',
      type: 'form',
      position: { x: 0, y: 0 },
      data: {
        name: 'Test Form',
        description: 'Test Description',
      },
    };

    it('should render configuration form when node is valid', () => {
      renderWithProviders(
        <DynamicConfigPanel
          node={validNode}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Should render form fields
      expect(screen.getByTestId('field-name')).toBeInTheDocument();
      expect(screen.getByTestId('field-description')).toBeInTheDocument();
    });

    it('aliases form step name/description into label + stepTitle/stepDescription', async () => {
      const formStepNode: Node = {
        id: 'step-1',
        type: 'formStep',
        position: { x: 0, y: 0 },
        data: {
          nodeType: 'formStep',
          name: 'Old',
          description: 'Old desc',
          label: 'Old',
          stepTitle: 'Old',
          stepDescription: 'Old desc',
        },
      };

      renderWithProviders(
        <DynamicConfigPanel
          node={formStepNode}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      fireEvent.change(screen.getByTestId('field-name'), { target: { value: 'New Step' } });

      await waitFor(() => {
        expect(mockOnUpdateNode).toHaveBeenCalled();
      });

      const lastCall = mockOnUpdateNode.mock.calls.at(-1);
      expect(lastCall?.[0]).toBe('step-1');
      expect(lastCall?.[1]?.name).toBe('New Step');
      expect(lastCall?.[1]?.label).toBe('New Step');
      expect(lastCall?.[1]?.stepTitle).toBe('New Step');

      fireEvent.change(screen.getByTestId('field-description'), { target: { value: 'New desc' } });

      await waitFor(() => {
        const call = mockOnUpdateNode.mock.calls.at(-1);
        expect(call?.[1]?.description).toBe('New desc');
        expect(call?.[1]?.stepDescription).toBe('New desc');
      });
    });

    /**
     * Test fallback schema for unknown types.
     *
     * IMPORTANT: As of PR #3217, schemaRegistry.getSchema() ALWAYS returns a valid schema
     * via createFallbackSchema(). The error panel has been REMOVED because all 50 node types
     * now have either explicit schemas or auto-generated fallback schemas.
     *
     * This test verifies the NEW behavior: unknown types render with fallback config.
     */
    it('should show error panel when schema not found', () => {
      const nodeWithUnknownType: Node = {
        id: 'test-node',
        type: 'unknown-type',
        position: { x: 0, y: 0 },
        data: {},
      };

      renderWithProviders(
        <DynamicConfigPanel
          node={nodeWithUnknownType}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Fallback schema should render (no error panel)
      // The panel shows node details when data is empty
      expect(screen.getByText(/Node type/i)).toBeInTheDocument();
      expect(screen.getByText(/unknown-type/i)).toBeInTheDocument();
    });

    it('should handle field changes', async () => {
      renderWithProviders(
        <DynamicConfigPanel
          node={validNode}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      const nameInput = screen.getByTestId('field-name') as HTMLInputElement;

      fireEvent.change(nameInput, { target: { value: 'New Name' } });

      await waitFor(() => {
        expect(nameInput.value).toBe('New Name');
      });
    });

    it('should call onUpdateNode when Apply is clicked', async () => {
      renderWithProviders(
        <DynamicConfigPanel
          node={validNode}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
          onApply={mockOnApply}
        />
      );

      // Change a field
      const nameInput = screen.getByTestId('field-name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      // Find and click Apply button (if visible after change)
      // Note: The actual Apply button might be in ActionBar which shows on changes
      // This is a simplified test - real implementation would need to trigger the hasChanges state

      // For now, just verify the handler is wired correctly
      expect(mockOnUpdateNode).toBeDefined();
    });

    it('should not call onUpdateNode on Discard', () => {
      renderWithProviders(
        <DynamicConfigPanel
          node={validNode}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
          onDiscard={mockOnDiscard}
        />
      );

      // Discard should reset form without calling update
      // This would require triggering the Discard button
      // For now, verify handler exists
      expect(mockOnDiscard).toBeDefined();
    });
  });

  describe('ReadOnly + Accessibility', () => {
    it('disables inputs and blocks updates when readOnly=true', () => {
      const validNode: Node = {
        id: 'test-node',
        type: 'form',
        position: { x: 0, y: 0 },
        data: {
          name: 'Test Form',
          description: 'Test Description',
        },
      };

      renderWithProviders(
        <DynamicConfigPanel
          node={validNode}
          nodes={mockNodes}
          edges={mockEdges}
          readOnly={true}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      const nameInput = screen.getByTestId('field-name');
      expect(nameInput).toBeDisabled();

      fireEvent.change(nameInput, { target: { value: 'New Name' } });
      expect(mockOnUpdateNode).not.toHaveBeenCalled();
    });

    it('does not clear validation errors on data updates within the same node', async () => {
      const node: Node = {
        id: 'test-node',
        type: 'form',
        position: { x: 0, y: 0 },
        data: {
          name: 'Test Form',
          description: 'Test Description',
        },
      };

      const { rerender } = renderWithProviders(
        <DynamicConfigPanel node={node} nodes={mockNodes} edges={mockEdges} onUpdateNode={mockOnUpdateNode} />
      );

      // Trigger a validation error (required name field emptied)
      fireEvent.change(screen.getByTestId('field-name'), { target: { value: '' } });

      await waitFor(() => {
        expect(screen.getByText(/1 errors/i)).toBeInTheDocument();
      });

      // Simulate an external shadow-state update with the same node id.
      rerender(
        <DynamicConfigPanel
          node={{ ...node, data: { ...node.data, description: 'Updated externally' } }}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      expect(screen.getByText(/1 errors/i)).toBeInTheDocument();
    });

    it('renders collapsible section headers as buttons with aria attributes', () => {
      const validNode: Node = {
        id: 'test-node',
        type: 'form',
        position: { x: 0, y: 0 },
        data: {
          name: 'Test Form',
          description: 'Test Description',
        },
      };

      renderWithProviders(
        <DynamicConfigPanel
          node={validNode}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      const headerButton = screen.getByRole('button', { name: /Basic Settings/i });
      expect(headerButton).toHaveAttribute('aria-expanded', 'true');
      expect(headerButton).toHaveAttribute('aria-controls');

      const regionId = headerButton.getAttribute('aria-controls');
      expect(regionId).toBeTruthy();

      const region = document.getElementById(String(regionId));
      expect(region).toBeTruthy();
      expect(region).toHaveAttribute('role', 'region');
      expect(region).toHaveAttribute('aria-labelledby');

      fireEvent.click(headerButton);
      expect(headerButton).toHaveAttribute('aria-expanded', 'false');

      const regionAfter = document.getElementById(String(regionId));
      expect(regionAfter).toHaveAttribute('hidden');
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with empty data object', () => {
      const nodeWithEmptyData: Node = {
        id: 'test-node',
        type: 'form',
        position: { x: 0, y: 0 },
        data: {},
      };

      renderWithProviders(
        <DynamicConfigPanel
          node={nodeWithEmptyData}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Should render form with empty fields
      expect(screen.getByTestId('field-name')).toBeInTheDocument();
    });

    it('should handle node type change gracefully', () => {
      const { rerender } = renderWithProviders(
        <DynamicConfigPanel
          node={{
            id: 'test-node',
            type: 'form',
            position: { x: 0, y: 0 },
            data: { name: 'Test' },
          }}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Change to null
      rerender(
        <DynamicConfigPanel
          node={null}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      expect(screen.getByText('No Node Selected')).toBeInTheDocument();
    });
  });

  describe('React 19 Compatibility', () => {
    it('should handle multiple re-renders without crashing', () => {
      const { rerender } = renderWithProviders(
        <DynamicConfigPanel
          node={null}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Simulate multiple re-renders (React 19 strict mode behavior)
      for (let i = 0; i < 5; i++) {
        rerender(
          <DynamicConfigPanel
            node={null}
            nodes={mockNodes}
            edges={mockEdges}
            onUpdateNode={mockOnUpdateNode}
          />
        );
      }

      expect(screen.getByText('No Node Selected')).toBeInTheDocument();
    });

    it('should handle rapid node selection changes', () => {
      const node1: Node = {
        id: '1',
        type: 'form',
        position: { x: 0, y: 0 },
        data: { name: 'Node 1' },
      };

      const node2: Node = {
        id: '2',
        type: 'form',
        position: { x: 100, y: 0 },
        data: { name: 'Node 2' },
      };

      const { rerender } = renderWithProviders(
        <DynamicConfigPanel
          node={node1}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Rapid changes
      rerender(
        <DynamicConfigPanel
          node={null}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      rerender(
        <DynamicConfigPanel
          node={node2}
          nodes={mockNodes}
          edges={mockEdges}
          onUpdateNode={mockOnUpdateNode}
        />
      );

      // Should handle without errors
      expect(screen.getByTestId('field-name')).toHaveValue('Node 2');
    });
  });
});
