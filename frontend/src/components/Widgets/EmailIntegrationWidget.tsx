/**
 * Email Integration Widget
 *
 * Displays connected email accounts with status indicators.
 * Allows users to connect/disconnect Outlook and Gmail accounts.
 * Shows token expiration warnings and quick actions.
 *
 * Created: 2026-02-26 - Email Cockpit Management
 */
import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { Mail, CheckCircle, AlertTriangle, XCircle, Plus, Trash2, RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/apiService';
import { toApiErrorText } from '@/services/apiErrorPresentation';
import { logger } from '@/utils/logger';
import { formatDateLocal } from '@/utils/formatters';
import { confirmDialog, showAlert } from '@/utils/uiDialogs';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

interface EmailAccount {
  id: number;
  provider: 'outlook' | 'gmail';
  email_address: string;
  status: 'active' | 'expired' | 'revoked' | 'error';
  display_name: string;
  created_at: string;
  last_synced_at: string | null;
  is_token_expired: boolean;
  needs_webhook_renewal: boolean;
}

interface EmailIntegrationWidgetProps {
  onRefresh?: () => void;
}

// ============================================================================
// Styled Components
// ============================================================================

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 16px;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 12px;
  border-bottom: 1px solid rgb(var(--color-border));
`;

const Title = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  display: flex;
  align-items: center;
  gap: 8px;
`;

const RefreshButton = styled.button`
  padding: 6px 12px;
  background: transparent;
  border: 1px solid rgb(var(--color-border));
  border-radius: var(--radius-sm);
  color: rgb(var(--color-text-secondary));
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  transition: all 0.15s ease;

  &:hover {
    background: rgb(var(--color-background));
    color: rgb(var(--color-primary));
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const AccountsList = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const AccountCard = styled.div<{ $status: string }>`
  padding: 16px;
  background: rgb(var(--color-surface));
  border: 1px solid ${props => {
    switch (props.$status) {
      case 'active': return 'rgba(var(--color-success), 0.3)';
      case 'expired': return 'rgba(var(--color-warning), 0.3)';
      case 'error':
      case 'revoked': return 'rgba(var(--color-error), 0.3)';
      default: return 'rgb(var(--color-border))';
    }
  }};
  border-radius: var(--radius-md);
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 2px 8px rgba(var(--color-overlay), 0.1);
  }
`;

const AccountHeader = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
`;

const AccountInfo = styled.div`
  flex: 1;
`;

const ProviderBadge = styled.span<{ $provider: string }>`
  display: inline-block;
  padding: 3px 8px;
  background: ${props => props.$provider === 'outlook' ? 'rgba(var(--color-info), 0.1)' : 'rgba(var(--color-error), 0.1)'};
  color: ${props => props.$provider === 'outlook' ? 'rgb(var(--color-info))' : 'rgb(var(--color-error))'};
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
`;

const EmailAddress = styled.div`
  font-size: 14px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin-bottom: 4px;
`;

const DisplayName = styled.div`
  font-size: 12px;
  color: rgb(var(--color-text-secondary));
`;

const StatusIndicator = styled.div<{ $status: string }>`
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 600;
  background: ${props => {
    switch (props.$status) {
      case 'active': return 'rgba(var(--color-success), 0.1)';
      case 'expired': return 'rgba(var(--color-warning), 0.1)';
      case 'error':
      case 'revoked': return 'rgba(var(--color-error), 0.1)';
      default: return 'rgba(var(--color-text-muted), 0.1)';
    }
  }};
  color: ${props => {
    switch (props.$status) {
      case 'active': return 'rgb(var(--color-success))';
      case 'expired': return 'rgb(var(--color-warning))';
      case 'error':
      case 'revoked': return 'rgb(var(--color-error))';
      default: return 'rgb(var(--color-text-muted))';
    }
  }};

  svg {
    width: 14px;
    height: 14px;
  }
`;

