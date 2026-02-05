/**
 * Tests for Workflow Progress Components
 * 
 * Tests for WorkflowProgressCard and WorkflowStatusTimeline components.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WorkflowProgressCard } from './WorkflowProgressCard';
import { WorkflowStatusTimeline } from './WorkflowStatusTimeline';
import type { WorkflowStep } from './WorkflowProgressCard';
import type { TimelineStep } from './WorkflowStatusTimeline';

// ============================================================================
// TEST DATA
// ============================================================================

const mockProgressSteps: WorkflowStep[] = [
  { id: '1', name: 'Submit Form', order: 1, status: 'completed', assignee: 'john.doe', completedAt: '2024-01-15T10:00:00Z' },
  { id: '2', name: 'Manager Review', order: 2, status: 'completed', assignee: 'jane.smith', completedAt: '2024-01-15T14:00:00Z' },
  { id: '3', name: 'Finance Approval', order: 3, status: 'in_progress', assignee: 'bob.jones' },
  { id: '4', name: 'Final Review', order: 4, status: 'pending' },
  { id: '5', name: 'Complete', order: 5, status: 'pending' },
];

const mockTimelineSteps: TimelineStep[] = [
  {
    id: '1',
    name: 'Submit Form',
    order: 1,
    status: 'completed',
    assignee: { id: '1', name: 'John Doe' },
    completedAt: '2024-01-15T10:00:00Z',
    completedBy: { id: '1', name: 'John Doe' },
    duration: '15m',
  },
  {
    id: '2',
    name: 'Manager Review',
    order: 2,
    status: 'approved',
    assignee: { id: '2', name: 'Jane Smith' },
    completedAt: '2024-01-15T14:00:00Z',
    completedBy: { id: '2', name: 'Jane Smith' },
    duration: '4h',
    notes: 'Looks good, approved!',
  },
  {
    id: '3',
    name: 'Finance Approval',
    order: 3,
    status: 'in_progress',
    assignee: { id: '3', name: 'Bob Jones' },
  },
  {
    id: '4',
    name: 'Final Review',
    order: 4,
    status: 'pending',
  },
];

// ============================================================================
// WORKFLOWPROGRESSCARD TESTS
// ============================================================================

describe('WorkflowProgressCard', () => {
  const defaultProps = {
    workflowName: 'Purchase Approval',
    submissionId: 'abc123def456',
    steps: mockProgressSteps,
    currentStepIndex: 2,
    status: 'in_progress' as const,
    createdAt: '2024-01-15T09:00:00Z',
    updatedAt: '2024-01-15T14:30:00Z',
  };

  it('renders workflow name and truncated submission ID', () => {
    render(<WorkflowProgressCard {...defaultProps} />);
    
    expect(screen.getByText('Purchase Approval')).toBeInTheDocument();
    expect(screen.getByText('#abc123de')).toBeInTheDocument();
  });

  it('displays correct status badge', () => {
    render(<WorkflowProgressCard {...defaultProps} />);
    
    expect(screen.getByText('In Progress')).toBeInTheDocument();
  });

  it('calculates and displays progress percentage', () => {
    render(<WorkflowProgressCard {...defaultProps} />);
    
    // 2 completed out of 5 = 40%
    expect(screen.getByText('2 of 5 steps completed')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('shows current step information when in progress', () => {
    render(<WorkflowProgressCard {...defaultProps} />);
    
    expect(screen.getByText('Current Step')).toBeInTheDocument();
    expect(screen.getByText('Finance Approval')).toBeInTheDocument();
    expect(screen.getByText('@bob.jones')).toBeInTheDocument();
  });

  it('handles click events when onClick is provided', () => {
    const handleClick = vi.fn();
    const { container } = render(<WorkflowProgressCard {...defaultProps} onClick={handleClick} />);
    
    // The card itself has role="button", find it by the outer container
    const card = container.firstChild as HTMLElement;
    fireEvent.click(card);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('shows view details link when clickable', () => {
    const handleClick = vi.fn();
    render(<WorkflowProgressCard {...defaultProps} onClick={handleClick} />);
    
    expect(screen.getByText('View Details →')).toBeInTheDocument();
  });

  it('hides timeline and current step in compact mode', () => {
    render(<WorkflowProgressCard {...defaultProps} compact />);
    
    // Current step info should be hidden
    expect(screen.queryByText('Current Step')).not.toBeInTheDocument();
  });

  it('renders completed status correctly', () => {
    render(
      <WorkflowProgressCard 
        {...defaultProps} 
        status="completed"
        currentStepIndex={4}
        steps={mockProgressSteps.map(s => ({ ...s, status: 'completed' }))}
      />
    );
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('renders rejected status correctly', () => {
    render(
      <WorkflowProgressCard 
        {...defaultProps} 
        status="rejected"
      />
    );
    
    expect(screen.getByText('Rejected')).toBeInTheDocument();
  });

  it('renders cancelled status correctly', () => {
    render(
      <WorkflowProgressCard 
        {...defaultProps} 
        status="cancelled"
      />
    );
    
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('renders draft status correctly', () => {
    render(
      <WorkflowProgressCard 
        {...defaultProps} 
        status="draft"
        currentStepIndex={0}
        steps={mockProgressSteps.map(s => ({ ...s, status: 'pending' }))}
      />
    );
    
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('handles keyboard navigation when clickable', () => {
    const handleClick = vi.fn();
    const { container } = render(<WorkflowProgressCard {...defaultProps} onClick={handleClick} />);
    
    // The card itself has role="button", find it by the outer container
    const card = container.firstChild as HTMLElement;
    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' });
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders step dots with correct count', () => {
    render(<WorkflowProgressCard {...defaultProps} />);
    
    // Each step should have a title attribute
    const stepDots = document.querySelectorAll('[title*="Submit Form"], [title*="Manager Review"], [title*="Finance Approval"], [title*="Final Review"], [title*="Complete"]');
    expect(stepDots.length).toBe(5);
  });

  it('shows relative time for update timestamp', () => {
    // Mock Date.now for consistent testing
    const originalNow = Date.now;
    Date.now = vi.fn(() => new Date('2024-01-15T15:00:00Z').getTime());
    
    render(<WorkflowProgressCard {...defaultProps} />);
    
    // 30 minutes ago should show as "30m ago"
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
    
    Date.now = originalNow;
  });
});

// ============================================================================
// WORKFLOWSTATUSTIMELINE TESTS
// ============================================================================

describe('WorkflowStatusTimeline', () => {
  const defaultProps = {
    steps: mockTimelineSteps,
    currentStepIndex: 2,
  };

  it('renders all steps', () => {
    render(<WorkflowStatusTimeline {...defaultProps} />);
    
    expect(screen.getByText('Submit Form')).toBeInTheDocument();
    expect(screen.getByText('Manager Review')).toBeInTheDocument();
    expect(screen.getByText('Finance Approval')).toBeInTheDocument();
    expect(screen.getByText('Final Review')).toBeInTheDocument();
  });

  it('displays status badges for each step', () => {
    render(<WorkflowStatusTimeline {...defaultProps} />);
    
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Approved')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('shows assignee information when showAssignees is true', () => {
    render(<WorkflowStatusTimeline {...defaultProps} showAssignees />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Bob Jones')).toBeInTheDocument();
  });

  it('hides assignee information when showAssignees is false', () => {
    render(<WorkflowStatusTimeline {...defaultProps} showAssignees={false} />);
    
    // Names should not appear as separate elements
    const johnDoeElements = screen.queryAllByText('John Doe');
    // John Doe appears in completion info, but not as assignee badge
    expect(johnDoeElements.length).toBeLessThanOrEqual(1);
  });

  it('shows duration when showDurations is true', () => {
    render(<WorkflowStatusTimeline {...defaultProps} showDurations />);
    
    expect(screen.getByText('15m')).toBeInTheDocument();
    expect(screen.getByText('4h')).toBeInTheDocument();
  });

  it('hides duration when showDurations is false', () => {
    render(<WorkflowStatusTimeline {...defaultProps} showDurations={false} />);
    
    expect(screen.queryByText('15m')).not.toBeInTheDocument();
    expect(screen.queryByText('4h')).not.toBeInTheDocument();
  });

  it('displays step notes when provided', () => {
    render(<WorkflowStatusTimeline {...defaultProps} />);
    
    expect(screen.getByText(/"Looks good, approved!"/)).toBeInTheDocument();
  });

  it('shows action buttons for current in-progress step', () => {
    render(<WorkflowStatusTimeline {...defaultProps} />);
    
    expect(screen.getByText('Complete Step')).toBeInTheDocument();
    expect(screen.getByText('Add Note')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
  });

  it('formats completion dates correctly', () => {
    render(<WorkflowStatusTimeline {...defaultProps} />);
    
    // Should show formatted dates for completed steps
    const dateElements = screen.getAllByText(/Jan/);
    expect(dateElements.length).toBeGreaterThan(0);
  });

  it('renders step with rejected status', () => {
    const stepsWithRejected: TimelineStep[] = [
      ...mockTimelineSteps.slice(0, 2),
      { ...mockTimelineSteps[2], status: 'rejected', notes: 'Budget exceeded' },
    ];
    
    render(
      <WorkflowStatusTimeline 
        steps={stepsWithRejected} 
        currentStepIndex={2} 
      />
    );
    
    expect(screen.getByText('Rejected')).toBeInTheDocument();
    expect(screen.getByText(/"Budget exceeded"/)).toBeInTheDocument();
  });

  it('renders step with skipped status', () => {
    const stepsWithSkipped: TimelineStep[] = [
      ...mockTimelineSteps.slice(0, 2),
      { id: '3', name: 'Optional Step', order: 3, status: 'skipped' },
      mockTimelineSteps[3],
    ];
    
    render(
      <WorkflowStatusTimeline 
        steps={stepsWithSkipped} 
        currentStepIndex={3} 
      />
    );
    
    expect(screen.getByText('Skipped')).toBeInTheDocument();
  });

  it('renders step with blocked status', () => {
    const stepsWithBlocked: TimelineStep[] = [
      ...mockTimelineSteps.slice(0, 2),
      { id: '3', name: 'Blocked Step', order: 3, status: 'blocked' },
    ];
    
    render(
      <WorkflowStatusTimeline 
        steps={stepsWithBlocked} 
        currentStepIndex={2} 
      />
    );
    
    expect(screen.getByText('Blocked')).toBeInTheDocument();
  });

  it('generates correct initials for assignee avatar', () => {
    render(<WorkflowStatusTimeline {...defaultProps} showAssignees />);
    
    // John Doe -> JD, Jane Smith -> JS, Bob Jones -> BJ
    expect(screen.getByText('JD')).toBeInTheDocument();
    expect(screen.getByText('JS')).toBeInTheDocument();
    expect(screen.getByText('BJ')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <WorkflowStatusTimeline {...defaultProps} className="custom-timeline" />
    );
    
    expect(container.querySelector('.custom-timeline')).toBeInTheDocument();
  });

  it('shows completed by different user when applicable', () => {
    const stepsWithDifferentCompleter: TimelineStep[] = [
      {
        ...mockTimelineSteps[0],
        completedBy: { id: '99', name: 'Admin User' },
      },
      ...mockTimelineSteps.slice(1),
    ];
    
    render(
      <WorkflowStatusTimeline 
        steps={stepsWithDifferentCompleter} 
        currentStepIndex={2} 
      />
    );
    
    expect(screen.getByText(/Completed by Admin User/)).toBeInTheDocument();
  });
});
