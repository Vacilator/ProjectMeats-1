/**
 * AdminTable Component Tests
 * 
 * Tests for the AdminTable component to ensure:
 * - Actions array is properly handled
 * - Hidden actions are filtered correctly
 * - Non-array actions don't cause errors
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdminTable } from './AdminTable';

interface TestData {
  id: number;
  name: string;
  email: string;
}

describe('AdminTable', () => {
  const mockData: TestData[] = [
    { id: 1, name: 'John Doe', email: 'john@example.com' },
    { id: 2, name: 'Jane Smith', email: 'jane@example.com' },
  ];

  const mockColumns = [
    { key: 'name' as const, label: 'Name', sortable: true },
    { key: 'email' as const, label: 'Email', sortable: true },
  ];

  it('renders table with data', () => {
    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
  });

  it('handles undefined actions gracefully', () => {
    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
        actions={undefined}
      />
    );

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('filters hidden actions correctly', () => {
    const mockOnClick = vi.fn();
    const actions = [
      {
        label: 'Edit',
        onClick: mockOnClick,
      },
      {
        label: 'Delete',
        onClick: mockOnClick,
        hidden: (row: TestData) => row.id === 1,
      },
    ];

    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
        actions={actions}
      />
    );

    // Both rows should have Edit button
    const editButtons = screen.getAllByText('Edit');
    expect(editButtons).toHaveLength(2);

    // Only row 2 should have Delete button (row 1 has it hidden)
    const deleteButtons = screen.getAllByText('Delete');
    expect(deleteButtons).toHaveLength(1);
  });

  it('handles actions without hidden property', () => {
    const mockOnClick = vi.fn();
    const actions = [
      {
        label: 'View',
        onClick: mockOnClick,
      },
    ];

    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
        actions={actions}
      />
    );

    const viewButtons = screen.getAllByText('View');
    expect(viewButtons).toHaveLength(2);
  });

  it('handles empty data array', () => {
    render(
      <AdminTable
        columns={mockColumns}
        data={[]}
        emptyState={{
          icon: '📋',
          title: 'No data',
          message: 'No data available.',
        }}
      />
    );

    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('calls onClick when action button is clicked', () => {
    const mockOnClick = vi.fn();
    const actions = [
      {
        label: 'Edit',
        onClick: mockOnClick,
      },
    ];

    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
        actions={actions}
      />
    );

    const editButtons = screen.getAllByText('Edit');
    fireEvent.click(editButtons[0]);

    expect(mockOnClick).toHaveBeenCalledWith(mockData[0]);
  });

  it('handles loading state', () => {
    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
        loading={true}
      />
    );

    // Loading skeleton should be present
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('handles selectable rows', () => {
    const mockOnSelectionChange = vi.fn();

    render(
      <AdminTable
        columns={mockColumns}
        data={mockData}
        selectable={true}
        onSelectionChange={mockOnSelectionChange}
      />
    );

    const checkboxes = screen.getAllByRole('checkbox');
    // Should have 3 checkboxes: 1 for select all + 2 for each row
    expect(checkboxes).toHaveLength(3);

    fireEvent.click(checkboxes[1]); // Click first row checkbox
    expect(mockOnSelectionChange).toHaveBeenCalledWith([1]);
  });

  it('does not crash with non-array actions (edge case)', () => {
    // This test ensures we don't crash if actions is accidentally not an array
    // TypeScript would normally prevent this, but we want runtime safety
    const invalidActions = {} as any;

    expect(() => {
      render(
        <AdminTable
          columns={mockColumns}
          data={mockData}
          actions={invalidActions}
        />
      );
    }).not.toThrow();
  });
});
