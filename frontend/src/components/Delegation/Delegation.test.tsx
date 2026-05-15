/**
 * Tests for Delegation Components
 * 
 * Tests for DelegateTaskModal and DelegationHistory components.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DelegateTaskModal } from './DelegateTaskModal';
import { DelegationHistory } from './DelegationHistory';
import type { User } from './DelegateTaskModal';
import type { DelegationRecord } from './DelegationHistory';

// ============================================================================
// TEST DATA
// ============================================================================

const mockUsers: User[] = [
  { id: '1', name: 'John Doe', email: 'john@example.com', role: 'Manager', department: 'Engineering' },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', role: 'Developer', department: 'Engineering' },
  { id: '3', name: 'Bob Jones', email: 'bob@example.com', role: 'Analyst', department: 'Finance' },
  { id: '4', name: 'Alice Brown', email: 'alice@example.com', role: 'Designer', department: 'Design' },
];

const _mockCurrentAssignee: User = {
  id: '5',
  name: 'Current User',
  email: 'current@example.com',
};

const mockDelegations: DelegationRecord[] = [
  {
    id: 'd1',
    fromUser: { id: '1', name: 'John Doe' },
    toUser: { id: '2', name: 'Jane Smith' },
    delegatedAt: '2024-01-15T10:00:00Z',
    reason: 'On vacation, please handle',
    dueDate: '2024-01-20',
    status: 'active',
  },
  {
    id: 'd2',
    fromUser: { id: '3', name: 'Bob Jones' },
    toUser: { id: '1', name: 'John Doe' },
    delegatedAt: '2024-01-10T08:00:00Z',
    status: 'completed',
    completedAt: '2024-01-12T14:00:00Z',
  },
  {
    id: 'd3',
    fromUser: { id: '2', name: 'Jane Smith' },
    toUser: { id: '4', name: 'Alice Brown' },
    delegatedAt: '2024-01-05T09:00:00Z',
    reason: 'Need design expertise',
    status: 'revoked',
  },
];

// ============================================================================
// DELEGATETASKMODAL TESTS
// ============================================================================

describe('DelegateTaskModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onDelegate: vi.fn().mockResolvedValue(undefined),
    taskName: 'Review Q4 Report',
    availableUsers: mockUsers,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders modal when open', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Review Q4 Report')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<DelegateTaskModal {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Delegate Task')).not.toBeInTheDocument();
  });

  it('displays available users in list', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
  });

  it('filters users by search query', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'Jane' } });
    
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
    expect(screen.queryByText('Bob Jones')).not.toBeInTheDocument();
  });

  it('filters users by email', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'bob@' } });
    
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('filters users by role', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'designer' } });
    
    expect(screen.getByText('Alice Brown')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('filters users by department', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'finance' } });
    
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
    expect(screen.queryByText('John Doe')).not.toBeInTheDocument();
  });

  it('excludes current assignee from user list', () => {
    render(
      <DelegateTaskModal 
        {...defaultProps} 
        currentAssignee={mockUsers[0]} 
      />
    );
    
    // John Doe (id: '1') should not be in the list
    const johnDoeElements = screen.queryAllByText('John Doe');
    expect(johnDoeElements.length).toBe(0);
  });

  it('allows selecting a user', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const userOption = screen.getByText('Jane Smith').closest('[role="option"]');
    fireEvent.click(userOption!);
    
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('calls onDelegate with correct data', async () => {
    const onDelegate = vi.fn().mockResolvedValue(undefined);
    render(<DelegateTaskModal {...defaultProps} onDelegate={onDelegate} />);
    
    // Select user
    const userOption = screen.getByText('Jane Smith').closest('[role="option"]');
    fireEvent.click(userOption!);
    
    // Fill reason
    const reasonInput = screen.getByPlaceholderText(/explain why/i);
    fireEvent.change(reasonInput, { target: { value: 'Need coverage' } });
    
    // Set due date
    const dateInput = screen.getByLabelText(/new due date/i);
    fireEvent.change(dateInput, { target: { value: '2024-02-01' } });
    
    // Submit - find button by role
    const delegateButton = screen.getByRole('button', { name: 'Delegate Task' });
    fireEvent.click(delegateButton);
    
    await waitFor(() => {
      expect(onDelegate).toHaveBeenCalledWith({
        delegateUserId: '2',
        delegateUser: mockUsers[1],
        reason: 'Need coverage',
        dueDate: '2024-02-01',
        notifyOriginalAssignee: true,
        retainAccess: false,
      });
    });
  });

  it('disables delegate button when no user selected', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const delegateButton = screen.getByRole('button', { name: 'Delegate Task' });
    expect(delegateButton).toBeDisabled();
  });

  it('enables delegate button when user is selected', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const userOption = screen.getByText('Jane Smith').closest('[role="option"]');
    fireEvent.click(userOption!);
    
    const delegateButton = screen.getByRole('button', { name: 'Delegate Task' });
    expect(delegateButton).not.toBeDisabled();
  });

  it('calls onClose when cancel is clicked', () => {
    const onClose = vi.fn();
    render(<DelegateTaskModal {...defaultProps} onClose={onClose} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn();
    render(<DelegateTaskModal {...defaultProps} onClose={onClose} />);
    
    const closeButton = screen.getByLabelText('Close modal');
    fireEvent.click(closeButton);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when overlay is clicked', () => {
    const onClose = vi.fn();
    const { container } = render(<DelegateTaskModal {...defaultProps} onClose={onClose} />);
    
    // Click overlay (the outermost div)
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    
    expect(onClose).toHaveBeenCalled();
  });

  it('toggles notification checkbox', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const checkbox = screen.getByLabelText(/notify original assignee/i);
    expect(checkbox).toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });

  it('toggles retain access checkbox', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const checkbox = screen.getByLabelText(/retain view access/i);
    expect(checkbox).not.toBeChecked();
    
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
  });

  it('shows no results message when search yields nothing', () => {
    render(<DelegateTaskModal {...defaultProps} />);
    
    const searchInput = screen.getByPlaceholderText(/search by name/i);
    fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
    
    expect(screen.getByText(/no users found/i)).toBeInTheDocument();
  });

  it('shows loading state during submission', async () => {
    const slowDelegate = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    render(<DelegateTaskModal {...defaultProps} onDelegate={slowDelegate} />);
    
    // Select user
    const userOption = screen.getByText('Jane Smith').closest('[role="option"]');
    fireEvent.click(userOption!);
    
    // Submit - find the button, not the title
    const delegateButton = screen.getByRole('button', { name: 'Delegate Task' });
    fireEvent.click(delegateButton);
    
    expect(screen.getByText('Delegating...')).toBeInTheDocument();
  });
});

// ============================================================================
// DELEGATIONHISTORY TESTS
// ============================================================================

describe('DelegationHistory', () => {
  it('renders delegation records', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    // Names appear multiple times (from and to), just check they exist
    expect(screen.getAllByText('John Doe').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jane Smith').length).toBeGreaterThan(0);
  });

  it('shows empty state when no delegations', () => {
    render(<DelegationHistory delegations={[]} />);
    
    expect(screen.getByText(/no delegation history/i)).toBeInTheDocument();
  });

  it('displays status badges correctly', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Revoked')).toBeInTheDocument();
  });

  it('displays delegation reasons', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    expect(screen.getByText(/"On vacation, please handle"/)).toBeInTheDocument();
    expect(screen.getByText(/"Need design expertise"/)).toBeInTheDocument();
  });

  it('displays due dates when present', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    expect(screen.getByText(/Due Jan 20/)).toBeInTheDocument();
  });

  it('displays completion dates when present', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    expect(screen.getByText(/Completed Jan 12/)).toBeInTheDocument();
  });

  it('shows revoke button for active delegations by current user', () => {
    const onRevoke = vi.fn();
    render(
      <DelegationHistory 
        delegations={mockDelegations}
        currentUserId="1"
        onRevoke={onRevoke}
      />
    );
    
    expect(screen.getByText('Revoke Delegation')).toBeInTheDocument();
  });

  it('hides revoke button for delegations by other users', () => {
    const onRevoke = vi.fn();
    render(
      <DelegationHistory 
        delegations={mockDelegations}
        currentUserId="99"
        onRevoke={onRevoke}
      />
    );
    
    expect(screen.queryByText('Revoke Delegation')).not.toBeInTheDocument();
  });

  it('hides revoke button for non-active delegations', () => {
    const onRevoke = vi.fn();
    const completedOnly: DelegationRecord[] = [
      { ...mockDelegations[1], fromUser: { id: '1', name: 'John Doe' } },
    ];
    
    render(
      <DelegationHistory 
        delegations={completedOnly}
        currentUserId="1"
        onRevoke={onRevoke}
      />
    );
    
    expect(screen.queryByText('Revoke Delegation')).not.toBeInTheDocument();
  });

  it('calls onRevoke when revoke button clicked', () => {
    const onRevoke = vi.fn();
    render(
      <DelegationHistory 
        delegations={mockDelegations}
        currentUserId="1"
        onRevoke={onRevoke}
      />
    );
    
    const revokeButton = screen.getByText('Revoke Delegation');
    fireEvent.click(revokeButton);
    
    expect(onRevoke).toHaveBeenCalledWith('d1');
  });

  it('displays user initials when no avatar', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    // John Doe -> JD, Jane Smith -> JS
    expect(screen.getAllByText('JD').length).toBeGreaterThan(0);
    expect(screen.getAllByText('JS').length).toBeGreaterThan(0);
  });

  it('applies custom className', () => {
    const { container } = render(
      <DelegationHistory delegations={mockDelegations} className="custom-history" />
    );
    
    expect(container.querySelector('.custom-history')).toBeInTheDocument();
  });

  it('shows delegation flow arrow', () => {
    render(<DelegationHistory delegations={mockDelegations} />);
    
    const arrows = screen.getAllByText('→');
    expect(arrows.length).toBe(mockDelegations.length);
  });
});
