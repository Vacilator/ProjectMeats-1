import { useQuery } from '@tanstack/react-query';

import {
  getPortalGrantSnapshot,
  PortalGrantSnapshot,
  PortalServiceError,
} from '../services/portalService';

interface UsePortalGrantSnapshotArgs {
  tenantId: string;
  grantId: string;
  token: string;
}

export const usePortalGrantSnapshot = ({
  tenantId,
  grantId,
  token,
}: UsePortalGrantSnapshotArgs) =>
  useQuery<PortalGrantSnapshot, PortalServiceError>({
    queryKey: ['portal-grant-snapshot', tenantId, grantId, token],
    enabled: Boolean(tenantId && grantId && token),
    queryFn: () =>
      getPortalGrantSnapshot({
        tenantId,
        grantId,
        token,
      }),
    retry: false,
  });
