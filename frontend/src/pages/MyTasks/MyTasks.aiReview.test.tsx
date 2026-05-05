import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';

import { MyTasks } from './MyTasks';
import * as NotificationsContext from '../../contexts/NotificationsContext';
import { workflowExecutionService } from '../../services/workflowExecutionService';
import { aiStaffApi } from '../../services/aiService';

vi.mock('../../contexts/NotificationsContext', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../components/Delegation', () => ({
  DelegateTaskModal: () => null,
  DelegationHistory: () => null,
}));

vi.mock('../../services/workflowExecutionService', () => ({
  workflowExecutionService: {
    getExecutions: vi.fn(),
    resumeExecution: vi.fn(),
  },
}));

vi.mock('../../components/AIAssistant/AIDraftReviewModal', () => ({
  default: ({ open, item }: any) => (
    open ? <div data-testid="ai-draft-modal">{item?.id}:{item?.review_entity_type}</div> : null
  ),
}));

vi.mock('../../services/aiService', () => ({
  aiStaffApi: {
    listPendingReviews: vi.fn(),
    resolvePendingReview: vi.fn(),
  },
}));

const mockUseNotifications = NotificationsContext.useNotifications as unknown as ReturnType<typeof vi.fn>;
const mockGetExecutions = vi.mocked(workflowExecutionService.getExecutions);
const mockListPendingReviews = vi.mocked(aiStaffApi.listPendingReviews);

describe('MyTasks AI review queue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseNotifications.mockReturnValue({
      actionItems: [],
      actionItemCounts: { total: 0, overdue: 0, due_today: 0, due_this_week: 0 },
      loading: false,
      error: '',
      fetchActionItems: vi.fn(),
    });
    mockGetExecutions.mockResolvedValue({ results: [] } as any);
    mockListPendingReviews.mockResolvedValue([
      {
        id: 'draft-1',
        document_id: 'doc-1',
        document_type: 'purchase_order',
        confidence_score: 0.44,
        precision_delta: 0,
        created_on: '2026-05-05T12:00:00Z',
        sender: 'dispatch@example.com',
        source_subject: 'Potential Purchase Order',
        source_summary: 'AI parsed a low-confidence purchase order draft.',
        intent_label: 'Purchase Order',
        review_entity_type: 'purchase_order',
        original_extracted_data: { order_number: 'PO-1001' },
      },
    ] as any);
  });

  it('renders the AI review queue and auto-opens the highlighted draft', async () => {
    render(
      <MemoryRouter initialEntries={['/my-tasks?tab=ai-review&draft=draft-1']}>
        <Routes>
          <Route path="/my-tasks" element={<MyTasks />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('button', { name: 'AI Review Queue' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Potential Purchase Order')).toBeInTheDocument();
    });

    expect(screen.getByText(/Sender: dispatch@example.com/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Review & Save/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('ai-draft-modal')).toHaveTextContent('draft-1:purchase_order');
    });
  });
});
