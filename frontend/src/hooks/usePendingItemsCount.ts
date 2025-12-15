import { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingItemsCount } from '@/services/itemsService';

/**
 * Hook to fetch and manage pending items count
 * Automatically refreshes on mount and can be manually refreshed
 */
export function usePendingItemsCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const fetchCount = useCallback(async () => {
    // Increment request ID to track the current request
    const currentRequestId = ++requestIdRef.current;
    
    try {
      setLoading(true);
      setError(null);
      const pendingCount = await getPendingItemsCount();
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setCount(pendingCount);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pending items count';
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setError(errorMessage);
        console.error('Error fetching pending items count:', err);
        setCount(0);
      }
    } finally {
      // Only update loading if this is still the current request
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCount();
    
    // Optionally refresh count periodically (every 30 seconds)
    const interval = setInterval(() => {
      fetchCount();
    }, 30000);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchCount]);

  return {
    count,
    loading,
    error,
    refresh: fetchCount,
  };
}

