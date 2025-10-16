"use client";

import { useState, useEffect } from 'react';

/**
 * Custom hook to detect if component is running on the client side
 * This helps prevent hydration mismatches by ensuring certain operations
 * only run after the component has mounted on the client
 */
export function useIsClient() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  return isClient;
}

/**
 * Hook that returns a value only after client-side hydration
 * Useful for values that differ between server and client
 */
export function useClientValue<T>(clientValue: T, serverValue: T): T {
  const isClient = useIsClient();
  return isClient ? clientValue : serverValue;
}

/**
 * Hook for safely accessing browser APIs
 * Returns null during SSR and the actual value after hydration
 */
export function useBrowserValue<T>(getValue: () => T): T | null {
  const isClient = useIsClient();
  
  if (!isClient) {
    return null;
  }
  
  try {
    return getValue();
  } catch (error) {
    console.warn('Error accessing browser API:', error);
    return null;
  }
}
