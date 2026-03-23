/**
 * My Tasks Widget Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { MyTasksWidget } from './MyTasksWidget';
import * as NotificationsContext from '../../contexts/NotificationsContext';

vi.mock('../../contexts/CockpitPinnedToolsContext', () => ({
  useCockpitPinnedTools: () => ({
    pinned: [],
    pinWidget: vi.fn(),
    unpin: vi.fn(),
    isWidgetPinned: vi.fn(() => false),
  }),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock notifications context
vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: vi.fn(),
}));

const mockUseNotifications = NotificationsContext.useNotifications as ReturnType<typeof vi.fn>;

describe('MyTasksWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseNotifications.mockReturnValue({
      actionItems: [],
      loading: true,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders empty state when no tasks', () => {
    mockUseNotifications.mockReturnValue({
      actionItems: [],
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    expect(screen.getByText('All caught up! No pending tasks.')).toBeInTheDocument();
  });

  it('renders task list', () => {
    const mockTasks = [
      {
        id: '1',
        title: 'Review purchase order',
        priority: 'high',
        due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        form_name: 'Purchase Order Form',
        status: 'pending',
        is_overdue: false,
        related_po_value: 500,
      },
      {
        id: '2',
        title: 'Approve supplier contract',
        priority: 'urgent',
        due_date: new Date(Date.now() - 86400000).toISOString(), // Yesterday (overdue)
        form_name: 'Supplier Contract',
        status: 'pending',
        is_overdue: true,
        related_po_value: 15000,
      },
    ];

    mockUseNotifications.mockReturnValue({
      actionItems: mockTasks,
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    expect(screen.getByText('Review purchase order')).toBeInTheDocument();
    expect(screen.getByText('Approve supplier contract')).toBeInTheDocument();
  });

  it('prioritizes high-value tasks due soon (urgency × value)', () => {
    const mockTasks = [
      {
        id: 'low',
        title: 'Low value follow-up',
        priority: 'normal',
        due_date: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
        status: 'pending',
        is_overdue: false,
        related_po_value: 0,
      },
      {
        id: 'high',
        title: 'High value approval',
        priority: 'normal',
        due_date: new Date(Date.now() + 2 * 86400000).toISOString(), // In 2 days (At Risk when value >= $10k)
        status: 'pending',
        is_overdue: false,
        related_po_value: 20000,
      },
    ];

    mockUseNotifications.mockReturnValue({
      actionItems: mockTasks,
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    const orderedTitles = screen.getAllByText(/High value approval|Low value follow-up/);
    expect(orderedTitles[0]).toHaveTextContent('High value approval');
  });

  it('shows overdue indicator for overdue tasks', () => {
    const mockTasks = [
      {
        id: '1',
        title: 'Overdue task',
        priority: 'high',
        due_date: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
        status: 'pending',
        is_overdue: true,
      },
    ];

    mockUseNotifications.mockReturnValue({
      actionItems: mockTasks,
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    // Should show "1 overdue" badge and "Xd overdue" in task
    expect(screen.getByText('1 overdue')).toBeInTheDocument();
  });

  it('navigates to task on click', () => {
    const mockTasks = [
      {
        id: '1',
        title: 'Test task',
        priority: 'normal',
        due_date: null,
        submission_id: 'sub-123',
        status: 'pending',
      },
    ];

    mockUseNotifications.mockReturnValue({
      actionItems: mockTasks,
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Test task'));
    expect(mockNavigate).toHaveBeenCalledWith('/workflows/run/sub-123');
  });

  it('shows badge when there are overdue tasks', () => {
    const mockTasks = [
      {
        id: '1',
        title: 'Overdue task',
        priority: 'urgent',
        due_date: new Date(Date.now() - 86400000).toISOString(),
        status: 'pending',
        is_overdue: true,
      },
      {
        id: '2',
        title: 'Another overdue',
        priority: 'high',
        due_date: new Date(Date.now() - 86400000).toISOString(),
        status: 'pending',
        is_overdue: true,
      },
    ];

    mockUseNotifications.mockReturnValue({
      actionItems: mockTasks,
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    expect(screen.getByText('2 overdue')).toBeInTheDocument();
  });

  it('limits displayed tasks to maxItems', () => {
    const mockTasks = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      title: `Task ${i + 1}`,
      priority: 'normal',
      due_date: null,
      status: 'pending',
      is_overdue: false,
    }));

    mockUseNotifications.mockReturnValue({
      actionItems: mockTasks,
      loading: false,
      fetchActionItems: vi.fn(),
    });

    render(
      <MemoryRouter>
        <MyTasksWidget maxItems={3} />
      </MemoryRouter>
    );

    // Should show only maxItems task titles plus "View all" link
    const visibleTaskTitles = screen.getAllByText(/^Task \d+$/);
    expect(visibleTaskTitles).toHaveLength(3);
    expect(screen.getByText('View all tasks')).toBeInTheDocument();
  });

  it('calls fetchActionItems on refresh', () => {
    const mockFetch = vi.fn();
    mockUseNotifications.mockReturnValue({
      actionItems: [],
      loading: false,
      fetchActionItems: mockFetch,
    });

    render(
      <MemoryRouter>
        <MyTasksWidget />
      </MemoryRouter>
    );

    // Find and click refresh button
    const refreshButton = screen.getByTitle('Refresh');
    fireEvent.click(refreshButton);

    expect(mockFetch).toHaveBeenCalled();
  });
});
