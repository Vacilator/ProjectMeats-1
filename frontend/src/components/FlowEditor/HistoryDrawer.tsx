/**
 * Workflow Version History Drawer
 * 
 * Displays a timeline of all changes made to a workflow form submission.
 * Shows who made changes, when, and what was changed.
 * 
 * Features:
 * - Visual timeline with AntD Timeline component
 * - Shows status transitions (from → to)
 * - Displays user comments/reasons for changes
 * - Restore to previous version (future enhancement)
 * - Real-time updates via polling or WebSocket (future)
 * 
 * Authority: Phase 2.4 - Form Process Groups Version Control
 */

import React, { useEffect, useState } from 'react';
import { Drawer, Timeline, Typography, Tag, Avatar, Button, Empty, Spin, message } from 'antd';
import { ClockCircleOutlined, UserOutlined, RollbackOutlined } from '@ant-design/icons';
import { getErrorMessage } from '@/hooks/useToast';
import { businessApi } from '@/services/businessApi';
import styled from 'styled-components';

const { Title, Text, Paragraph } = Typography;

interface StatusHistoryEntry {
  id: string;
  from_status: string;
  to_status: string;
  changed_by: {
    id: string;
    username: string;
    email: string;
  } | null;
  changed_at: string;
  comment: string;
  submission: string;
}

interface HistoryDrawerProps {
  submissionId: string | null;
  open: boolean;
  onClose: () => void;
}

const StyledDrawer = styled(Drawer)`
  .ant-drawer-body {
    padding: 24px;
  }
`;

const TimelineItemContent = styled.div`
  padding: 12px 0;
`;

const StatusTransition = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  font-weight: 500;
`;

const UserInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: rgba(var(--color-text-secondary));
`;

const CommentBox = styled.div`
  background: rgb(var(--color-bg-secondary, 245, 245, 245));
  border-left: 3px solid rgb(var(--color-primary));
  padding: 12px;
  margin-top: 8px;
  border-radius: 4px;
  font-style: italic;
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
`;

/**
 * Get color for status tag based on status value
 */
function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    pending: 'default',
    in_progress: 'processing',
    approved: 'success',
    rejected: 'error',
    completed: 'success',
    cancelled: 'error',
    draft: 'default',
  };
  
  return statusColors[status] || 'default';
}

/**
 * Format status for display (convert snake_case to Title Case)
 */
function formatStatus(status: string): string {
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // If less than 24 hours ago, show relative time
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    
    if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  }
  
  // Otherwise show date
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const HistoryDrawer: React.FC<HistoryDrawerProps> = ({
  submissionId,
  open,
  onClose,
}) => {
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && submissionId) {
      fetchHistory();
    }
  }, [open, submissionId]);

  const fetchHistory = async () => {
    if (!submissionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await businessApi.get(
        `/workflows/form-submissions/${submissionId}/history/`
      );
      setHistory(response.data || []);
    } catch (err: unknown) {
      console.error('Failed to fetch history:', err);
      const errMsg = getErrorMessage(err, 'Failed to load history');
      setError(errMsg);
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (entryId: string) => {
    // TODO: Implement restore functionality
    message.info('Restore functionality coming soon!');
  };

  return (
    <StyledDrawer
      title={
        <Title level={4} style={{ margin: 0 }}>
          <ClockCircleOutlined style={{ marginRight: 8 }} />
          Version History
        </Title>
      }
      placement="right"
      width={480}
      onClose={onClose}
      open={open}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" tip="Loading history..." />
        </div>
      )}

      {!loading && error && (
        <EmptyState>
          <Empty
            description={error}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button type="primary" onClick={fetchHistory}>
              Retry
            </Button>
          </Empty>
        </EmptyState>
      )}

      {!loading && !error && history.length === 0 && (
        <EmptyState>
          <Empty
            description="No version history yet"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              Changes to this workflow will appear here
            </Text>
          </Empty>
        </EmptyState>
      )}

      {!loading && !error && history.length > 0 && (
        <Timeline mode="left">
          {history.map((entry, index) => (
            <Timeline.Item
              key={entry.id}
              color={getStatusColor(entry.to_status)}
              dot={<ClockCircleOutlined style={{ fontSize: '16px' }} />}
            >
              <TimelineItemContent>
                <StatusTransition>
                  {entry.from_status && (
                    <>
                      <Tag color={getStatusColor(entry.from_status)}>
                        {formatStatus(entry.from_status)}
                      </Tag>
                      <span>→</span>
                    </>
                  )}
                  <Tag color={getStatusColor(entry.to_status)}>
                    {formatStatus(entry.to_status)}
                  </Tag>
                </StatusTransition>

                <UserInfo>
                  <Avatar
                    size="small"
                    icon={<UserOutlined />}
                    src={entry.changed_by?.email ? `https://www.gravatar.com/avatar/${entry.changed_by.email}?d=identicon` : undefined}
                  />
                  <Text type="secondary">
                    {entry.changed_by?.username || 'System'}
                  </Text>
                  <span>•</span>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {formatTimestamp(entry.changed_at)}
                  </Text>
                </UserInfo>

                {entry.comment && (
                  <CommentBox>
                    <Paragraph
                      ellipsis={{ rows: 2, expandable: true }}
                      style={{ margin: 0, fontSize: '13px' }}
                    >
                      {entry.comment}
                    </Paragraph>
                  </CommentBox>
                )}

                {/* Restore button (future enhancement) */}
                {index > 0 && (
                  <Button
                    size="small"
                    icon={<RollbackOutlined />}
                    style={{ marginTop: 8 }}
                    onClick={() => handleRestore(entry.id)}
                    disabled
                  >
                    Restore
                  </Button>
                )}
              </TimelineItemContent>
            </Timeline.Item>
          ))}
        </Timeline>
      )}
    </StyledDrawer>
  );
};
