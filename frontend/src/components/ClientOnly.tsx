"use client";

import { ReactNode } from 'react';
import { useIsClient } from '@/hooks/useIsClient';

interface ClientOnlyProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component that only renders its children on the client side
 * This prevents hydration mismatches for components that depend on browser APIs
 */
export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const isClient = useIsClient();
  
  if (!isClient) {
    return <>{fallback}</>;
  }
  
  return <>{children}</>;
}
