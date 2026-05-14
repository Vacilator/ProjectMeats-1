import { useQuery } from '@tanstack/react-query';

import { businessApi } from '@/services/businessApi';
import { withTenantQueryKey } from '@/utils/queryKeys';
export interface HealthResponse {
  status: string;
  timestamp: string;
  version: string;
  database?: string;
  debug?: boolean;
  features?: {
    ai?: boolean;
    outlook_oauth?: boolean;
    email_send?: boolean;
    redis?: boolean;
    rag?: boolean;
    sentry?: boolean;
  };
  services?: Record<string, unknown>;
}

const fetchHealth = async (): Promise<HealthResponse> => {
  const res = await businessApi.get<HealthResponse>('/health/');
  return res.data;
};

export const useHealth = () => {
  return useQuery({
    queryKey: withTenantQueryKey('health'),
    queryFn: fetchHealth,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    retry: 1,
  });
};
