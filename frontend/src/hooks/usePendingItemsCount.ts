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
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePendingItemsCount.ts:fetchCount:entry',message:'Hook fetch started',data:{requestId:currentRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    
    try {
      setLoading(true);
      setError(null);
      const pendingCount = await getPendingItemsCount();
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePendingItemsCount.ts:fetchCount:success',message:'Count received',data:{pendingCount,requestId:currentRequestId,isCurrentRequest:currentRequestId === requestIdRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setCount(pendingCount);
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePendingItemsCount.ts:fetchCount:state_updated',message:'State updated with count',data:{count:pendingCount,requestId:currentRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      } else {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePendingItemsCount.ts:fetchCount:stale_ignored',message:'Stale request ignored',data:{pendingCount,requestId:currentRequestId,currentRequestId:requestIdRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pending items count';
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'usePendingItemsCount.ts:fetchCount:error',message:'Hook error',data:{error:errorMessage,requestId:currentRequestId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
      // #endregion
      
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

