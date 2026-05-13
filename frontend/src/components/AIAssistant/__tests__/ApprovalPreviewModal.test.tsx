/**
 * Tests for ApprovalPreviewModal component.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import ApprovalPreviewModal from '../ApprovalPreviewModal';

// Mock antd components that cause issues in test env
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd');
  return {
    ...actual,
    Modal: ({ open, children, title, onCancel, footer, ...rest }: any) =>
      open
        ? React.createElement(
            'div',
            { 'data-testid': 'modal', ...rest },
            React.createElement('div', { 'data-testid': 'modal-title' }, title),
            children
          )
        : null,
  };
});

const defaultRequest = {
  requestType: 'purchase_order',
  subject: 'PO-2026-0101-000001 to Acme Meats',
  recipientType: 'supplier',
  recipientName: 'Acme Meats Inc.',
  recipientEmail: 'orders@acmemeats.com',
  contentPreview: 'Purchase Order for 5000 lbs Beef Ribeye, delivery 2026-01-15.',
  sourceEntityType: 'purchase_order',
  sourceEntityId: '42',
  aiGenerated: true,
  aiConfidence: 0.92,
  priority: 'normal' as const,
};

describe('ApprovalPreviewModal', () => {
  const onApprove = vi.fn();
  const onReject = vi.fn();
  const onEditApprove = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when open is false', () => {
    render(
      <ApprovalPreviewModal
        open={false}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument();
  });

  it('should render when open is true', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.getByTestId('modal')).toBeInTheDocument();
  });

  it('should display recipient info', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Acme Meats Inc.')).toBeInTheDocument();
  });

  it('should display subject', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(defaultRequest.subject)).toBeInTheDocument();
  });

  it('should display content preview', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText(defaultRequest.contentPreview)).toBeInTheDocument();
  });

  it('should show AI-generated alert when aiGenerated is true', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('AI-Generated Content')).toBeInTheDocument();
  });

  it('should have approve and reject buttons', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.getByText('Approve & Send')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });

  it('should call onApprove when approve is clicked', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Approve & Send'));
    expect(onApprove).toHaveBeenCalledTimes(1);
  });

  it('should call onReject when reject is clicked', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={defaultRequest}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    fireEvent.click(screen.getByText('Reject'));
    expect(onReject).toHaveBeenCalledTimes(1);
  });

  it('should not render when request is null', () => {
    render(
      <ApprovalPreviewModal
        open={true}
        request={null}
        onApprove={onApprove}
        onReject={onReject}
        onEditApprove={onEditApprove}
        onCancel={onCancel}
      />
    );
    expect(screen.queryByText('Approve & Send')).not.toBeInTheDocument();
  });
});
