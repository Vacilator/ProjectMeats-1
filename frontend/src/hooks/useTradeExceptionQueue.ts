import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  type TradeExceptionListParams,
  tradeExceptionQueueService,
} from '@/services/tradeExceptionQueueService';
import { withTenantQueryKey } from '@/utils/queryKeys';
import { getValidTenantId } from '@/utils/tenantId';

export const useTradeExceptions = (params?: TradeExceptionListParams) => {
  const tenantId = getValidTenantId();

  return useQuery({
    queryKey: withTenantQueryKey(
      'trade-exceptions',
      params?.status ?? 'active',
      params?.trade_session_id ?? '',
      params?.trade_id ?? '',
      params?.failed_step ?? '',
      params?.reason_code ?? '',
      params?.q ?? '',
      params?.page ?? 1,
      params?.page_size ?? 25,
    ),
    queryFn: () => tradeExceptionQueueService.listExceptions(params),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  });
};

export const useTradeExceptionDetail = (id: string | number | null) => {
  const tenantId = getValidTenantId();

  return useQuery({
    queryKey: withTenantQueryKey('trade-exception-detail', id ?? 'none'),
    queryFn: () => tradeExceptionQueueService.getException(String(id)),
    enabled: !!tenantId && id !== null && id !== undefined,
  });
};

export const useRetryTradeException = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string | number) => tradeExceptionQueueService.retryException(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-exceptions') });
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-exception-detail', id) });
    },
  });
};

export const useResolveTradeException = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      resolution_notes,
    }: {
      id: string | number;
      resolution_notes: string;
    }) => tradeExceptionQueueService.resolveException(id, { resolution_notes }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: withTenantQueryKey('trade-exceptions') });
      queryClient.invalidateQueries({
        queryKey: withTenantQueryKey('trade-exception-detail', variables.id),
      });
    },
  });
};

