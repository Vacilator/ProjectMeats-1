/**
 * Integration Settings Page - Connect email providers (Microsoft, Gmail, etc.)
 */
import React, { useState, useEffect } from 'react';
import { Skeleton } from 'antd';
import { AlertCircle, CheckCircle, Mail, ExternalLink } from 'lucide-react';
import { confirmDialog } from '@/utils/uiDialogs';
import { integrationsService, type OAuthConnection } from '@/services/integrationsService';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export const IntegrationSettings: React.FC = () => {
  useDocumentTitle('Email Integrations');
  const [connections, setConnections] = useState<OAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);

  // Check for OAuth callback status in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const successParam = params.get('success');
    const errorParam = params.get('error');
    const messageParam = params.get('message');

    if (successParam === 'connected') {
      setSuccess('Email account connected successfully!');
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (errorParam) {
      setError(`Connection failed: ${messageParam || errorParam}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  useEffect(() => {
    fetchConnectionStatus();
  }, []);

  const fetchConnectionStatus = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await integrationsService.getOAuthConnectionStatus();
      setConnections(data.connections);
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((data.error as string) || 'Failed to fetch connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (provider: string) => {
    setError(null);
    const tenantId = localStorage.getItem('tenantId');
    const tenantParam = tenantId ? `&tenant_id=${encodeURIComponent(tenantId)}` : '';
    window.location.href = `/api/v1/integrations/oauth/authorize/?provider=${encodeURIComponent(provider)}&redirect=1${tenantParam}`;
  };

  const handleDisconnect = async (provider: string) => {
    const confirmed = await confirmDialog({
      title: 'Disconnect email account?',
      content: 'Are you sure you want to disconnect this email account?',
      okText: 'Disconnect',
      cancelText: 'Cancel',
      danger: true,
    });

    if (!confirmed) return;

    setDisconnecting(provider);
    setError(null);

    try {
      await integrationsService.disconnectOAuth(provider);
      setSuccess('Email account disconnected successfully');
      fetchConnectionStatus();
    } catch (err: unknown) {
      const errObj = (err && typeof err === 'object' ? err : {}) as Record<string, unknown>;
      const resp = (errObj.response && typeof errObj.response === 'object' ? errObj.response : {}) as Record<string, unknown>;
      const data = (resp.data && typeof resp.data === 'object' ? resp.data : {}) as Record<string, unknown>;
      setError((data.error as string) || 'Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const getConnectionForProvider = (provider: string): OAuthConnection | undefined => {
    return connections.find(conn => conn.provider === provider);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Integrations</h1>
        <p style={{ color: 'rgb(var(--color-text-secondary))' }}>
          Connect your email accounts to send automated emails from workflows
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 rounded-lg flex items-start" style={{ background: 'rgba(var(--color-error), 0.05)', border: '1px solid rgba(var(--color-error), 0.2)' }}>
          <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--color-error))' }} />
          <div className="flex-1">
            <h3 className="font-semibold" style={{ color: 'rgb(var(--color-error))' }}>Error</h3>
            <p className="text-sm" style={{ color: 'rgba(var(--color-error), 0.8)' }}>{error}</p>
          </div>
          <button onClick={() => setError(null)} style={{ color: 'rgb(var(--color-error))' }}>
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-lg flex items-start" style={{ background: 'rgba(var(--color-success), 0.05)', border: '1px solid rgba(var(--color-success), 0.2)' }}>
          <CheckCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" style={{ color: 'rgb(var(--color-success))' }} />
          <div className="flex-1">
            <h3 className="font-semibold" style={{ color: 'rgb(var(--color-success))' }}>Success</h3>
            <p className="text-sm" style={{ color: 'rgba(var(--color-success), 0.8)' }}>{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} style={{ color: 'rgb(var(--color-success))' }}>
            ×
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div style={{ padding: 16 }}>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      )}

      {/* Email Providers */}
      {!loading && (
        <div className="space-y-4">
          {/* Microsoft Outlook */}
          <EmailProviderCard
            provider="microsoft"
            name="Microsoft Outlook"
            description="Send emails through your Microsoft 365 or Outlook.com account"
            icon={<Mail className="w-6 h-6" />}
            connection={getConnectionForProvider('microsoft')}
            onConnect={() => handleConnect('microsoft')}
            onDisconnect={() => handleDisconnect('microsoft')}
            isDisconnecting={disconnecting === 'microsoft'}
          />

          {/* Gmail (Coming Soon) */}
          <EmailProviderCard
            provider="google"
            name="Gmail"
            description="Send emails through your Gmail account"
            icon={<Mail className="w-6 h-6" />}
            connection={getConnectionForProvider('google')}
            onConnect={() => handleConnect('google')}
            onDisconnect={() => handleDisconnect('google')}
            isDisconnecting={disconnecting === 'google'}
            comingSoon={true}
          />
        </div>
      )}

      {/* Help Text */}
      <div className="mt-8 p-4 rounded-lg" style={{ background: 'rgba(var(--color-info), 0.05)', border: '1px solid rgba(var(--color-info), 0.2)' }}>
        <h3 className="font-semibold mb-2" style={{ color: 'rgb(var(--color-info))' }}>How it works</h3>
        <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: 'rgba(var(--color-info), 0.8)' }}>
          <li>Connect your email account using secure OAuth authentication</li>
          <li>Your credentials are encrypted and stored securely</li>
          <li>Use the email node in workflows to send automated emails</li>
          <li>Emails are sent from your connected account</li>
        </ul>
      </div>
    </div>
  );
};

interface EmailProviderCardProps {
  provider: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  connection?: OAuthConnection;
  onConnect: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
  comingSoon?: boolean;
}

const EmailProviderCard: React.FC<EmailProviderCardProps> = ({
  provider: _provider,
  name,
  description,
  icon,
  connection,
  onConnect,
  onDisconnect,
  isDisconnecting,
  comingSoon = false,
}) => {
  const isConnected = !!connection;
  const isExpired = connection?.is_expired;

  return (
    <div className="rounded-lg p-6 transition-colors" style={{ border: '1px solid rgb(var(--color-border))' }}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className="p-3 rounded-lg" style={{ background: 'rgba(var(--color-info), 0.1)' }}>
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">{name}</h3>
            <p className="text-sm mb-3" style={{ color: 'rgb(var(--color-text-secondary))' }}>{description}</p>

            {isConnected && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {isExpired ? (
                    <span className="px-2 py-1 text-xs font-medium rounded" style={{ background: 'rgba(var(--color-warning), 0.1)', color: 'rgb(var(--color-warning))' }}>
                      Token Expired
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium rounded flex items-center" style={{ background: 'rgba(var(--color-success), 0.1)', color: 'rgb(var(--color-success))' }}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-sm" style={{ color: 'rgb(var(--color-text-secondary))' }}>
                  <strong>{connection.connected_name}</strong> ({connection.connected_email})
                </p>
                <p className="text-xs" style={{ color: 'rgb(var(--color-text-tertiary))' }}>
                  Connected on {new Date(connection.connected_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          {comingSoon ? (
            <span className="px-4 py-2 text-sm font-medium rounded cursor-not-allowed" style={{ background: 'rgb(var(--color-bg-secondary))', color: 'rgb(var(--color-text-tertiary))' }}>
              Coming Soon
            </span>
          ) : isConnected ? (
            <>
              {isExpired && (
                <button
                  onClick={onConnect}
                  className="px-4 py-2 rounded transition-colors flex items-center space-x-2"
                  style={{ background: 'rgb(var(--color-primary))', color: 'rgb(var(--color-text-inverse))' }}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Reconnect</span>
                </button>
              )}
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 rounded transition-colors disabled:opacity-50"
                style={{ border: '1px solid rgba(var(--color-error), 0.3)', color: 'rgb(var(--color-error))' }}
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="px-4 py-2 rounded transition-colors flex items-center space-x-2"
              style={{ background: 'rgb(var(--color-primary))', color: 'rgb(var(--color-text-inverse))' }}
            >
              <ExternalLink className="w-4 h-4" />
              <span>Connect</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationSettings;
