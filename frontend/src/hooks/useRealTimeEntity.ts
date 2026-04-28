import { useEffect, useMemo } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';

import { useAuthState } from '@/contexts/AuthContext';
import { config } from '@/config/runtime';
import { getAccessToken } from '@/services/jwtService';
import { getValidTenantId } from '@/utils/tenantId';
import { logger } from '@/utils/logger';

type MutationEvent = {
  type?: string;
  action?: string;
  entity_type?: string;
  id?: string;
  related_entity_type?: string;
  related_entity_id?: string;
};

type UseRealTimeEntityOptions = {
  enabled?: boolean;
  queryKeys?: QueryKey[];
};

const buildMutationUrl = (tenantId: string, accessToken: string) => {
  const rawBase = config.API_BASE_URL.replace(/\/api\/v1\/?$/, '') || window.location.origin;
  const url = new URL(rawBase, window.location.origin);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/ws/entities/mutations/';
  url.searchParams.set('tenant_id', tenantId);
  url.searchParams.set('access_token', accessToken);
  return url.toString();
};

const matchesEntity = (payload: MutationEvent, entityType: string, entityId: string) =>
  (payload.entity_type === entityType && payload.id === entityId) ||
  (payload.related_entity_type === entityType && payload.related_entity_id === entityId);

export const useRealTimeEntity = (
  entityType: string,
  entityId: string | null | undefined,
  options: UseRealTimeEntityOptions = {}
) => {
  const queryClient = useQueryClient();
  const { isAuthenticated, loading } = useAuthState();
  const tenantId = getValidTenantId();
  const accessToken = getAccessToken();

  const enabled = Boolean(options.enabled ?? true) && Boolean(entityType) && Boolean(entityId);
  const queryKeys = useMemo<QueryKey[]>(
    () => options.queryKeys ?? [['entity', entityType, entityId ?? '']],
    [entityId, entityType, options.queryKeys]
  );

  useEffect(() => {
    if (!enabled || loading || !isAuthenticated || !tenantId || !accessToken || !entityId) {
      return undefined;
    }

    const socket = new WebSocket(buildMutationUrl(tenantId, accessToken));

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as MutationEvent;
        if (!matchesEntity(payload, entityType, entityId)) {
          return;
        }

        queryKeys.forEach((queryKey) => {
          void queryClient.invalidateQueries({ queryKey });
        });
      } catch (error) {
        logger.warn('[Realtime] Failed to process entity mutation message', error);
      }
    };

    socket.onerror = (event) => {
      logger.warn('[Realtime] Entity mutation websocket error', event);
    };

    return () => {
      socket.close();
    };
  }, [accessToken, enabled, entityId, entityType, isAuthenticated, loading, queryClient, queryKeys, tenantId]);
};
