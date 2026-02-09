"use client";

import { ReactNode } from 'react';
import ClientOnly from '@/components/ClientOnly';

interface HydrationSafeWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Wrapper component that ensures children only render after hydration
 * Use this for components that access cookies, localStorage, or other browser APIs
 */
export default function HydrationSafeWrapper({ children, fallback }: HydrationSafeWrapperProps) {
  return (
    <ClientOnly fallback={fallback}>
      {children}
    </ClientOnly>
  );
}
