/**
 * EmailConnection Component
 * 
 * Displays connection status and provides OAuth flow for email providers.
 * Supports Microsoft Outlook (primary) and Gmail (future).
 */
import React, { useState } from 'react';
import styled from 'styled-components';
import { apiClient } from '../../services/apiService'; // FIX: Use authenticated client
import { toast } from 'react-hot-toast';
import { Mail, CheckCircle, AlertCircle, ExternalLink } from 'lucide-react';

interface EmailConnectionProps {
  provider: 'microsoft' | 'google';
  isConnected: boolean;
  connectedEmail?: string;
  connectedName?: string;
  isExpired?: boolean;
  onRefresh?: () => void;
}

const providerConfig = {
  microsoft: {
    name: 'Outlook',
    displayName: 'Microsoft Outlook',
    color: '#0078d4',
    description: 'Connect your Microsoft 365 or Outlook.com account',
  },
  google: {
    name: 'Gmail',
    displayName: 'Google Gmail',
    color: '#ea4335',
    description: 'Connect your Gmail account',
    comingSoon: true,
  },
};

export const EmailConnection: React.FC<EmailConnectionProps> = ({
  provider,
  isConnected,
  connectedEmail,
  connectedName,
  isExpired = false,
}) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const config = providerConfig[provider];

  const handleConnect = async () => {
    if (config.comingSoon) {
      toast.error('Gmail integration coming soon!');
      return;
    }

    setIsConnecting(true);
    
    try {
      const response = await apiClient.get('/integrations/oauth/authorize/', { // FIX: Use apiClient
        params: { provider },
      });
      window.location.href = response.data.auth_url;
    } catch (error: any) {
      console.error('[EmailConnection] OAuth initiation failed:', error);
      toast.error(error.response?.data?.error || 'Failed to initiate connection');
      setIsConnecting(false);
    }
  };

  return (
    <ConnectionCard color={config.color}>
      <HeaderSection>
        <LogoContainer color={config.color}>
          <Mail size={28} strokeWidth={2} />
        </LogoContainer>
        <TitleSection>
          <Title>{config.displayName}</Title>
          <Description>{config.description}</Description>
        </TitleSection>
      </HeaderSection>

      {isConnected ? (
        <ConnectedSection>
          <StatusBadge status={isExpired ? 'warning' : 'success'}>
            {isExpired ? (
              <>
                <AlertCircle size={14} />
                <span>Token Expired</span>
              </>
            ) : (
              <>
                <CheckCircle size={14} />
                <span>Connected</span>
              </>
            )}
          </StatusBadge>
          
          <ConnectionInfo>
            {connectedName && <InfoRow><strong>{connectedName}</strong></InfoRow>}
            {connectedEmail && <InfoRow>{connectedEmail}</InfoRow>}
          </ConnectionInfo>

          {isExpired && (
            <ReconnectButton onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? 'Reconnecting...' : 'Reconnect'}
            </ReconnectButton>
          )}
        </ConnectedSection>
      ) : (
        <DisconnectedSection>
          {config.comingSoon ? (
            <ComingSoonBadge>Coming Soon</ComingSoonBadge>
          ) : (
            <ConnectButton 
              onClick={handleConnect} 
              disabled={isConnecting}
              color={config.color}
            >
              {isConnecting ? (
                <>
                  <Spinner />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <ExternalLink size={16} />
                  <span>Connect {config.name}</span>
                </>
              )}
            </ConnectButton>
          )}
        </DisconnectedSection>
      )}
    </ConnectionCard>
  );
};

const ConnectionCard = styled.div<{ color: string }>`
  background: rgb(var(--color-surface));
  border: 1px solid rgb(var(--color-border));
  border-radius: 12px;
  padding: 24px;
  transition: all 0.2s ease;
  
  &:hover {
    border-color: ${props => props.color}33;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }
`;

const HeaderSection = styled.div`
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
`;

const LogoContainer = styled.div<{ color: string }>`
  width: 56px;
  height: 56px;
  border-radius: 12px;
  background: ${props => props.color}15;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  svg {
    color: ${props => props.color};
  }
`;

const TitleSection = styled.div`
  flex: 1;
`;

const Title = styled.h3`
  font-size: 18px;
  font-weight: 600;
  color: rgb(var(--color-text-primary));
  margin: 0 0 4px 0;
`;

const Description = styled.p`
  font-size: 14px;
  color: rgb(var(--color-text-secondary));
  margin: 0;
  line-height: 1.4;
`;

const ConnectedSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const DisconnectedSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const StatusBadge = styled.div<{ status: 'success' | 'warning' }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  width: fit-content;
  
  ${props => props.status === 'success' && `
    background: rgb(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
  `}
  
  ${props => props.status === 'warning' && `
    background: rgb(234, 179, 8, 0.1);
    color: rgb(234, 179, 8);
  `}
  
  svg {
    flex-shrink: 0;
  }
`;

const ConnectionInfo = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: rgb(var(--color-background));
  border-radius: 8px;
`;

const InfoRow = styled.div`
  font-size: 14px;
  color: rgb(var(--color-text-primary));
  line-height: 1.5;
  
  strong {
    font-weight: 600;
  }
`;

const ConnectButton = styled.button<{ color: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  background: ${props => props.color};
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover:not(:disabled) {
    background: ${props => props.color}dd;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px ${props => props.color}40;
  }
  
  &:active:not(:disabled) {
    transform: translateY(0);
  }
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  svg {
    flex-shrink: 0;
  }
`;

const ReconnectButton = styled(ConnectButton).attrs({ color: '#667eea' })``;

const ComingSoonBadge = styled.div`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  background: rgb(var(--color-border));
  color: rgb(var(--color-text-secondary));
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  width: fit-content;
`;

const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
