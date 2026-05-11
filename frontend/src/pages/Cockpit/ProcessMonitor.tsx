import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { X, RefreshCw } from 'lucide-react';
import { message } from 'antd';

import { businessApi } from '../../services/businessApi';
import { useAuth } from '../../contexts/AuthContext';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
const UnifiedFlowEditor = lazy(() => import('../../components/FlowEditor/UnifiedFlowEditor').then(m => ({ default: m.UnifiedFlowEditor })));
import { withTenantQueryKey } from '../../utils/queryKeys';

// ============================================================================
// Types
// ============================================================================

type StepAssignmentType = 'user' | 'role' | 'team' | 'unassigned';

interface ProcessMonitorAssignment {
  assignment_type?: StepAssignmentType;
  assigned_user_id?: number | null;
  assigned_user_name?: string | null;
  assigned_role?: string | null;
  due_days?: number | null;
}

interface ProcessMonitorItem {
  id: string;
  form_id: string;
  form_name: string | null;
  status: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  current_step_id: string | null;
  current_step_name: string | null;
  current_step_order: number | null;
  current_step_entity_type?: string | null;
  current_step_status: string | null;
  current_step_updated_at: string | null;
  assigned_to: ProcessMonitorAssignment | null;
  assigned_to_display: string | null;
  due_days: number | null;
  due_at: string | null;
  is_overdue: boolean;
  time_in_current_step_seconds: number | null;
}

interface PaginatedResponse<T> {
  count: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

interface TenantFormResponse {
  id: string;
  name: string;
  flow_data?: {
    nodes?: any[];
    edges?: any[];
  };
}

// ============================================================================
// Styled
// ============================================================================

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
  padding: 24px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
`;

const TitleGroup = styled.div``;

const Title = styled.h1`
  font-size: 24px;
  font-weight: 700;
  margin: 0;
  color: rgb(var(--color-text-primary));
`;

const Subtitle = styled.p`
  margin: 6px 0 0;
  font-size: 13px;
  color: rgb(var(--color-text-secondary));
`;

const Controls = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const Toggle = styled.button<{ $active: boolean }>`
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  background: ${p => (p.$active ? 'rgb(var(--color-primary))' : 'rgb(var(--color-surface))')};
  color: ${p => (p.$active ? 'white' : 'rgb(var(--color-text-primary))')};
`;

const IconButton = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-primary));

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }
`;

const Table = styled.table`
  width: 100%;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 14px;
  overflow: hidden;
  border-collapse: collapse;
`;

const Th = styled.th`
  text-align: left;
  padding: 12px 14px;
  font-size: 12px;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: rgb(var(--color-text-secondary));
  background: rgb(var(--color-surface-hover, var(--color-border)));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Td = styled.td`
  padding: 12px 14px;
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Tr = styled.tr`
  cursor: pointer;

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }

  &:last-child td {
    border-bottom: none;
  }
`;

const Badge = styled.span<{ $variant?: 'info' | 'warning' | 'danger' | 'success' }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid rgb(var(--color-border));
  color: ${p => {
    switch (p.$variant) {
      case 'danger':
        return 'rgb(var(--color-error))';
      case 'warning':
        return 'rgb(var(--color-warning))';
      case 'success':
        return 'rgb(var(--color-success))';
      default:
        return 'rgb(var(--color-info))';
    }
  }};
  background: ${p => {
    switch (p.$variant) {
      case 'danger':
        return 'rgb(var(--color-error) / 0.08)';
      case 'warning':
        return 'rgb(var(--color-warning) / 0.10)';
      case 'success':
        return 'rgb(var(--color-success) / 0.10)';
      default:
        return 'rgb(var(--color-info) / 0.08)';
    }
  }};
`;

const EmptyState = styled.div`
  padding: 48px;
  border: 1px dashed rgb(var(--color-border));
  border-radius: 14px;
  background: rgb(var(--color-surface));
  color: rgb(var(--color-text-secondary));
`;

const ModalOverlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(var(--color-overlay), 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;

const Modal = styled.div`
  width: min(1400px, 96vw);
  height: min(860px, 92vh);
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 16px;
  overflow: hidden;
  display: grid;
  grid-template-columns: 1fr 360px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr auto;
  }
`;

const ModalHeader = styled.div`
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
`;

const ModalHeaderTitle = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const ModalTitle = styled.div`
  font-weight: 800;
  color: rgb(var(--color-text-primary));
