import { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingTransferRequestsCount } from '@/services/transferRequestsService';
import { usePermissions } from '@/PermissionsContext';
import { DASHBOARD_BADGE_POLL_INTERVAL_MS } from '@/constants/dashboardPolling';

/**
 * Pending transfer-requests badge count.
 * Does not call the API unless the user has can_manage_transfer_requests (matches backend /pending-count).
 */
export function usePendingTransferRequestsCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const canPoll = hasPermission('can_manage_transfer_requests');

  const fetchCount = useCallback(
    async (silent = false) => {
      if (!canPoll) {
        if (isMountedRef.current) {
          setCount(0);
          setLoading(false);
        }
        return;
      }

      const currentRequestId = ++requestIdRef.current;
      try {
        if (!silent) {
          setLoading(true);
        }
        const pendingCount = await getPendingTransferRequestsCount();
        if (currentRequestId === requestIdRef.current && isMountedRef.current) {
          setCount(pendingCount);
        }
      } catch {
        if (currentRequestId === requestIdRef.current && isMountedRef.current) {
          setCount(0);
        }
      } finally {
        if (currentRequestId === requestIdRef.current && isMountedRef.current && !silent) {
          setLoading(false);
        }
      }
    },
    [canPoll]
  );

  useEffect(() => {
    isMountedRef.current = true;

    if (!permissionsLoading) {
      void fetchCount(false);

      if (canPoll) {
        const interval = setInterval(() => {
          if (typeof document !== 'undefined' && document.hidden) return;
          void fetchCount(true);
        }, DASHBOARD_BADGE_POLL_INTERVAL_MS);

        return () => {
          isMountedRef.current = false;
          clearInterval(interval);
        };
      }

      setLoading(false);
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchCount, permissionsLoading, canPoll]);

  return { count, loading };
}
