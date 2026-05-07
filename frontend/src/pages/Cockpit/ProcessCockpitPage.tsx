/**
 * Process Cockpit — Premium Command Center
 *
 * Complete redesign: modern card-based layout with generous whitespace,
 * inspired by Linear.app + top trading platforms.
 *
 * Sections: AI Inbox • Live Activity • In Progress • History • Quick Actions
 * Features: Smart search, "Last synced" indicator, real-time updates,
 *           detail panel with React Flow + Quick Actions.
 *
 * Additive only — replaces the previous tabbed layout.
 */
import React, { useMemo, useState, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { Input } from 'antd';
import { useSearchParams } from 'react-router-dom';
import {
  Workflow,
  Mail,
  FileEdit,
  History,
  ClipboardList,
  Search,
  RefreshCw,
  Zap,
  Activity,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  AlertTriangle,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

import EmailIngestionCockpitPanel from '../../components/Cockpit/EmailIngestionCockpitPanel';
import { ProcessQuickActions } from '../../components/Cockpit/ProcessQuickActions';
import { TradeLineageFlow } from '../../components/Cockpit/TradeLineageFlow';
import { ProcessFlowHeader } from '../../components/Cockpit/ProcessFlowHeader';
import { InterventionsPanel } from '../../components/Cockpit/InterventionsPanel';
import { businessApi } from '../../services/businessApi';
import { tradeExceptionQueueService } from '../../services/tradeExceptionQueueService';
import { withTenantQueryKey } from '../../utils/queryKeys';
import { getValidTenantId } from '../../utils/tenantId';

// ============================================================================
// Types
// ============================================================================

type CockpitView = 'activity' | 'interventions' | 'inbox' | 'drafts' | 'history' | 'tasks';

interface ActivityItem {
  id: string;
  entity_type: string;
  entity_id: string;
  title: string;
  status: string;
  updated_at: string;
  contact_name?: string;
  department?: string;
  inquiry_id?: string;
}

// ============================================================================
// Styled Components
// ============================================================================

const fadeIn = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
`;

// ============================================================================
// Styled Components — Premium Layout
// ============================================================================

const PageContainer = styled.div`
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 32px 48px;
  min-height: calc(100vh - 64px);
`;

const PageHeader = styled.header`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 32px;
  gap: 16px;
  flex-wrap: wrap;
`;

const PageTitle = styled.h1`
  font-size: 24px;
  font-weight: 700;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
`;

const SyncIndicator = styled.div<{ $syncing?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  padding: 4px 10px;
  border-radius: 999px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));

  svg {
    animation: ${(p) => (p.$syncing ? pulse : 'none')} 1.5s ease-in-out infinite;
  }
`;

const SearchBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  max-width: 480px;
`;

const NavBar = styled.nav`
  display: flex;
  gap: 4px;
  padding: 4px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  margin-bottom: 24px;
`;

const NavItem = styled.button<{ $active?: boolean }>`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-md);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;

  background: ${(p) => (p.$active ? 'rgb(var(--color-surface))' : 'transparent')};
  color: ${(p) =>
    p.$active ? 'rgb(var(--color-text-primary))' : 'rgb(var(--color-text-secondary))'};
  box-shadow: ${(p) => (p.$active ? '0 1px 3px rgba(0,0,0,0.08)' : 'none')};

  &:hover {
    background: ${(p) => (p.$active ? 'rgb(var(--color-surface))' : 'rgba(var(--color-border), 0.5)')};
    color: rgb(var(--color-text-primary));
  }
`;

const NavBadge = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  background: rgb(59, 130, 246);
  color: white;
`;

const ContentGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 24px;
  animation: ${fadeIn} 0.3s ease;
`;

const SectionCard = styled.section`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const SectionTitle = styled.h2`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const SectionContent = styled.div`
  padding: 0;
`;

const ActivityList = styled.div`
  display: flex;
  flex-direction: column;
`;

const ActivityCard = styled.div<{ $selected?: boolean }>`
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  cursor: pointer;
  transition: all 0.1s ease;
  background: ${(p) => (p.$selected ? 'rgba(59, 130, 246, 0.04)' : 'transparent')};
  border-left: 3px solid ${(p) => (p.$selected ? 'rgb(59, 130, 246)' : 'transparent')};

  &:hover {
    background: rgba(var(--color-border), 0.3);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const ActivityIcon = styled.div<{ $status: string }>`
  width: 36px;
  height: 36px;
  border-radius: var(--radius-md);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;

  ${(p) => {
    switch (p.$status) {
      case 'completed':
      case 'approved':
        return 'background: rgba(34, 197, 94, 0.1); color: rgb(34, 197, 94);';
      case 'pending':
      case 'draft':
        return 'background: rgba(234, 179, 8, 0.1); color: rgb(202, 138, 4);';
      case 'failed':
      case 'halted':
        return 'background: rgba(239, 68, 68, 0.1); color: rgb(239, 68, 68);';
      default:
        return 'background: rgba(59, 130, 246, 0.1); color: rgb(59, 130, 246);';
    }
  }}
`;

const ActivityInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const ActivityTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ActivityMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const StatusDot = styled.span<{ $status: string }>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;

  ${(p) => {
    switch (p.$status) {
      case 'completed':
      case 'approved':
        return 'background: rgb(34, 197, 94);';
      case 'pending':
      case 'draft':
        return 'background: rgb(234, 179, 8);';
      case 'failed':
      case 'halted':
        return 'background: rgb(239, 68, 68);';
      default:
        return 'background: rgb(59, 130, 246);';
    }
  }}
`;

const DetailPanel = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-lg);
  overflow: hidden;
  animation: ${fadeIn} 0.2s ease;
`;

const DetailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-background));
`;

const DetailTitle = styled.h3`
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const DetailBody = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const CloseBtn = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  padding: 4px;
  border-radius: var(--radius-sm);
  &:hover {
    background: rgb(var(--color-background));
  }
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 240px;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
  gap: 12px;
  padding: 40px;
