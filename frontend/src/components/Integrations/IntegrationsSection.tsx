import React, { useEffect, useState, useCallback } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService'; // FIX: Use authenticated client
import { toast } from 'react-hot-toast';
import { confirmDialog } from '@/utils/uiDialogs';
import { Trash2, RefreshCw } from 'lucide-react';
import { EmailConnection } from './EmailConnection';
import { IngestionMonitor } from './IngestionMonitor';

interface Connection {
  provider: 'microsoft' | 'google';
  provider_name: string;
  connected_email: string;
  connected_name: string;
  is_expired: boolean;
  connected_at: string;
}

export const IntegrationsSection: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDisconnecting, setIsDisconnecting] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<string | null>(null);

  const loadConnections = useCallback(async () => {
    try {
      const response = await apiClient.get('/integrations/oauth/status/'); // FIX: Use apiClient
      setConnections(response.data.connections || []);
      setLastCheckedAt(new Date().toISOString());
    } catch (error: any) {
      console.error('[IntegrationsSection] Failed to load connections:', error);
      toast.error('Failed to load integrations');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();

    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');
    const provider = params.get('provider');

    if (success === 'connected') {
      if (provider === 'microsoft') {
        toast.success('Outlook Connected!');
      } else {
        toast.success('Email account connected successfully!');
      }
      window.history.replaceState({}, '', window.location.pathname);
      loadConnections();
    } else if (error) {
      const message = params.get('message') || error;
      if (provider === 'microsoft') {
        toast.error(`Outlook connection failed: ${message}`);
      } else {
        toast.error(`Connection failed: ${message}`);
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [loadConnections]);

  const handleDisconnect = async (provider: string) => {
    const confirmed = await confirmDialog({
      title: 'Disconnect integration?',
      content: `Are you sure you want to disconnect ${provider}?`,
      okText: 'Disconnect',
      cancelText: 'Cancel',
      danger: true,
    });
    if (!confirmed) return;

    setIsDisconnecting(provider);
    try {
      await apiClient.post('/integrations/oauth/disconnect/', { provider }); // FIX: Use apiClient
      toast.success(`${provider} disconnected successfully`);
      loadConnections();
    } catch (error: any) {
      console.error('[IntegrationsSection] Disconnect failed:', error);
      toast.error(error.response?.data?.error || 'Failed to disconnect');
    } finally {
      setIsDisconnecting(null);
    }
  };

  const microsoftConnection = connections.find(c => c.provider === 'microsoft');
  const gmailConnection = connections.find(c => c.provider === 'google');

  if (isLoading) {
    return (
      <Section>
        <SectionTitle>Email Integrations</SectionTitle>
        <p>Loading...</p>
      </Section>
    );
  }

  return (
    <Section>
      <SectionHeader>
        <div>
          <SectionTitle>Email Integrations</SectionTitle>
          <SectionDescription>
            Connect email accounts to automate workflows
          </SectionDescription>
        </div>
        <RefreshButton onClick={loadConnections}>
          <RefreshCw size={18} />
        </RefreshButton>
      </SectionHeader>

      <IntegrationGrid>
        <EmailConnection
          provider="microsoft"
          isConnected={!!microsoftConnection}
          connectedEmail={microsoftConnection?.connected_email}
          connectedName={microsoftConnection?.connected_name}
          connectedAt={microsoftConnection?.connected_at}
          isExpired={microsoftConnection?.is_expired}
          lastCheckedAt={lastCheckedAt || undefined}
        />
        <EmailConnection
          provider="google"
          isConnected={!!gmailConnection}
          connectedEmail={gmailConnection?.connected_email}
          connectedName={gmailConnection?.connected_name}
          connectedAt={gmailConnection?.connected_at}
          isExpired={gmailConnection?.is_expired}
          lastCheckedAt={lastCheckedAt || undefined}
        />
      </IntegrationGrid>

      {connections.length > 0 && (
        <ConnectionsList>
          <h3>Active Connections ({connections.length})</h3>
          {connections.map((conn) => (
            <ConnectionItem key={conn.provider}>
              <div>
                <strong>{conn.provider_name}</strong>
                <div>{conn.connected_email}</div>
              </div>
              <DisconnectButton
                onClick={() => handleDisconnect(conn.provider)}
                disabled={isDisconnecting === conn.provider}
              >
                <Trash2 size={16} />
                {isDisconnecting === conn.provider ? 'Disconnecting...' : 'Disconnect'}
              </DisconnectButton>
            </ConnectionItem>
          ))}
        </ConnectionsList>
      )}
      
      {/* Email Ingestion Monitor - Phase 5.5 */}
      {microsoftConnection && !microsoftConnection.is_expired && (
        <MonitorSection>
          <IngestionMonitor />
        </MonitorSection>
      )}
    </Section>
  );
};

const Section = styled.div`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 24px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px 0;
`;

const SectionDescription = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
`;

const RefreshButton = styled.button`
  padding: 8px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  cursor: pointer;
  color: rgb(var(--color-text-secondary));
  
  &:hover {
    color: rgb(var(--color-text-primary));
  }
`;

const IntegrationGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
  margin-bottom: 32px;
`;

const ConnectionsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 12px;
  }
`;

const ConnectionItem = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: rgb(var(--color-background));
  border: 1px solid rgb(var(--color-border));
  border-radius: 8px;
  
  strong {
    display: block;
    margin-bottom: 4px;
  }
  
  div {
    font-size: 14px;
    color: rgb(var(--color-text-secondary));
  }
`;

const DisconnectButton = styled.button`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: transparent;
  border: 1px solid rgb(239, 68, 68, 0.3);
  color: rgb(239, 68, 68);
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  
  &:hover:not(:disabled) {
    background: rgb(239, 68, 68, 0.1);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const MonitorSection = styled.div`
  margin-top: 32px;
  padding-top: 32px;
  border-top: 1px solid rgb(var(--color-border));
`;