`;

const ModalMeta = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const CloseButton = styled.button`
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid rgb(var(--color-border));
  background: rgb(var(--color-surface));
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;

  &:hover {
    background: rgb(var(--color-surface-hover, var(--color-border)));
  }
`;

const EditorPane = styled.div`
  padding: 0;
  border-right: 1px solid rgb(var(--color-border));
  min-height: 0;

  /* Highlight wrapper-level react-flow nodes */
  .react-flow__node.pm-active-node {
    box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.35), 0 10px 24px rgba(var(--color-overlay), 0.12);
    border-radius: 12px;
  }

  @media (max-width: 980px) {
    border-right: none;
    border-bottom: 1px solid rgb(var(--color-border));
  }
`;

const DetailsPane = styled.aside`
  padding: 14px;
  min-height: 0;
  overflow: auto;
`;

const DetailRow = styled.div`
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgb(var(--color-border));

  &:last-child {
    border-bottom: none;
  }
`;

const DetailLabel = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

const DetailValue = styled.div`
  font-size: 13px;
  color: rgb(var(--color-text-primary));
  font-weight: 600;
`;

// ============================================================================
// Helpers
// ============================================================================

function formatSeconds(seconds: number | null): string {
  if (seconds == null) return '—';
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ${hrs % 24}h`;
  if (hrs > 0) return `${hrs}h ${mins % 60}m`;
  if (mins > 0) return `${mins}m`;
  return `${seconds}s`;
}

function pickActiveNodeId(nodes: any[], item: ProcessMonitorItem): string | null {
  const currentStepName = item.current_step_name?.toLowerCase();
  const currentEntityType = item.current_step_entity_type?.toLowerCase();

  const candidates = nodes.filter((n) => {
    const t = (n?.type || n?.data?.nodeType || '').toString();
    return ['form', 'formStep', 'formstep', 'formNode', 'formnode'].some((x) => t.toLowerCase().includes(x.toLowerCase()));
  });

  if (!candidates.length) return null;

  const byEntity = currentEntityType
    ? candidates.filter((n) => {
        const et = (n?.data?.entityType || n?.data?.entity_type || n?.data?.entity || '').toString().toLowerCase();
        return et === currentEntityType;
      })
    : [];

  const byName = currentStepName
    ? (byEntity.length ? byEntity : candidates).filter((n) => {
        const label = (n?.data?.label || n?.data?.name || '').toString().toLowerCase();
        return label && currentStepName && label.includes(currentStepName);
      })
    : [];

  const picked = (byName[0] || byEntity[0] || candidates[0]) as any;
  return picked?.id ?? null;
}


// ============================================================================
// Component
// ============================================================================

