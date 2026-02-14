import { useState, useEffect } from 'react';
import { getPendingTransferRequestsCount } from '@/services/transferRequestsService';

/**
 * Hook to fetch and manage pending transfer requests count
 */
export function usePendingTransferRequestsCount() {
  const [count, setCount] = useState<number>(0);

  const fetchCount = async () => {
    try {
      const pendingCount = await getPendingTransferRequestsCount();
      setCount(pendingCount);
    } catch {
      setCount(0);
    }
  };

  useEffect(() => {
    fetchCount();
    
    const interval = setInterval(fetchCount, 60000); // Refresh every 60 seconds
    
    return () => clearInterval(interval);
  }, []);

  return { count };
}
