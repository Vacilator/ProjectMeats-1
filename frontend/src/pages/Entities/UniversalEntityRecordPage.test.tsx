import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import UniversalEntityRecordPage from './UniversalEntityRecordPage';

const apiGetMock = vi.hoisted(() => vi.fn());
const businessApiGetMock = vi.hoisted(() => vi.fn());
const entityFormSurfaceMock = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/services/apiService', () => ({
  apiClient: {
    get: (...args: unknown[]) => apiGetMock(...args),
  },
}));

vi.mock('@/services/businessApi', () => ({
  businessApi: {
    get: (...args: unknown[]) => businessApiGetMock(...args),
  },
}));

vi.mock('@/components/Entities/EntityWorkflowStatusPanel', () => ({
  EntityWorkflowStatusPanel: () => <div data-testid="workflow-status-panel" />,
}));

vi.mock('@/components/Cockpit', async () => {
  const ReactModule = await import('react');

  return {
    AIOverviewCard: () => <div data-testid="ai-overview-card" />,
    EntityProfileHeader: ({
      onTitleResolved,
    }: {
      onTitleResolved?: (value: { text: string; tooltip?: string }) => void;
    }) => {
      ReactModule.useEffect(() => {
        onTitleResolved?.({ text: 'Acme Supplier', tooltip: 'Acme Supplier' });
      }, [onTitleResolved]);

      return <div data-testid="entity-profile-header" />;
    },
  };
});

vi.mock('@/components/AIAssistant/AmbientSuggestions', () => ({
  AmbientSuggestions: () => <div data-testid="ambient-suggestions" />,
}));

vi.mock('@/components/Onboarding', () => ({
  TransactionalEmptyState: ({
    title,
    message,
    actions,
  }: {
    title: string;
    message: string;
    actions?: Array<{ label: string; onClick: () => void }>;
  }) => (
    <div data-testid="transactional-empty-state">
      <div>{title}</div>
      <div>{message}</div>
      {actions?.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick}>
          {action.label}
        </button>
      ))}
    </div>
  ),
  TransactionalEmptyStateGuidance: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
  TransactionalEmptyStateGuidanceItem: ({ children }: React.PropsWithChildren) => (
    <div>{children}</div>
  ),
}));

vi.mock('@/components/Operations/AuditHistoryTimeline', () => ({
  AuditHistoryTimeline: () => <div data-testid="audit-history-timeline" />,
}));

vi.mock('@/components/Operations/OperationalDocumentActions', () => ({
  OperationalDocumentActions: () => <div data-testid="operational-document-actions" />,
}));

vi.mock('@/components/Operations/documentOperations', () => ({
  supportsAuditHistory: vi.fn(() => false),
  supportsOperationalActions: vi.fn(() => false),
}));

vi.mock('@/components/Shared', () => ({
  ActivityFeed: () => <div data-testid="activity-feed" />,
  CommentsPanel: () => <div data-testid="comments-panel" />,
  EntityFormSurface: (props: Record<string, unknown>) => entityFormSurfaceMock(props),
  UnifiedEntityTable: () => <div data-testid="unified-entity-table" />,
}));

describe('UniversalEntityRecordPage child create defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    apiGetMock.mockImplementation(async (url: string) => {
      if (url === 'plants/' || url === 'contacts/') {
        return { data: { results: [] } };
      }

      throw new Error(`Unexpected GET ${url}`);
    });

    businessApiGetMock.mockResolvedValue({
      data: {
        counts: {},
        relationships: {},
      },
    });

    entityFormSurfaceMock.mockImplementation(
      (props: { isOpen?: boolean; initialValues?: unknown }) =>
        props.isOpen ? (
          <div data-testid="entity-form-surface">{JSON.stringify(props.initialValues ?? {})}</div>
        ) : null
    );
  });

  it('uses stable supplier-scoped plant defaults for the New Plant modal', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter initialEntries={['/suppliers/7186']}>
        <Routes>
          <Route
            path="/suppliers/:id"
            element={
              <UniversalEntityRecordPage entityType="supplier" basePath="/suppliers" mode="view" />
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: 'Suppliers' })).toBeInTheDocument();

    await user.click(await screen.findByRole('button', { name: /new plant/i }));

    expect(await screen.findByTestId('entity-form-surface')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suppliers' })).toBeInTheDocument();

    const latestProps = entityFormSurfaceMock.mock.calls.at(-1)?.[0] as
      | {
          entityType?: string;
          mode?: string;
          variant?: string;
          initialValues?: Record<string, unknown>;
        }
      | undefined;

    expect(latestProps).toMatchObject({
      entityType: 'plant',
      mode: 'create',
      variant: 'modal',
      initialValues: {
        supplier: '7186',
        plant_type: 'processing',
        country: 'USA',
        },
    });

    const openCalls = entityFormSurfaceMock.mock.calls.filter(
      ([props]) => Boolean((props as { isOpen?: boolean } | undefined)?.isOpen)
    );
    expect(openCalls).toHaveLength(1);
  });
});
