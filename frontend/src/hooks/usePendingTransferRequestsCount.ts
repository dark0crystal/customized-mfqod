import { useState, useEffect } from 'react';
import { getPendingTransferRequestsCount } from '@/services/transferRequestsService';
import { DASHBOARD_BADGE_POLL_INTERVAL_MS } from '@/constants/dashboardPolling';

/**
 * Hook to fetch and manage pending transfer requests count
 */
export function usePendingTransferRequestsCount() {
  const [count, setCount] = useState<number>(0);

  const fetchCount = async (skipIfHidden = false) => {
    if (skipIfHidden && typeof document !== 'undefined' && document.hidden) return;
    try {
      const pendingCount = await getPendingTransferRequestsCount();
      setCount(pendingCount);
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    void fetchCount(false);

    const interval = setInterval(() => {
      void fetchCount(true);
    }, DASHBOARD_BADGE_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return { count };
}
