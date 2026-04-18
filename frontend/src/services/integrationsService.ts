import { apiClient } from './apiService';

export interface OAuthConnection {
  provider: string;
  provider_name: string;
  connected_email: string;
  connected_name: string;
  is_expired: boolean;
  connected_at: string;
}

export interface OAuthConnectionStatus {
  connections: OAuthConnection[];
  count: number;
}

export const integrationsService = {
  async getOAuthConnectionStatus(): Promise<OAuthConnectionStatus> {
    const response = await apiClient.get<OAuthConnectionStatus>('/integrations/oauth/status/');
    return response.data;
  },

  async disconnectOAuth(provider: string): Promise<void> {
    await apiClient.post('/integrations/oauth/disconnect/', { provider });
  },
};