`;

const DraftsList = styled.div`
  display: flex;
  flex-direction: column;
`;

const DraftCard = styled.div`
  padding: 14px 20px;
  border-bottom: 1px solid rgb(var(--color-border));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: rgba(var(--color-border), 0.3);
  }

  &:last-child {
    border-bottom: none;
  }
`;

const DraftInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const DraftTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: rgb(var(--color-text-primary));
`;

const DraftMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  margin-top: 2px;
`;

const StatusPill = styled.span<{ $status: string }>`
  display: inline-flex;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  ${({ $status }) => {
    switch ($status) {
      case 'pending':
        return 'background: rgba(234, 179, 8, 0.1); color: rgb(161, 98, 7);';
      case 'in_progress':
        return 'background: rgba(59, 130, 246, 0.1); color: rgb(37, 99, 235);';
      case 'submitted':
      case 'completed':
        return 'background: rgba(34, 197, 94, 0.1); color: rgb(22, 163, 74);';
      default:
        return 'background: rgba(var(--color-border), 0.3); color: rgb(var(--color-text-secondary));';
    }
  }}
`;

const TwoColumnLayout = styled.div`
  display: grid;
  grid-template-columns: 1fr 400px;
  gap: 24px;

  @media (max-width: 1024px) {
    grid-template-columns: 1fr;
  }
