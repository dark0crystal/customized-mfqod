import { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingMissingItemsCount } from '@/services/itemsService';
import { DASHBOARD_BADGE_POLL_INTERVAL_MS } from '@/constants/dashboardPolling';

/**
 * Hook to fetch and manage pending missing items count
 * Automatically refreshes on mount and can be manually refreshed
 * All authenticated users can fetch their own pending missing items count
 * (Admins see all pending items, regular users see only their own)
 */
export function usePendingMissingItemsCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const fetchCount = useCallback(async (silent = false) => {
    // Increment request ID to track the current request
    const currentRequestId = ++requestIdRef.current;
    
    try {
      if (!silent) {
        setLoading(true);
      }
      setError(null);
      const pendingCount = await getPendingMissingItemsCount();
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setCount(pendingCount);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pending missing items count';
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setError(errorMessage);
        setCount(0);
      }
    } finally {
      // Only update loading if this is still the current request
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        if (!silent) {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    
    void fetchCount(false);

    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void fetchCount(true);
    }, DASHBOARD_BADGE_POLL_INTERVAL_MS);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchCount]);

  const refresh = useCallback(() => fetchCount(false), [fetchCount]);

  return {
    count,
    loading,
    error,
    refresh,
  };
}










