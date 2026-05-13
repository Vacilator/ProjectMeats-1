/**
 * MySubmissions Page
 *
 * Lists user's form submissions with status and ability to resume.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Skeleton } from 'antd';
import styled from 'styled-components';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';
import { formSubmissionService, FormSubmissionListItem } from '../../services/quickActionsService';
import { useQuickActions } from '../../contexts/QuickActionsContext';
import { logger } from '../../utils/logger';
import { formatDateLocal } from '@/utils/formatters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

const PageContainer = styled.div`
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
`;

const PageHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
`;

const Title = styled.h1`
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--text-primary, rgb(var(--color-text-primary)));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const FilterTabs = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--border-color, rgb(var(--color-border)));
  padding-bottom: 0.5rem;
`;

const FilterTab = styled.button<{ $active?: boolean }>`
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: none;
  border-radius: 0.375rem;
  cursor: pointer;
  transition: all 0.15s ease;
  background: ${({ $active }) => $active ? 'rgb(var(--color-primary))' : 'transparent'};
  color: ${({ $active }) => $active ? 'rgb(var(--color-primary-foreground))' : 'rgb(var(--color-text-muted))'};

  &:hover {
    background: ${({ $active }) => $active ? 'var(--color-primary-dark, rgb(var(--color-primary)))' : 'var(--bg-secondary, rgb(var(--color-surface)))'};
  }
`;

const SubmissionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const SubmissionCard = styled.div`
  background: var(--card-bg, rgb(var(--color-surface)));
  border: 1px solid var(--border-color, rgb(var(--color-border)));
  border-radius: 0.5rem;
  padding: 1.25rem;
  display: grid;
  grid-template-columns: auto 1fr auto auto auto;
  gap: 1rem;
  align-items: center;
  transition: box-shadow 0.15s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.08);
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }
`;

const FormIcon = styled.span`
  font-size: 2rem;
`;

const SubmissionInfo = styled.div``;

const FormName = styled.h3`
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary, rgb(var(--color-text-primary)));
`;

const SubmissionMeta = styled.p`
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
`;

const ProgressContainer = styled.div`
  width: 120px;
`;

const ProgressBar = styled.div`
  height: 0.5rem;
  background: var(--bg-tertiary, rgb(var(--color-border)));
  border-radius: 0.25rem;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ percent: number; $status: string }>`
  height: 100%;
  width: ${({ percent }) => `${percent}%`};
  background: ${({ $status }) => {
    switch ($status) {
      case 'completed':
        return 'var(--color-success, rgb(var(--color-success)))';
      case 'cancelled':
        return 'var(--color-error, rgb(var(--color-error)))';
      default:
        return 'var(--color-primary, rgb(var(--color-primary)))';
    }
  }};
  border-radius: 0.25rem;
  transition: width 0.3s ease;
`;

const ProgressText = styled.span`
  font-size: 0.75rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
  display: block;
  margin-top: 0.25rem;
  text-align: center;
`;

const StatusBadge = styled.span<{ $status: string }>`
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 0.25rem;
  font-weight: 500;

  ${({ $status }) => {
    switch ($status) {
      case 'completed':
        return `
          background: var(--color-success-light, rgba(var(--color-success), 0.14));
          color: var(--color-success, rgb(var(--color-success)));
        `;
      case 'cancelled':
        return `
          background: var(--color-error-light, rgba(var(--color-error), 0.14));
          color: var(--color-error, rgb(var(--color-error)));
        `;
      case 'in_progress':
        return `
          background: var(--color-primary-light, rgba(var(--color-primary), 0.14));
          color: var(--color-primary, rgb(var(--color-primary)));
        `;
      default:
        return `
          background: var(--bg-secondary, rgb(var(--color-border)));
          color: var(--text-secondary, rgb(var(--color-text-muted)));
        `;
    }
  }}
`;

const ActionsContainer = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ActionButton = styled.button<{ $variant?: 'primary' | 'secondary' | 'danger' }>`
  padding: 0.5rem 1rem;
  font-size: 0.8125rem;
  font-weight: 500;
  border-radius: 0.375rem;
  border: 1px solid transparent;
  cursor: pointer;
  transition: all 0.15s ease;

  ${({ $variant }) => {
    switch ($variant) {
      case 'danger':
        return `
          background: transparent;
          color: var(--color-error, rgb(var(--color-error)));
          border-color: var(--color-error, rgb(var(--color-error)));
          &:hover {
            background: var(--color-error, rgb(var(--color-error)));
            color: rgb(var(--color-text-inverse));
          }
        `;
      case 'secondary':
        return `
          background: var(--bg-secondary, rgb(var(--color-surface)));
          color: var(--text-primary, rgb(var(--color-text-primary)));
          border-color: var(--border-color, rgb(var(--color-border)));
          &:hover {
            background: var(--bg-tertiary, rgb(var(--color-border)));
          }
        `;
      default:
        return `
          background: var(--color-primary, rgb(var(--color-primary)));
          color: rgb(var(--color-text-inverse));
          &:hover {
            background: var(--color-primary-dark, rgb(var(--color-primary)));
          }
        `;
    }
  }}

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
`;

const EmptyIcon = styled.span`
  font-size: 4rem;
  display: block;
  margin-bottom: 1rem;
`;

const LoadingState = styled.div`
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary, rgb(var(--color-text-muted)));
`;

const statusFilters = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'completed':
      return 'Completed';
    case 'cancelled':
      return 'Cancelled';
    case 'in_progress':
      return 'In Progress';
    default:
      return 'Draft';
  }
};

const MySubmissions: React.FC = () => {
  useDocumentTitle('My Submissions');
  const [submissions, setSubmissions] = useState<FormSubmissionListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const { openFormModal } = useQuickActions();

  const loadSubmissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = statusFilter ? { status: statusFilter } : undefined;
      const data = await formSubmissionService.list(params);
      setSubmissions(data);
    } catch (err: unknown) {
      logger.error('Failed to load submissions', { component: 'MySubmissions' }, err);
      const errMsg = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Failed to load submissions';
      setError(errMsg);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSubmissions();
  }, [loadSubmissions]);

  const handleResume = useCallback((formId: string) => {
    openFormModal(formId);
  }, [openFormModal]);

  const handleCancel = useCallback(async (submissionId: string) => {
    const confirmed = await confirmDialog({
      title: 'Cancel submission?',
      content: 'Are you sure you want to cancel this submission?',
      okText: 'Cancel submission',
      cancelText: 'Keep',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await formSubmissionService.cancel(submissionId);
      loadSubmissions();
    } catch (err: unknown) {
      logger.error('Failed to cancel submission', { component: 'MySubmissions' }, err);
      const errMsg = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Failed to cancel submission';
      showAlert({
        type: 'error',
        title: 'Error',
        content: errMsg,
      });
    }
  }, [loadSubmissions]);

  const handleDelete = useCallback(async (submissionId: string) => {
    const confirmed = await confirmDialog({
      title: 'Delete submission?',
      content: 'Are you sure you want to delete this submission? This cannot be undone.',
      okText: 'Delete',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!confirmed) return;

    try {
      await formSubmissionService.delete(submissionId);
      loadSubmissions();
    } catch (err: unknown) {
      logger.error('Failed to delete submission', { component: 'MySubmissions' }, err);
      const errMsg = (err && typeof err === 'object' && 'message' in err) ? (err as { message: string }).message : 'Failed to delete submission';
      showAlert({
        type: 'error',
        title: 'Error',
        content: errMsg,
      });
    }
  }, [loadSubmissions]);

  return (
    <PageContainer>
      <PageHeader>
        <Title>
          📋 My Form Submissions
        </Title>
      </PageHeader>

      <FilterTabs>
        {statusFilters.map(filter => (
          <FilterTab
            key={filter.value}
            $active={statusFilter === filter.value}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </FilterTab>
        ))}
      </FilterTabs>

      {isLoading ? (
        <LoadingState>
          <Skeleton active paragraph={{ rows: 8 }} />
        </LoadingState>
      ) : error ? (
        <EmptyState>
          <EmptyIcon>⚠️</EmptyIcon>
          <p>{error}</p>
          <ActionButton onClick={loadSubmissions}>Retry</ActionButton>
        </EmptyState>
      ) : submissions.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📭</EmptyIcon>
          <p>No submissions found{statusFilter && ` with status "${getStatusLabel(statusFilter)}"`}</p>
          <p style={{ fontSize: '0.875rem' }}>
            Start a new form from the Quick Actions menu (⚡) in the header
          </p>
        </EmptyState>
      ) : (
        <SubmissionsList>
          {submissions.map(submission => (
            <SubmissionCard key={submission.id}>
              <FormIcon>{submission.form_icon || '📄'}</FormIcon>

              <SubmissionInfo>
                <FormName>{submission.form_name}</FormName>
                <SubmissionMeta>
                  Started {formatDateLocal(submission.created_at)}
                  {submission.completed_at && ` • Completed ${formatDateLocal(submission.completed_at)}`}
                </SubmissionMeta>
              </SubmissionInfo>

              <ProgressContainer>
                <ProgressBar>
                  <ProgressFill
                    percent={submission.progress.percent}
                    $status={submission.status}
                  />
                </ProgressBar>
                <ProgressText>
                  {submission.progress.completed}/{submission.progress.total} steps
                </ProgressText>
              </ProgressContainer>

              <StatusBadge $status={submission.status}>
                {getStatusLabel(submission.status)}
              </StatusBadge>

              <ActionsContainer>
                {(submission.status === 'draft' || submission.status === 'in_progress') && (
                  <>
                    <ActionButton
                      $variant="primary"
                      onClick={() => handleResume(submission.form)}
                    >
                      Resume
                    </ActionButton>
                    <ActionButton
                      $variant="danger"
                      onClick={() => handleCancel(submission.id)}
                    >
                      Cancel
                    </ActionButton>
                  </>
                )}
                {(submission.status === 'completed' || submission.status === 'cancelled') && (
                  <>
                    <ActionButton
                      $variant="secondary"
                      onClick={() => handleResume(submission.form)}
                    >
                      View
                    </ActionButton>
                    <ActionButton
                      $variant="danger"
                      onClick={() => handleDelete(submission.id)}
                    >
                      Delete
                    </ActionButton>
                  </>
                )}
              </ActionsContainer>
            </SubmissionCard>
          ))}
        </SubmissionsList>
      )}
    </PageContainer>
  );
};

export default MySubmissions;
