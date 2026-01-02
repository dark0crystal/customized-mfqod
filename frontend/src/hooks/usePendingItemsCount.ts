import { useState, useEffect, useRef, useCallback } from 'react';
import { getPendingItemsCount } from '@/services/itemsService';
import { usePermissions } from '@/PermissionsContext';

/**
 * Hook to fetch and manage pending items count
 * Automatically refreshes on mount and can be manually refreshed
 * Only fetches if user has can_manage_items permission
 */
export function usePendingItemsCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const hasManageItemsPermission = hasPermission('can_manage_items');

  const fetchCount = useCallback(async () => {
    // Don't fetch if user doesn't have permission
    if (!hasManageItemsPermission) {
      if (isMountedRef.current) {
        setCount(0);
        setLoading(false);
        setError(null);
      }
      return;
    }

    // Increment request ID to track the current request
    const currentRequestId = ++requestIdRef.current;
    
    try {
      setLoading(true);
      setError(null);
      console.log('🔄 [Pending Items Badge] Fetching pending items count...', {
        hasPermission: hasManageItemsPermission,
        requestId: currentRequestId
      });
      const pendingCount = await getPendingItemsCount();
      
      console.log('📥 [Pending Items Badge] Received pending items count:', {
        count: pendingCount,
        requestId: currentRequestId,
        isCurrentRequest: currentRequestId === requestIdRef.current,
        isMounted: isMountedRef.current
      });
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setCount(pendingCount);
        console.log('✅ [Pending Items Badge] Badge count updated to:', pendingCount);
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
  }, [hasManageItemsPermission]);

  useEffect(() => {
    isMountedRef.current = true;
    
    // Wait for permissions to load before fetching
    if (!permissionsLoading) {
      fetchCount();
      
      // Only set up interval if user has permission
      if (hasManageItemsPermission) {
        // Optionally refresh count periodically (every 30 seconds)
        const interval = setInterval(() => {
          fetchCount();
        }, 30000);

        return () => {
          isMountedRef.current = false;
          clearInterval(interval);
        };
      } else {
        // If no permission, just set loading to false
        setLoading(false);
      }
    }

    return () => {
      isMountedRef.current = false;
    };
  }, [fetchCount, permissionsLoading, hasManageItemsPermission]);

  return {
    count,
    loading,
    error,
    refresh: fetchCount,
  };
}

