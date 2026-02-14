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
      const pendingCount = await getPendingItemsCount();
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setCount(pendingCount);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pending items count';
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setError(errorMessage);
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
        // Refresh count periodically (every 60 seconds)
        const interval = setInterval(() => {
          fetchCount();
        }, 60000);

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

