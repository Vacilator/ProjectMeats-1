/**
 * Process Cockpit — RT-03.1: Consolidated process monitoring hub.
 *
 * Consolidates:
 * 1. Process Monitor (running/completed workform executions)
 * 2. AI Inbox (email ingestion + action items)
 * 3. Draft Forms (routed from AI Inbox for review)
 * 4. History (completed processes)
 * 5. Operational Tasks (pending action items)
 *
 * Single `/process-cockpit` entry point with tabbed navigation.
 *
 * Additive only — existing ProcessMonitor component reused as a tab.
 */
import React, { useMemo } from 'react';
import styled from 'styled-components';
import { Tabs, Badge } from 'antd';
import { useSearchParams } from 'react-router-dom';
import {
  Workflow,
  Mail,
  FileEdit,
  History,
  ClipboardList,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import ProcessMonitor from './ProcessMonitor';
import EmailIngestionCockpitPanel from '../../components/Cockpit/EmailIngestionCockpitPanel';
import { businessApi } from '../../services/businessApi';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { getValidTenantId } from '../../utils/tenantId';

// ============================================================================
// Types
// ============================================================================

interface DraftCounts {
  pending: number;
  in_progress: number;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 24px 24px;
`;

const StyledTabs = styled(Tabs)`
  .ant-tabs-nav {
    margin-bottom: 16px;
    padding: 0;
  }

  .ant-tabs-tab {
    padding: 12px 16px;
  }
`;

const TabLabel = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
`;

const EmptyPanel = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  gap: 12px;
`;

const DraftsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DraftCard = styled.div`
  padding: 16px;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md, 8px);
  background: rgb(var(--color-surface));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
  transition: background 0.15s;

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }
`;

const DraftInfo = styled.div`
  flex: 1;
`;

const DraftTitle = styled.div`
  font-weight: 600;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const DraftMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const StatusBadge = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background: ${({ $status }) => {
    switch ($status) {
      case 'pending': return 'rgb(234, 179, 8, 0.1)';
      case 'in_progress': return 'rgb(59, 130, 246, 0.1)';
      case 'submitted': return 'rgb(34, 197, 94, 0.1)';
      case 'discarded': return 'rgb(var(--color-text-secondary), 0.1)';
      default: return 'rgb(var(--color-border))';
    }
  }};
  color: ${({ $status }) => {
    switch ($status) {
      case 'pending': return 'rgb(161, 98, 7)';
      case 'in_progress': return 'rgb(37, 99, 235)';
      case 'submitted': return 'rgb(22, 163, 74)';
      case 'discarded': return 'rgb(var(--color-text-secondary))';
      default: return 'rgb(var(--color-text-primary))';
    }
  }};
`;

// ============================================================================
// Sub-components
// ============================================================================

interface DraftFormsPanelProps {}

const DraftFormsPanel: React.FC<DraftFormsPanelProps> = () => {
  const tenantId = getValidTenantId();
  const { data, isLoading } = useQuery({
    queryKey: withTenantQueryKey('cockpit-drafts'),
    queryFn: async () => {
      const res = await businessApi.get('/ai-assistant/cockpit-drafts/', {
        params: { status: 'pending' },
      });
      return res.data?.results ?? res.data ?? [];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const drafts = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  if (isLoading) {
    return <EmptyPanel>Loading drafts...</EmptyPanel>;
  }

  if (drafts.length === 0) {
    return (
      <EmptyPanel>
        <FileEdit size={32} strokeWidth={1.5} />
        <span>No pending draft forms</span>
        <span style={{ fontSize: 12 }}>
          When AI Inbox routes items here, they'll appear for review.
        </span>
      </EmptyPanel>
    );
  }

  return (
    <DraftsList>
      {drafts.map((draft: any) => (
        <DraftCard key={draft.id}>
          <DraftInfo>
            <DraftTitle>
              {draft.form_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'Unknown Form'}
              {draft.form_data?.po_number && ` — ${draft.form_data.po_number}`}
            </DraftTitle>
            <DraftMeta>
              {draft.form_data?.supplier_name && `From: ${draft.form_data.supplier_name}`}
              {draft.created_on && ` • ${new Date(draft.created_on).toLocaleDateString()}`}
            </DraftMeta>
          </DraftInfo>
          <StatusBadge $status={draft.status}>{draft.status}</StatusBadge>
        </DraftCard>
      ))}
    </DraftsList>
  );
};

const HistoryPanel: React.FC = () => (
  <EmptyPanel>
    <History size={32} strokeWidth={1.5} />
    <span>Process History</span>
    <span style={{ fontSize: 12 }}>
      Completed processes will be shown here. Use the Process Monitor tab to view active processes.
    </span>
  </EmptyPanel>
);

const TasksPanel: React.FC = () => (
  <EmptyPanel>
    <ClipboardList size={32} strokeWidth={1.5} />
    <span>Operational Tasks</span>
    <span style={{ fontSize: 12 }}>
      Pending tasks assigned to you will appear here.
    </span>
  </EmptyPanel>
);

// ============================================================================
// Main Component
// ============================================================================

const ProcessCockpitPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = getValidTenantId();
  const activeTab = searchParams.get('tab') || 'monitor';

  // Fetch draft counts for badge
  const { data: draftCountData } = useQuery({
    queryKey: withTenantQueryKey('cockpit-drafts-count'),
    queryFn: async () => {
      const res = await businessApi.get('/ai-assistant/cockpit-drafts/', {
        params: { status: 'pending' },
      });
      const results = res.data?.results ?? res.data ?? [];
      return { pending: Array.isArray(results) ? results.length : 0 };
    },
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  const pendingDrafts = draftCountData?.pending ?? 0;

  const handleTabChange = React.useCallback(
    (key: string) => {
      setSearchParams({ tab: key });
    },
    [setSearchParams],
  );

  const items = useMemo(
    () => [
      {
        key: 'monitor',
        label: (
          <TabLabel>
            <Workflow size={16} />
            <span>Process Monitor</span>
          </TabLabel>
        ),
        children: <ProcessMonitor />,
      },
      {
        key: 'inbox',
        label: (
          <TabLabel>
            <Mail size={16} />
            <span>AI Inbox</span>
          </TabLabel>
        ),
        children: <EmailIngestionCockpitPanel />,
      },
      {
        key: 'drafts',
        label: (
          <TabLabel>
            <FileEdit size={16} />
            <span>Draft Forms</span>
            {pendingDrafts > 0 && (
              <Badge count={pendingDrafts} size="small" />
            )}
          </TabLabel>
        ),
        children: <DraftFormsPanel />,
      },
      {
        key: 'history',
        label: (
          <TabLabel>
            <History size={16} />
            <span>History</span>
          </TabLabel>
        ),
        children: <HistoryPanel />,
      },
      {
        key: 'tasks',
        label: (
          <TabLabel>
            <ClipboardList size={16} />
            <span>Tasks</span>
          </TabLabel>
        ),
        children: <TasksPanel />,
      },
    ],
    [tenantId, pendingDrafts],
  );

  return (
    <Container>
      <StyledTabs
        activeKey={activeTab}
        items={items}
        onChange={handleTabChange}
        size="large"
      />
    </Container>
  );
};

export default ProcessCockpitPage;
export { ProcessCockpitPage };