`;

// ============================================================================
// Sub-components
// ============================================================================

const DraftFormsPanel: React.FC = () => {
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
    return (
      <EmptyState>
        <Loader2 size={24} className="animate-spin" />
        Loading drafts...
      </EmptyState>
    );
  }

  if (drafts.length === 0) {
    return (
      <EmptyState>
        <FileEdit size={32} strokeWidth={1.5} />
        <span>No pending draft forms</span>
        <span style={{ fontSize: 12, opacity: 0.7 }}>
          When AI Inbox routes items here, they'll appear for review.
        </span>
      </EmptyState>
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
          <StatusPill $status={draft.status}>{draft.status?.replace(/_/g, ' ')}</StatusPill>
        </DraftCard>
      ))}
    </DraftsList>
  );
};

const HistoryPanel: React.FC = () => (
  <EmptyState>
    <History size={32} strokeWidth={1.5} />
    <span>Process History</span>
    <span style={{ fontSize: 12, opacity: 0.7 }}>
      Completed processes will be shown here.
    </span>
  </EmptyState>
);

const TasksPanel: React.FC = () => (
  <EmptyState>
    <ClipboardList size={32} strokeWidth={1.5} />
    <span>Operational Tasks</span>
    <span style={{ fontSize: 12, opacity: 0.7 }}>
      Pending tasks assigned to you will appear here.
    </span>
  </EmptyState>
);

// ============================================================================
// Main Component
// ============================================================================

const ProcessCockpitPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tenantId = getValidTenantId();
  const activeView = (
    searchParams.get('view') ||
    searchParams.get('tab') ||
    'activity'
  ) as CockpitView;
  const [selectedItem, setSelectedItem] = useState<ActivityItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

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

  // Fetch recent activity (inquiries in progress)
  const { data: activityData, dataUpdatedAt } = useQuery({
    queryKey: withTenantQueryKey('cockpit-activity'),
    queryFn: async () => {
      const res = await businessApi.get('/inquiries/', {
        params: { ordering: '-modified_on', page_size: 20 },
      });
      const results = res.data?.results ?? res.data ?? [];
      return Array.isArray(results) ? results : [];
    },
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });

  const pendingDrafts = draftCountData?.pending ?? 0;
  const activity: ActivityItem[] = useMemo(() => {
    if (!activityData) return [];
    return activityData.map((item: any) => ({
      id: item.id,
      entity_type: 'inquiry',
      entity_id: item.id,
      title: `${item.inquiry_number || item.id?.slice(0, 8)} — ${item.customer_name || item.supplier_name || 'Trade'}`,
      status: item.status || 'pending',
      updated_at: item.modified_on || item.created_on || '',
      contact_name: item.contact_name,
      department: item.department,
      inquiry_id: item.id,
    }));
  }, [activityData]);

  // Last synced indicator
  const lastSynced = useMemo(() => {
    if (!dataUpdatedAt) return 'Never';
    const diffMs = Date.now() - dataUpdatedAt;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    return `${Math.floor(mins / 60)}h ago`;
  }, [dataUpdatedAt]);

  const handleViewChange = useCallback(
    (view: string) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('view', view);
      nextParams.delete('tab');
      setSearchParams(nextParams);
      setSelectedItem(null);
    },
    [searchParams, setSearchParams],
  );

  const { data: interventionCountData } = useQuery({
    queryKey: withTenantQueryKey('cockpit-interventions-count'),
    queryFn: async () =>
      tradeExceptionQueueService.listExceptions({
        page_size: 1,
      }),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  const pendingInterventions = interventionCountData?.count ?? 0;

  const handleItemClick = useCallback((item: ActivityItem) => {
    setSelectedItem((prev) => (prev?.id === item.id ? null : item));
  }, []);

  // Filter activity by search
  const filteredActivity = useMemo(() => {
    if (!searchQuery) return activity;
    const q = searchQuery.toLowerCase();
    return activity.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.status.toLowerCase().includes(q) ||
        item.contact_name?.toLowerCase().includes(q),
    );
  }, [activity, searchQuery]);

  const renderContent = () => {
    switch (activeView) {
      case 'interventions':
        return (
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <AlertTriangle size={16} /> Trades Requiring Intervention
                {pendingInterventions > 0 && <NavBadge>{pendingInterventions}</NavBadge>}
              </SectionTitle>
            </SectionHeader>
            <SectionContent>
              <InterventionsPanel />
            </SectionContent>
          </SectionCard>
        );

      case 'inbox':
        return (
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <Mail size={16} /> AI Inbox
              </SectionTitle>
            </SectionHeader>
            <SectionContent>
              <EmailIngestionCockpitPanel />
            </SectionContent>
          </SectionCard>
        );

      case 'drafts':
        return (
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <FileEdit size={16} /> Draft Forms
                {pendingDrafts > 0 && <NavBadge>{pendingDrafts}</NavBadge>}
              </SectionTitle>
            </SectionHeader>
            <SectionContent>
              <DraftFormsPanel />
            </SectionContent>
          </SectionCard>
        );

      case 'history':
        return (
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <History size={16} /> Process History
              </SectionTitle>
            </SectionHeader>
            <SectionContent>
              <HistoryPanel />
            </SectionContent>
          </SectionCard>
        );

      case 'tasks':
        return (
          <SectionCard>
            <SectionHeader>
              <SectionTitle>
                <ClipboardList size={16} /> Operational Tasks
              </SectionTitle>
            </SectionHeader>
            <SectionContent>
              <TasksPanel />
            </SectionContent>
          </SectionCard>
        );

      case 'activity':
      default:
        return (
          <TwoColumnLayout>
            <SectionCard>
              <SectionHeader>
                <SectionTitle>
                  <Activity size={16} /> Live Activity
                </SectionTitle>
                <span style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
                  {filteredActivity.length} items
                </span>
              </SectionHeader>
              <ActivityList>
                {filteredActivity.length === 0 ? (
                  <EmptyState>
                    <Workflow size={28} strokeWidth={1.5} />
                    No activity to show
                  </EmptyState>
                ) : (
                  filteredActivity.map((item) => (
                    <ActivityCard
                      key={item.id}
                      $selected={selectedItem?.id === item.id}
                      onClick={() => handleItemClick(item)}
                    >
                      <ActivityIcon $status={item.status}>
                        {item.status === 'completed' || item.status === 'approved' ? (
                          <CheckCircle2 size={18} />
                        ) : item.status === 'failed' || item.status === 'halted' ? (
                          <AlertCircle size={18} />
                        ) : (
                          <Workflow size={18} />
                        )}
                      </ActivityIcon>
                      <ActivityInfo>
                        <ActivityTitle>{item.title}</ActivityTitle>
                        <ActivityMeta>
                          <StatusDot $status={item.status} />
                          <span>{item.status?.replace(/_/g, ' ')}</span>
                          {item.contact_name && <span>• {item.contact_name}</span>}
                          {item.updated_at && (
                            <span>• {new Date(item.updated_at).toLocaleDateString()}</span>
                          )}
                        </ActivityMeta>
                      </ActivityInfo>
                      <ChevronRight size={16} style={{ color: 'rgb(var(--color-text-secondary))' }} />
                    </ActivityCard>
                  ))
                )}
              </ActivityList>
            </SectionCard>

            {selectedItem ? (
              <DetailPanel>
                <DetailHeader>
                  <DetailTitle>
                    {selectedItem.title}
                  </DetailTitle>
                  <CloseBtn onClick={() => setSelectedItem(null)}>
                    <X size={16} />
                  </CloseBtn>
                </DetailHeader>
                <DetailBody>
                  <ProcessFlowHeader inquiryId={selectedItem.inquiry_id || selectedItem.entity_id} />
                  <TradeLineageFlow
                    inquiryId={selectedItem.inquiry_id || selectedItem.entity_id}
                    compact
                  />
                  <ProcessQuickActions
                    entityType={selectedItem.entity_type}
                    entityId={selectedItem.entity_id}
                    entityStatus={selectedItem.status}
                    inquiryId={selectedItem.inquiry_id}
                    compact
                  />
                </DetailBody>
              </DetailPanel>
            ) : (
              <DetailPanel>
                <DetailBody>
                  <EmptyState>
                    <Zap size={28} strokeWidth={1.5} />
                    <span>Select an item to view details</span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>
                      Click any activity card to see its process flow and available actions.
                    </span>
                  </EmptyState>
                </DetailBody>
              </DetailPanel>
            )}
          </TwoColumnLayout>
        );
    }
  };

  return (
    <PageContainer>
      <PageHeader>
        <PageTitle>
          <Workflow size={22} />
          Process Cockpit
        </PageTitle>
        <SearchBar>
          <Input
            prefix={<Search size={14} />}
            placeholder="Search processes, POs, suppliers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            allowClear
            size="middle"
            style={{ borderRadius: 8 }}
          />
        </SearchBar>
        <SyncIndicator>
          <RefreshCw size={12} />
          <span>Synced {lastSynced}</span>
        </SyncIndicator>
      </PageHeader>

      <NavBar>
        <NavItem $active={activeView === 'activity'} onClick={() => handleViewChange('activity')}>
          <Activity size={15} /> Live Activity
        </NavItem>
        <NavItem $active={activeView === 'interventions'} onClick={() => handleViewChange('interventions')}>
          <AlertTriangle size={15} /> Interventions
          {pendingInterventions > 0 && <NavBadge>{pendingInterventions}</NavBadge>}
        </NavItem>
        <NavItem $active={activeView === 'inbox'} onClick={() => handleViewChange('inbox')}>
          <Mail size={15} /> AI Inbox
        </NavItem>
        <NavItem $active={activeView === 'drafts'} onClick={() => handleViewChange('drafts')}>
          <FileEdit size={15} /> Drafts
          {pendingDrafts > 0 && <NavBadge>{pendingDrafts}</NavBadge>}
        </NavItem>
        <NavItem $active={activeView === 'history'} onClick={() => handleViewChange('history')}>
          <History size={15} /> History
        </NavItem>
        <NavItem $active={activeView === 'tasks'} onClick={() => handleViewChange('tasks')}>
          <ClipboardList size={15} /> Tasks
        </NavItem>
      </NavBar>

      <ContentGrid>
        {renderContent()}
      </ContentGrid>
    </PageContainer>
  );
};

export default ProcessCockpitPage;
export { ProcessCockpitPage };