const ProcessMonitor: React.FC = () => {
  useDocumentTitle('WorkForm Submission Queue');
  const { user } = useAuth();
  const isStaff = !!user?.is_staff || !!user?.is_superuser;

  const [showMineOnly, setShowMineOnly] = useState(!isStaff);
  const [selected, setSelected] = useState<ProcessMonitorItem | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  useEffect(() => {
    // If user becomes known and is staff, don't force mine-only.
    setShowMineOnly((prev) => (isStaff ? prev : true));
  }, [isStaff]);

  const listQueryKey = useMemo(
    () => withTenantQueryKey('process-monitor', showMineOnly ? 'mine' : 'all'),
    [showMineOnly]
  );

  const listQuery = useQuery({
    queryKey: listQueryKey,
    queryFn: async (): Promise<PaginatedResponse<ProcessMonitorItem>> => {
      const params = showMineOnly ? { assigned_to: 'me' } : undefined;
      const res = await businessApi.get<PaginatedResponse<ProcessMonitorItem>>(
        '/workflows/form-submissions/process-monitor/',
        { params }
      );
      return res.data;
    },
    // Circuit breaker: don't hammer the server on 5xx crashes (prevents UI stutter)
    retry: (failureCount, error: any) => {
      if (error?.response?.status >= 500) return false;
      return failureCount < 3;
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
  });

  const formQuery = useQuery({
    queryKey: withTenantQueryKey('process-monitor-form', selected?.form_id),
    enabled: !!selected?.form_id,
    queryFn: async (): Promise<TenantFormResponse> => {
      const res = await businessApi.get<TenantFormResponse>(`/workflows/forms/${selected!.form_id}/`);
      return res.data;
    },
  });

  const activeNodeId = useMemo(() => {
    const nodes = formQuery.data?.flow_data?.nodes || [];
    if (!selected) return null;
    return pickActiveNodeId(nodes, selected);
  }, [formQuery.data, selected]);

  const nodes = useMemo(() => formQuery.data?.flow_data?.nodes || [], [formQuery.data]);

  const edges = useMemo(() => formQuery.data?.flow_data?.edges || [], [formQuery.data]);

  const open = useCallback((item: ProcessMonitorItem) => {
    setSelected(item);
    setSelectedNodeId(null);
  }, []);

  const close = useCallback(() => {
    setSelected(null);
    setSelectedNodeId(null);
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: { id: string; data?: Record<string, unknown> }) => {
    setSelectedNodeId(node.id);
  }, []);

  useEffect(() => {
    if (!selected) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  const results = listQuery.data?.results || [];

  const selectedNodeData = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = nodes.find((n: { id: string }) => n.id === selectedNodeId) as { id: string; type?: string; data?: Record<string, unknown> } | undefined;
    if (!node) return null;
    return {
      id: node.id,
      type: node.type ?? node.data?.nodeType ?? 'unknown',
      label: String(node.data?.label || node.data?.name || node.id),
      entityType: String(node.data?.entityType || node.data?.entity_type || ''),
      description: String(node.data?.description || node.data?.instructions || ''),
      status: node.id === activeNodeId ? 'active' : 'completed',
      config: node.data ?? {},
    };
  }, [selectedNodeId, nodes, activeNodeId]);

  return (
    <Container>
      <Header>
        <TitleGroup>
          <Title>Active Submission Queue</Title>
          <Subtitle>
            Live view of in-flight WorkForms. Command Center owns action-required inbox
            work; this queue is for step-by-step execution drill-ins.
          </Subtitle>
        </TitleGroup>

        <Controls>
          <Toggle
            $active={!showMineOnly}
            onClick={() => {
              if (!isStaff) return;
              setShowMineOnly(false);
            }}
            title={!isStaff ? 'Only staff can view all submissions' : 'Show all submissions'}
          >
            All
          </Toggle>
          <Toggle $active={showMineOnly} onClick={() => setShowMineOnly(true)}>
            Mine
          </Toggle>
          <IconButton onClick={() => listQuery.refetch()}>
            <RefreshCw size={16} /> Refresh
          </IconButton>
        </Controls>
      </Header>

      {listQuery.isLoading ? (
        <EmptyState>Loading…</EmptyState>
      ) : listQuery.isError ? (
        <EmptyState>
          Failed to load submission queue data. Check console/network for details.
        </EmptyState>
      ) : results.length === 0 ? (
        <EmptyState>
          No active submissions found. If you expected items here, try switching Mine/All
          or start a new WorkForm.
        </EmptyState>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th>Form</Th>
              <Th>Status</Th>
              <Th>Current Step</Th>
              <Th>Assigned To</Th>
              <Th>Time in Step</Th>
              <Th>Due</Th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <Tr
                key={r.id}
                onClick={() => open(r)}
              >
                <Td>
                  <div style={{ fontWeight: 800 }}>{r.form_name ?? 'Unnamed Form'}</div>
                  <div style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
                    {r.created_by_name ? `Created by ${r.created_by_name}` : '—'}
                  </div>
                </Td>
                <Td>
                  <Badge $variant={r.status === 'completed' ? 'success' : 'info'}>{r.status}</Badge>
                </Td>
                <Td>
                  <div style={{ fontWeight: 800 }}>{r.current_step_name ?? '—'}</div>
                  <div style={{ fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
                    {r.current_step_status ?? '—'}
                  </div>
                </Td>
                <Td>
                  {r.assigned_to_display ? (
                    <span>{r.assigned_to_display}</span>
                  ) : (
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>Unassigned</span>
                  )}
                </Td>
                <Td>{formatSeconds(r.time_in_current_step_seconds)}</Td>
                <Td>
                  {r.due_at ? (
                    <Badge $variant={r.is_overdue ? 'danger' : 'warning'}>
                      {r.is_overdue ? 'Overdue' : 'Due'}
                    </Badge>
                  ) : (
                    <span style={{ color: 'rgb(var(--color-text-secondary))' }}>—</span>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      )}

      {selected && (
        <ModalOverlay
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <Modal>
            <ModalHeader>
              <ModalHeaderTitle>
                <ModalTitle>{selected.form_name ?? 'Form'} — {selected.current_step_name ?? 'Current Step'}</ModalTitle>
                <ModalMeta>
                  Submission {selected.id} • {selected.assigned_to_display ?? 'Unassigned'} • {formatSeconds(selected.time_in_current_step_seconds)} in step
                </ModalMeta>
              </ModalHeaderTitle>
              <CloseButton onClick={close} aria-label="Close">
                <X size={18} />
              </CloseButton>
            </ModalHeader>

            <EditorPane>
              {formQuery.isLoading ? (
                <EmptyState>Loading flow…</EmptyState>
              ) : formQuery.isError ? (
                <EmptyState>Failed to load form flow definition.</EmptyState>
              ) : (
                <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>Loading flow…</div>}>
                  <UnifiedFlowEditor
                    readOnly={true}
                    initialNodes={nodes as any}
                    initialEdges={edges as any}
                    onNodeClick={handleNodeClick}
                  />
                </Suspense>
              )}
            </EditorPane>

            <DetailsPane>
              {selectedNodeData ? (
                <>
                  <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'rgb(var(--color-text-primary))' }}>Node Details</span>
                    <button
                      type="button"
                      onClick={() => setSelectedNodeId(null)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgb(var(--color-text-secondary))', fontSize: 12 }}
                      aria-label="Back to process details"
                    >
                      ← Queue Details
                    </button>
                  </div>
                  <DetailRow>
                    <DetailLabel>Node</DetailLabel>
                    <DetailValue>{selectedNodeData.label}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Type</DetailLabel>
                    <DetailValue>{String(selectedNodeData.type).replace(/([A-Z])/g, ' $1').trim()}</DetailValue>
                  </DetailRow>
                  {selectedNodeData.entityType && (
                    <DetailRow>
                      <DetailLabel>Entity</DetailLabel>
                      <DetailValue>{selectedNodeData.entityType}</DetailValue>
                    </DetailRow>
                  )}
                  <DetailRow>
                    <DetailLabel>Status</DetailLabel>
                    <DetailValue style={{ color: selectedNodeData.status === 'active' ? 'rgb(var(--color-primary))' : 'rgb(var(--color-success))' }}>
                      {selectedNodeData.status === 'active' ? '● Active' : '✓ Completed'}
                    </DetailValue>
                  </DetailRow>
                  {selectedNodeData.description && (
                    <DetailRow>
                      <DetailLabel>Details</DetailLabel>
                      <DetailValue style={{ fontWeight: 400 }}>{selectedNodeData.description}</DetailValue>
                    </DetailRow>
                  )}
                  {/* Node-level Approve / Reject actions */}
                  {(selectedNodeData.type === 'approvalGate' || selectedNodeData.status === 'active') && (
                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'rgb(var(--color-success))',
                          color: 'rgb(var(--color-text-inverse, 255 255 255))',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          message.success(`Approved node: ${selectedNodeData.label}`);
                          setSelectedNodeId(null);
                        }}
                      >
                        ✓ Approve
                      </button>
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: 6,
                          border: '1px solid rgb(var(--color-error))',
                          background: 'transparent',
                          color: 'rgb(var(--color-error))',
                          fontWeight: 600,
                          fontSize: 13,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          message.info(`Rejected node: ${selectedNodeData.label}`);
                          setSelectedNodeId(null);
                        }}
                      >
                        ✗ Reject
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <DetailRow>
                    <DetailLabel>Form</DetailLabel>
                    <DetailValue>{selected.form_name ?? '—'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Status</DetailLabel>
                    <DetailValue>{selected.status}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Step</DetailLabel>
                    <DetailValue>{selected.current_step_name ?? '—'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Assigned</DetailLabel>
                    <DetailValue>{selected.assigned_to_display ?? 'Unassigned'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Due</DetailLabel>
                    <DetailValue>{selected.due_at ? (selected.is_overdue ? 'Overdue' : 'Due soon') : '—'}</DetailValue>
                  </DetailRow>
                  <DetailRow>
                    <DetailLabel>Elapsed</DetailLabel>
                    <DetailValue>{formatSeconds(selected.time_in_current_step_seconds)}</DetailValue>
                  </DetailRow>

                  <div style={{ marginTop: 14, fontSize: 12, color: 'rgb(var(--color-text-secondary))' }}>
                    {activeNodeId
                      ? 'Click any node in the flow to view its details.'
                      : 'Active step could not be auto-identified. Click any node to inspect it.'}
                  </div>
                </>
              )}
            </DetailsPane>
          </Modal>
        </ModalOverlay>
      )}
    </Container>
  );
};

export default ProcessMonitor;
