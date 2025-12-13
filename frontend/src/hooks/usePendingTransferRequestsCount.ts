import { useState, useEffect, useRef, useCallback } from 'react';
import { tokenManager } from '@/utils/tokenManager';

const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

/**
 * Hook to fetch and manage pending transfer requests count
 * Automatically refreshes on mount and can be manually refreshed
 */
export function usePendingTransferRequestsCount() {
  const [count, setCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<number>(0);
  const isMountedRef = useRef<boolean>(true);

  const getAuthHeaders = (): HeadersInit => {
    const token = tokenManager.getAccessToken();
    return token ? { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' };
  };

  const fetchCount = useCallback(async () => {
    // Increment request ID to track the current request
    const currentRequestId = ++requestIdRef.current;
    
    try {
      setLoading(true);
      setError(null);
      
      // Fetch pending transfer requests
      const response = await fetch(`${API_BASE_URL}/api/transfer-requests/incoming/?status=pending`, {
        headers: getAuthHeaders()
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending transfer requests');
      }
      
      const data = await response.json();
      const pendingCount = Array.isArray(data) ? data.length : 0;
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setCount(pendingCount);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch pending transfer requests count';
      
      // Only update state if this is still the current request and component is mounted
      if (currentRequestId === requestIdRef.current && isMountedRef.current) {
        setError(errorMessage);
        console.error('Error fetching pending transfer requests count:', err);
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

