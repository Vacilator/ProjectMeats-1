import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AIInboxFeedbackActions } from './AIInboxFeedbackActions';
import { aiFeedbackApi } from '@/services/aiService';

const mockMessageSuccess = vi.fn();
const mockMessageError = vi.fn();

vi.mock('antd', async () => {
  const actual = await vi.importActual<typeof import('antd')>('antd');
  return {
    ...actual,
    message: {
      ...actual.message,
      success: (...args: unknown[]) => mockMessageSuccess(...args),
      error: (...args: unknown[]) => mockMessageError(...args),
    },
  };
});

vi.mock('@/services/aiService', () => ({
  aiFeedbackApi: {
    submit: vi.fn(),
  },
}));

const mockSubmit = vi.mocked(aiFeedbackApi.submit);

describe('AIInboxFeedbackActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubmit.mockResolvedValue({
      id: 'draft-1',
      created: false,
      document_id: '11111111-1111-1111-1111-111111111111',
      feedback_signal: 'thumbs_up',
      retraining_status: 'queued',
      retraining_queued_at: new Date().toISOString(),
    });
  });

  it('submits thumbs-up feedback directly', async () => {
    const onSubmitted = vi.fn();

    render(
      <AIInboxFeedbackActions
        item={{
          id: 'draft-1',
          document_id: '11111111-1111-1111-1111-111111111111',
          document_type: 'inquiry',
          confidence_score: 0.61,
          precision_delta: 0,
          created_on: new Date().toISOString(),
          original_extracted_data: { customer_name: 'North Meats' },
        }}
        onSubmitted={onSubmitted}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Thumbs up feedback/i }));

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
        document_id: '11111111-1111-1111-1111-111111111111',
        feedback_signal: 'thumbs_up',
        feedback_source: 'ai_inbox',
      }));
    });
    expect(onSubmitted).toHaveBeenCalledWith(expect.objectContaining({
      feedbackSignal: 'thumbs_up',
      retrainingStatus: 'queued',
    }));
  });

  it('requires a comment before submitting thumbs-down feedback', async () => {
    mockSubmit.mockResolvedValue({
      id: 'draft-1',
      created: false,
      document_id: '11111111-1111-1111-1111-111111111111',
      feedback_signal: 'thumbs_down',
      retraining_status: 'queued',
      retraining_queued_at: new Date().toISOString(),
    });

    render(
      <AIInboxFeedbackActions
        item={{
          id: 'draft-1',
          document_id: '11111111-1111-1111-1111-111111111111',
          document_type: 'purchase_order',
          confidence_score: 0.42,
          precision_delta: 0,
          created_on: new Date().toISOString(),
          original_extracted_data: { order_number: 'PO-1001' },
        }}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: /Thumbs down feedback/i }));

    const submitButton = screen.getByRole('button', { name: 'Submit feedback' });
    expect(submitButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText('Thumbs down reason'), 'Wrong customer and missing requested protein.');
    expect(submitButton).toBeEnabled();

    await userEvent.click(submitButton);

    await waitFor(() => {
      expect(mockSubmit).toHaveBeenCalledWith(expect.objectContaining({
        feedback_signal: 'thumbs_down',
        feedback_comment: 'Wrong customer and missing requested protein.',
      }));
    });
  });
});
