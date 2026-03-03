/**
 * Email Ingestion Monitor Widget
 * 
 * Displays recent order-related emails ingested from Microsoft Outlook.
 * Shows processing status and allows manual sync trigger.
 * Designed for Cockpit Dashboard widget grid.
 * 
 * Created: 2026-02-28 - Phase 5.6 Email Ingestion Monitoring
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Mail, RefreshCw, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { businessApi } from '../../services/businessApi';
import { useTenant } from '../../contexts/TenantContext';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface EmailLog {
  id: string;
  message_id: string;
  subject: string;
  sender: string;
  status: 'logged' | 'ai_parsing' | 'order_created' | 'failed' | 'ignored';
  provider_type: string | null;
  has_attachments: boolean;
  extracted_data: Record<string, any> | null;
  related_order_id: string | null;
  error_message: string | null;
  created_at: string;
  processed_at: string | null;
}

interface EmailLogsResponse {
  emails: EmailLog[];
  count: number;
}

interface EmailIngestionMonitorWidgetProps {
  onRefresh?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 12px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 8px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 6px;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
`;

const Button = styled.button<{ $primary?: boolean }>`
  padding: 4px 10px;
  background: ${props => props.$primary ? 'rgb(var(--color-primary))' : 'transparent'};
  border: 1px solid ${props => props.$primary ? 'rgb(var(--color-primary))' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-sm);
  color: ${props => props.$primary ? 'white' : 'rgb(var(--color-text-secondary))'};
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  transition: all 0.15s ease;
  
  &:hover:not(:disabled) {
    background: ${props => props.$primary ? 'rgb(var(--color-primary-dark))' : 'rgb(var(--color-background))'};
    color: ${props => props.$primary ? 'white' : 'rgb(var(--color-primary))'};
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const EmailList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
`;

const EmailItem = styled.div`
  padding: 10px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  display: flex;
  flex-direction: column;
  gap: 6px;
  transition: all 0.15s ease;
  
  &:hover {
    border-color: rgb(var(--color-primary));
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
`;

const EmailHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
`;

const EmailSubject = styled.div`
  font-size: 12px;
  font-weight: 500;
  color: rgb(var(--color-text-primary));
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const StatusBadge = styled.div<{ $status: EmailLog['status'] }>`
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-size: 10px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
  
  ${props => {
    switch (props.$status) {
      case 'logged':
        return `
          background: rgba(59, 130, 246, 0.1);
          color: rgb(59, 130, 246);
        `;
      case 'ai_parsing':
        return `
          background: rgba(234, 179, 8, 0.1);
          color: rgb(234, 179, 8);
        `;
      case 'order_created':
        return `
          background: rgba(34, 197, 94, 0.1);
          color: rgb(34, 197, 94);
        `;
      case 'failed':
        return `
          background: rgba(239, 68, 68, 0.1);
          color: rgb(239, 68, 68);
        `;
      case 'ignored':
        return `
          background: rgba(156, 163, 175, 0.1);
          color: rgb(107, 114, 128);
        `;
    }
  }}
`;

const EmailMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  color: rgb(var(--color-text-secondary));
  flex: 1;
  
  svg {
    width: 48px;
    height: 48px;
    opacity: 0.3;
    margin-bottom: 12px;
  }
  
  p {
    margin: 0;
    font-size: 12px;
  }
`;

const LoadingState = styled(EmptyState)`
  color: rgb(var(--color-primary));
  
  svg {
    opacity: 1;
    animation: spin 1s linear infinite;
  }
  
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

// ============================================================================
// Component
// ============================================================================

export const EmailIngestionMonitorWidget: React.FC<EmailIngestionMonitorWidgetProps> = ({
  onRefresh
}) => {
  const { tenant } = useTenant();
  const [emails, setEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  /**
   * Fetch email logs from API
   */
  const fetchEmailLogs = async () => {
    if (!tenant) return;

    setLoading(true);
    try {
      const response = await businessApi.get<EmailLogsResponse>(
        `/tenants/${tenant.id}/integrations/email/logs/?limit=5`
      );
      setEmails(response.data.emails);
    } catch (error) {
      console.error('Failed to fetch email logs:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Trigger manual email sync
   */
  const handleSyncNow = async () => {
    if (!tenant) return;

    setSyncing(true);
    try {
      await businessApi.post(`/tenants/${tenant.id}/integrations/email/sync/`);
      
      // Refresh logs after 2 seconds
      setTimeout(() => {
        fetchEmailLogs();
      }, 2000);
    } catch (error) {
      console.error('Failed to trigger sync:', error);
    } finally {
      setSyncing(false);
    }
  };

  // Load email logs on mount and tenant change
  useEffect(() => {
    fetchEmailLogs();
  }, [tenant]);

  /**
   * Get status icon and label
   */
  const getStatusInfo = (status: EmailLog['status']) => {
    switch (status) {
      case 'logged':
        return { icon: <Mail size={12} />, label: 'New' };
      case 'ai_parsing':
        return { icon: <Zap size={12} />, label: 'Processing' };
      case 'order_created':
        return { icon: <CheckCircle size={12} />, label: 'Order Created' };
      case 'failed':
        return { icon: <AlertCircle size={12} />, label: 'Failed' };
      case 'ignored':
        return { icon: <Clock size={12} />, label: 'Review Needed' };
    }
  };

  return (
    <Container>
      <Header>
        <Title>
          <Mail size={16} />
          Email Ingestion
        </Title>
        <Actions>
          <Button onClick={handleSyncNow} disabled={syncing} $primary>
            <RefreshCw size={12} className={syncing ? 'spinning' : ''} />
            {syncing ? 'Syncing...' : 'Sync'}
          </Button>
          <Button onClick={fetchEmailLogs} disabled={loading}>
            <RefreshCw size={12} />
          </Button>
        </Actions>
      </Header>

      <EmailList>
        {loading ? (
          <LoadingState>
            <RefreshCw />
            <p>Loading emails...</p>
          </LoadingState>
        ) : emails.length === 0 ? (
          <EmptyState>
            <Mail />
            <p>No emails ingested yet</p>
            <p style={{ marginTop: '4px', fontSize: '10px' }}>
              Click "Sync" to fetch order-related emails
            </p>
          </EmptyState>
        ) : (
          emails.map(email => {
            const statusInfo = getStatusInfo(email.status);
            return (
              <EmailItem key={email.id}>
                <EmailHeader>
                  <EmailSubject title={email.subject}>
                    {email.subject}
                  </EmailSubject>
                  <StatusBadge $status={email.status}>
                    {statusInfo.icon}
                    {statusInfo.label}
                  </StatusBadge>
                </EmailHeader>
                <EmailMeta>
                  <span>From: {email.sender}</span>
                  {email.has_attachments && <span>📎</span>}
                  <span>•</span>
                  <span>{new Date(email.created_at).toLocaleDateString()}</span>
                </EmailMeta>
              </EmailItem>
            );
          })
        )}
      </EmailList>
    </Container>
  );
};

export default EmailIngestionMonitorWidget;