const AccountMeta = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(var(--color-border), 0.5);
  font-size: 11px;
  color: rgb(var(--color-text-secondary));
`;

const MetaItem = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
`;

const Actions = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 12px;
`;

const ActionButton = styled.button<{ $variant?: 'danger' | 'primary' }>`
  flex: 1;
  padding: 8px 12px;
  background: ${props => props.$variant === 'danger' ? 'rgba(var(--color-error), 0.1)' : 'rgb(var(--color-background))'};
  border: 1px solid ${props => props.$variant === 'danger' ? 'rgba(var(--color-error), 0.3)' : 'rgb(var(--color-border))'};
  border-radius: var(--radius-sm);
  color: ${props => props.$variant === 'danger' ? 'rgb(var(--color-error))' : 'rgb(var(--color-text-primary))'};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  transition: all 0.15s ease;

  &:hover {
    opacity: 0.8;
    box-shadow: 0 1px 4px rgba(var(--color-overlay), 0.1);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const EmptyState = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 40px 20px;
  color: rgb(var(--color-text-secondary));
`;

const EmptyIcon = styled.div`
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
`;

const EmptyTitle = styled.h4`
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
`;

const EmptyDescription = styled.p`
  margin: 0 0 20px 0;
  font-size: 13px;
  line-height: 1.5;
  max-width: 300px;
`;

const ConnectButton = styled.button`
  padding: 10px 20px;
  background: rgb(var(--color-primary));
  border: none;
  border-radius: var(--radius-md);
  color: rgb(var(--color-text-inverse));
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;

  &:hover {
    opacity: 0.9;
    box-shadow: 0 4px 12px rgba(var(--color-primary), 0.3);
  }

  svg {
    width: 16px;
    height: 16px;
  }
`;

const LoadingState = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--color-text-secondary));
  font-size: 14px;
`;

// ============================================================================
// Component
// ============================================================================

export const EmailIntegrationWidget: React.FC<EmailIntegrationWidgetProps> = ({ onRefresh }) => {
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get('/workflows/email/email-accounts/');
      setAccounts(response.data);
    } catch (err: unknown) {
      logger.error('[EmailIntegrationWidget] Failed to fetch email accounts', err);
      setError(
        toApiErrorText(err, {
          fallbackMessage: 'Failed to load email accounts',
          includeMeta: false,
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  const handleRefresh = () => {
    fetchAccounts();
    onRefresh?.();
  };

  const handleConnect = async (provider: 'outlook' | 'gmail') => {
    try {
      // Use secure apiClient to get the OAuth URL, preserving JWT and Tenant headers.
      // Backend returns JSON { auth_url } (not a redirect) so the SPA can do a top-level navigation.
      const response = await apiClient.get(`/workflows/email/email/${provider}/auth/init/`);

      if (response.data?.auth_url) {
        window.location.href = response.data.auth_url;
      } else {
        throw new Error('Authorization URL not received from server');
      }
    } catch (err: unknown) {
      logger.error('[EmailIntegrationWidget] Failed to initiate OAuth connection', err);
      showAlert({
        type: 'error',
        title: 'Error',
        content: toApiErrorText(err, {
          fallbackMessage: 'Failed to initiate connection. Please try again.',
          includeMeta: false,
        }),
      });
    }
  };

  const handleDisconnect = async (accountId: number) => {
    const confirmed = await confirmDialog({
      title: 'Disconnect email account?',
      content: 'Are you sure you want to disconnect this email account?',
      okText: 'Disconnect',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    try {
      await apiClient.delete(`/workflows/email/email-accounts/${accountId}/`);
      setAccounts(accounts.filter(acc => acc.id !== accountId));
    } catch (err: unknown) {
      logger.error('[EmailIntegrationWidget] Failed to disconnect account', err);
      showAlert({
        type: 'error',
        title: 'Error',
        content: toApiErrorText(err, {
          fallbackMessage: 'Failed to disconnect account',
          includeMeta: false,
        }),
      });
    }
  };

  const handleReconnect = (provider: 'outlook' | 'gmail') => {
    handleConnect(provider);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle />;
      case 'expired': return <AlertTriangle />;
      case 'error':
      case 'revoked': return <XCircle />;
      default: return <AlertTriangle />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return 'Connected';
      case 'expired': return 'Token Expired';
      case 'revoked': return 'Access Revoked';
      case 'error': return 'Connection Error';
      default: return status;
    }
  };

  if (loading) {
    return (
      <Container>
        <Header>
          <Title>
            <Mail />
            Email Integrations
          </Title>
        </Header>
        <LoadingState>Loading email accounts...</LoadingState>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Header>
          <Title>
            <Mail />
            Email Integrations
          </Title>
          <RefreshButton onClick={handleRefresh}>
            <RefreshCw />
            Retry
          </RefreshButton>
        </Header>
        <EmptyState>
          <EmptyIcon>⚠️</EmptyIcon>
          <EmptyTitle>Failed to Load</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyState>
      </Container>
    );
  }

  return (
    <Container>
      <Header>
        <Title>
          <Mail />
          Email Integrations
        </Title>
        <RefreshButton onClick={handleRefresh}>
          <RefreshCw />
          Refresh
        </RefreshButton>
      </Header>

      {accounts.length === 0 ? (
        <EmptyState>
          <EmptyIcon>📧</EmptyIcon>
          <EmptyTitle>No Email Accounts Connected</EmptyTitle>
          <EmptyDescription>
            Connect your Outlook or Gmail account to enable email automation in workflows.
          </EmptyDescription>
          <div style={{ display: 'flex', gap: '12px' }}>
            <ConnectButton onClick={() => handleConnect('outlook')}>
              <Plus />
              Connect Outlook
            </ConnectButton>
            <ConnectButton onClick={() => handleConnect('gmail')}>
              <Plus />
              Connect Gmail
            </ConnectButton>
          </div>
        </EmptyState>
      ) : (
        <AccountsList>
          {accounts.map((account) => (
            <AccountCard key={account.id} $status={account.status}>
              <AccountHeader>
                <AccountInfo>
                  <ProviderBadge $provider={account.provider}>
                    {account.provider === 'outlook' ? 'Outlook' : 'Gmail'}
                  </ProviderBadge>
                  <EmailAddress>{account.email_address}</EmailAddress>
                  {account.display_name && (
                    <DisplayName>{account.display_name}</DisplayName>
                  )}
                </AccountInfo>
                <StatusIndicator $status={account.status}>
                  {getStatusIcon(account.status)}
                  {getStatusLabel(account.status)}
                </StatusIndicator>
              </AccountHeader>

              <AccountMeta>
                <MetaItem>
                  Connected: {formatDateLocal(account.created_at)}
                </MetaItem>
                {account.last_synced_at && (
                  <MetaItem>
                    Last Sync: {formatDateLocal(account.last_synced_at)}
                  </MetaItem>
                )}
              </AccountMeta>

              {(account.is_token_expired || account.needs_webhook_renewal || account.status !== 'active') && (
                <Actions>
                  <ActionButton onClick={() => handleReconnect(account.provider)}>
                    <RefreshCw />
                    Reconnect
                  </ActionButton>
                  <ActionButton $variant="danger" onClick={() => handleDisconnect(account.id)}>
                    <Trash2 />
                    Disconnect
                  </ActionButton>
                </Actions>
              )}

              {account.status === 'active' && !account.is_token_expired && (
                <Actions>
                  <ActionButton $variant="danger" onClick={() => handleDisconnect(account.id)}>
                    <Trash2 />
                    Disconnect
                  </ActionButton>
                </Actions>
              )}
            </AccountCard>
          ))}

          <ConnectButton onClick={() => handleConnect('outlook')} style={{ marginTop: '12px' }}>
            <Plus />
            Add Another Account
          </ConnectButton>
        </AccountsList>
      )}
    </Container>
  );
};
