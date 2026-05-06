import { useEffect, useState } from 'react';

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

interface UsePortalGrantSnapshotResult {
  data: PortalGrantSnapshot | null;
  error: PortalServiceError | null;
  isLoading: boolean;
}

export const usePortalGrantSnapshot = ({
  tenantId,
  grantId,
  token,
}: UsePortalGrantSnapshotArgs): UsePortalGrantSnapshotResult => {
  const [data, setData] = useState<PortalGrantSnapshot | null>(null);
  const [error, setError] = useState<PortalServiceError | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!tenantId || !grantId || !token) {
      setData(null);
      setError(null);
      setIsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setIsLoading(true);
    setError(null);

    getPortalGrantSnapshot({
      tenantId,
      grantId,
      token,
    })
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setData(snapshot);
      })
      .catch((caughtError) => {
        if (cancelled) {
          return;
        }

        const nextError =
          caughtError instanceof PortalServiceError
            ? caughtError
            : new PortalServiceError('unknown', 'Unable to load this portal link right now.');

        setData(null);
        setError(nextError);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [grantId, tenantId, token]);

  return {
    data,
    error,
    isLoading,
  };
};
