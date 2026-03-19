/**
 * Integration Settings Page - Connect email providers (Microsoft, Gmail, etc.)
 */
import React, { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Mail, ExternalLink } from 'lucide-react';
import { apiClient as axios } from '../../services/apiService';

interface Connection {
  provider: string;
  provider_name: string;
  connected_email: string;
  connected_name: string;
  is_expired: boolean;
  connected_at: string;
}

interface ConnectionStatus {
  connections: Connection[];
  count: number;
}

export const IntegrationSettings: React.FC = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
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
      const response = await axios.get<ConnectionStatus>('/integrations/oauth/status/');
      setConnections(response.data.connections);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch connection status');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = (provider: string) => {
    setError(null);
    window.location.href = `/api/v1/integrations/oauth/authorize/?provider=${encodeURIComponent(provider)}&redirect=1`;
  };

  const handleDisconnect = async (provider: string) => {
    if (!confirm(`Are you sure you want to disconnect this email account?`)) {
      return;
    }

    setDisconnecting(provider);
    setError(null);

    try {
      await axios.post('/integrations/oauth/disconnect/', { provider });
      setSuccess('Email account disconnected successfully');
      fetchConnectionStatus();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to disconnect');
    } finally {
      setDisconnecting(null);
    }
  };

  const getConnectionForProvider = (provider: string): Connection | undefined => {
    return connections.find(conn => conn.provider === provider);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Email Integrations</h1>
        <p className="text-gray-600">
          Connect your email accounts to send automated emails from workflows
        </p>
      </div>

      {/* Status Messages */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-red-900">Error</h3>
            <p className="text-red-700 text-sm">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-800">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
          <CheckCircle className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-900">Success</h3>
            <p className="text-green-700 text-sm">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-600 hover:text-green-800">
            ×
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading integrations...</p>
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
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">How it works</h3>
        <ul className="text-blue-700 text-sm space-y-1 list-disc list-inside">
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
  connection?: Connection;
  onConnect: () => void;
  onDisconnect: () => void;
  isDisconnecting: boolean;
  comingSoon?: boolean;
}

const EmailProviderCard: React.FC<EmailProviderCardProps> = ({
  provider,
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
    <div className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            {icon}
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">{name}</h3>
            <p className="text-gray-600 text-sm mb-3">{description}</p>

            {isConnected && (
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  {isExpired ? (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                      Token Expired
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded flex items-center">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-700">
                  <strong>{connection.connected_name}</strong> ({connection.connected_email})
                </p>
                <p className="text-xs text-gray-500">
                  Connected on {new Date(connection.connected_at).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col space-y-2">
          {comingSoon ? (
            <span className="px-4 py-2 bg-gray-100 text-gray-500 text-sm font-medium rounded cursor-not-allowed">
              Coming Soon
            </span>
          ) : isConnected ? (
            <>
              {isExpired && (
                <button
                  onClick={onConnect}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Reconnect</span>
                </button>
              )}
              <button
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="px-4 py-2 border border-red-300 text-red-700 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </>
          ) : (
            <button
              onClick={onConnect}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center space-x-2"
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
