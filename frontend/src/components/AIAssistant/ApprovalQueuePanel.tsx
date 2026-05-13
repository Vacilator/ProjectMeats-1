/**
 * ApprovalQueuePanel — Filterable, batch-capable approval inbox.
 *
 * Card-based layout with status pills, preview snippets, batch actions.
 * Used in the AI Feedback Hub page and sidebar quick-view.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Button,
  Card,
  Checkbox,
  Empty,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  Tooltip,
  message,
} from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  FilterOutlined,
  RobotOutlined,
  SearchOutlined,
  SendOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import styled from 'styled-components';
import { approvalQueueApi } from '../../services/aiService';
import type { ExternalApprovalRequest, ApprovalQueueStats } from '../../services/aiService';
import { withTenantQueryKey } from '../../utils/queryKeys';

const { Text, Paragraph } = Typography;

// --- Query Keys ---

const APPROVAL_QUEUE_KEY = 'approval-queue';
const APPROVAL_STATS_KEY = 'approval-queue-stats';

const queueQueryKey = (filters?: Record<string, string>) =>
  withTenantQueryKey(APPROVAL_QUEUE_KEY, JSON.stringify(filters || {}));
const statsQueryKey = () => withTenantQueryKey(APPROVAL_STATS_KEY);

// --- Styled Components ---

const PanelContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FilterBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

const StatsBar = styled.div`
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-md);
`;

const StatItem = styled.div`
  text-align: center;
  min-width: 60px;
`;

const StatValue = styled.div`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  line-height: 1;
`;

const StatLabel = styled.div`
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
  margin-top: 4px;
`;

const ApprovalCard = styled(Card)<{ $selected?: boolean }>`
  border: 1px solid ${({ $selected }) =>
    $selected ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-md);
  transition: border-color 0.2s, box-shadow 0.2s;
  cursor: pointer;

  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: var(--shadow-sm);
  }

  .ant-card-body {
    padding: 12px 16px;
  }
`;

const CardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
`;

const CardPreview = styled(Paragraph)`
  color: rgb(var(--color-text-secondary));
  font-size: 13px;
  margin-bottom: 8px !important;
`;

const CardActions = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 6px;
`;

const BatchBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(var(--color-primary), 0.05);
  border: 1px solid rgba(var(--color-primary), 0.2);
  border-radius: var(--radius-sm);
`;

// --- Helpers ---

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: 'orange', label: 'Pending' },
  approved: { color: 'green', label: 'Approved' },
  rejected: { color: 'red', label: 'Rejected' },
  edited_and_approved: { color: 'cyan', label: 'Edited & Approved' },
  expired: { color: 'default', label: 'Expired' },
  delegated: { color: 'purple', label: 'Delegated' },
};

const TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  purchase_order: 'Purchase Order',
  sales_order: 'Sales Order',
  invoice: 'Invoice',
  carrier_release: 'Carrier Release',
  rfq: 'RFQ',
  general: 'General',
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// --- Component ---

interface ApprovalQueuePanelProps {
  compact?: boolean;
  maxItems?: number;
  onItemClick?: (item: ExternalApprovalRequest) => void;
}

const ApprovalQueuePanel: React.FC<ApprovalQueuePanelProps> = ({
  compact = false,
  maxItems,
  onItemClick,
}) => {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (statusFilter) f.status = statusFilter;
    if (typeFilter) f.type = typeFilter;
    return f;
  }, [statusFilter, typeFilter]);

  // Fetch queue
  const { data: items = [], isLoading } = useQuery<ExternalApprovalRequest[]>({
    queryKey: queueQueryKey(filters),
    queryFn: () => approvalQueueApi.list(filters),
    refetchInterval: 30_000,
  });

  // Fetch stats
  const { data: stats } = useQuery<ApprovalQueueStats>({
    queryKey: statsQueryKey(),
    queryFn: approvalQueueApi.stats,
    refetchInterval: 60_000,
  });

  // Mutations
  const approveMutation = useMutation({
    mutationFn: (id: string) => approvalQueueApi.approve(id),
    onSuccess: () => {
      message.success('Approved');
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(APPROVAL_QUEUE_KEY) });
      queryClient.invalidateQueries({ queryKey: statsQueryKey() });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => approvalQueueApi.reject(id),
    onSuccess: () => {
      message.success('Rejected');
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(APPROVAL_QUEUE_KEY) });
      queryClient.invalidateQueries({ queryKey: statsQueryKey() });
    },
  });

  const batchMutation = useMutation({
    mutationFn: ({ action, ids }: { action: 'approve' | 'reject'; ids: string[] }) =>
      approvalQueueApi.batchAction(action, ids),
    onSuccess: (data) => {
      message.success(`${data.updated} items updated`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey(APPROVAL_QUEUE_KEY) });
      queryClient.invalidateQueries({ queryKey: statsQueryKey() });
    },
  });

  // Filter by search
  const filteredItems = useMemo(() => {
    let result = items;
    if (searchText) {
      const lower = searchText.toLowerCase();
      result = result.filter(
        (item) =>
          item.subject.toLowerCase().includes(lower) ||
          item.recipient_name.toLowerCase().includes(lower) ||
          item.recipient_email.toLowerCase().includes(lower)
      );
    }
    if (maxItems) {
      result = result.slice(0, maxItems);
    }
    return result;
  }, [items, searchText, maxItems]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map((i) => i.id)));
    }
  }, [selectedIds.size, filteredItems]);

  return (
    <PanelContainer>
      {/* Stats */}
      {stats && !compact && (
        <StatsBar>
          <StatItem>
            <StatValue>{stats.pending}</StatValue>
            <StatLabel>Pending</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.approved_today}</StatValue>
            <StatLabel>Approved Today</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.rejected_today}</StatValue>
            <StatLabel>Rejected Today</StatLabel>
          </StatItem>
          <StatItem>
            <StatValue>{stats.expired_today}</StatValue>
            <StatLabel>Expired Today</StatLabel>
          </StatItem>
        </StatsBar>
      )}

      {/* Filters */}
      <FilterBar>
        <FilterOutlined />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 130 }}
          size="small"
          options={[
            { value: '', label: 'All Status' },
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: 'expired', label: 'Expired' },
          ]}
        />
        <Select
          value={typeFilter}
          onChange={setTypeFilter}
          style={{ width: 150 }}
          size="small"
          allowClear
          placeholder="All Types"
          options={Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }))}
        />
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search..."
          size="small"
          style={{ width: 180 }}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          allowClear
        />
      </FilterBar>

      {/* Batch actions */}
      {selectedIds.size > 0 && (
        <BatchBar>
          <Space>
            <Checkbox
              checked={selectedIds.size === filteredItems.length}
              indeterminate={selectedIds.size > 0 && selectedIds.size < filteredItems.length}
              onChange={toggleSelectAll}
            />
            <Text strong>{selectedIds.size} selected</Text>
          </Space>
          <Space>
            <Button
              size="small"
              type="primary"
              icon={<CheckCircleOutlined />}
              loading={batchMutation.isPending}
              onClick={() => batchMutation.mutate({ action: 'approve', ids: Array.from(selectedIds) })}
            >
              Approve All
            </Button>
            <Button
              size="small"
              danger
              icon={<CloseCircleOutlined />}
              loading={batchMutation.isPending}
              onClick={() => batchMutation.mutate({ action: 'reject', ids: Array.from(selectedIds) })}
            >
              Reject All
            </Button>
          </Space>
        </BatchBar>
      )}

      {/* Items */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : filteredItems.length === 0 ? (
        <Empty
          description={statusFilter === 'pending' ? 'No pending approvals 🎉' : 'No items match filters'}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        filteredItems.map((item) => {
          const statusCfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
          return (
            <ApprovalCard
              key={item.id}
              $selected={selectedIds.has(item.id)}
              size="small"
              onClick={() => onItemClick?.(item)}
            >
              <CardHeader>
                <Space>
                  <Checkbox
                    checked={selectedIds.has(item.id)}
                    onClick={(e) => e.stopPropagation()}
                    onChange={() => toggleSelect(item.id)}
                  />
                  <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
                  <Tag>{TYPE_LABELS[item.request_type] || item.request_type}</Tag>
                  {item.ai_generated && (
                    <Tooltip title="AI-generated content">
                      <RobotOutlined style={{ color: 'rgb(var(--color-info))' }} />
                    </Tooltip>
                  )}
                  {item.priority === 'urgent' && (
                    <Tag color="red" icon={<WarningOutlined />}>Urgent</Tag>
                  )}
                </Space>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDate(item.created_on)}
                </Text>
              </CardHeader>

              <Text strong style={{ display: 'block', marginBottom: 4 }}>
                {item.subject}
              </Text>

              <CardPreview ellipsis={{ rows: 2 }}>
                → {item.recipient_name || item.recipient_email || 'Unknown recipient'}
                {item.content_preview ? ` · ${item.content_preview.slice(0, 120)}` : ''}
              </CardPreview>

              {item.status === 'pending' && (
                <CardActions>
                  <Button
                    size="small"
                    danger
                    icon={<CloseCircleOutlined />}
                    onClick={(e) => { e.stopPropagation(); rejectMutation.mutate(item.id); }}
                    loading={rejectMutation.isPending}
                  >
                    Reject
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<SendOutlined />}
                    onClick={(e) => { e.stopPropagation(); approveMutation.mutate(item.id); }}
                    loading={approveMutation.isPending}
                  >
                    Approve
                  </Button>
                </CardActions>
              )}

              {item.expires_at && item.status === 'pending' && (
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                  <ClockCircleOutlined /> Expires {formatDate(item.expires_at)}
                </Text>
              )}
            </ApprovalCard>
          );
        })
      )}
    </PanelContainer>
  );
};

export default ApprovalQueuePanel;
