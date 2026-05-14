import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import UniversalEntityRecordRoute from './UniversalEntityRecordRoute';

const businessApiGet = vi.fn(async () => ({ data: { counts: {}, relationships: {} } }));
const apiClientGet = vi.fn(async () => ({ data: { results: [] } }));

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: (...args: unknown[]) => businessApiGet(...args),
  },
}));

vi.mock('@/services/apiService', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiClientGet(...args),
  },
}));

vi.mock('@/components/Cockpit', () => ({
  AIOverviewCard: () => <div data-testid="ai-overview-card" />,
  EntityProfileHeader: () => <div data-testid="entity-profile-header" />,
}));

vi.mock('@/components/Onboarding', () => ({
  TransactionalEmptyState: ({
    title,
    actions,
  }: {
    title: string;
    actions?: Array<{ label: string; onClick: () => void }>;
  }) => (
    <div data-testid="transactional-empty-state">
      <div>{title}</div>
      {actions?.map((action) => (
        <button key={action.label} onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
  TransactionalEmptyStateGuidance: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TransactionalEmptyStateGuidanceItem: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

vi.mock('@/components/Operations/AuditHistoryTimeline', () => ({
  AuditHistoryTimeline: () => <div data-testid="audit-history" />,
}));

vi.mock('@/components/Operations/OperationalDocumentActions', () => ({
  OperationalDocumentActions: () => <div data-testid="operational-actions" />,
}));

vi.mock('@/components/Operations/documentOperations', () => ({
  supportsAuditHistory: () => true,
  supportsOperationalActions: () => false,
}));

vi.mock('@/components/Entities/EntityWorkflowStatusPanel', () => ({
  EntityWorkflowStatusPanel: () => <div data-testid="workflow-panel" />,
}));

vi.mock('@/components/Shared', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
  CommentsPanel: () => <div data-testid="comments-panel" />,
  EntityFormSurface: ({
    entityType,
    mode,
    variant,
  }: {
    entityType: string;
    mode: string;
    variant?: string;
  }) => (
    <div data-testid="entity-form-surface">
      {entityType}:{mode}:{variant ?? 'modal'}
    </div>
  ),
  UnifiedEntityTable: () => <div data-testid="entity-table" />,
}));

const LocationEcho: React.FC = () => {
  const location = useLocation();
  return <div data-testid="location-path">{location.pathname}</div>;
};

describe('UniversalEntityRecordRoute air gap', () => {
  it('routes invoice edit actions onto the standalone edit route instead of opening a modal', async () => {
    const user = userEvent.setup();
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/records/invoice/123']}>
          <Routes>
            <Route path="/records/:entityType/:id" element={<><LocationEcho /><UniversalEntityRecordRoute /></>} />
            <Route
              path="/records/:entityType/:id/edit"
              element={
                <>
                  <LocationEcho />
                  <UniversalEntityRecordRoute mode="edit" />
                </>
              }
            />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByTestId('location-path')).toHaveTextContent('/records/invoice/123');
    expect(screen.getByTestId('ai-overview-card')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^edit$/i }));

    expect(await screen.findByTestId('location-path')).toHaveTextContent('/records/invoice/123/edit');
    expect(await screen.findByTestId('entity-form-surface')).toHaveTextContent('invoice:edit:inline');
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('ai-overview-card')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(await screen.findByTestId('location-path')).toHaveTextContent('/records/invoice/123');
    expect(await screen.findByRole('button', { name: /^edit$/i })).toBeInTheDocument();
  });
});
