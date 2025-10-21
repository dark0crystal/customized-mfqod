'use client'
import { ReactNode } from 'react';
import { useLocale } from 'next-intl';
import { getDirection, getDirectionClasses, getFontFamily } from '@/utils/direction';

interface DirectionProviderProps {
  children: ReactNode;
  className?: string;
}

/**
 * Direction-aware component wrapper that applies RTL/LTR styling
 * Based on next-intl documentation for dynamic direction changing
 */
export default function DirectionProvider({ children, className = '' }: DirectionProviderProps) {
  const locale = useLocale() as 'en' | 'ar';
  const direction = getDirection(locale);
  const directionClasses = getDirectionClasses(direction);
  const fontFamily = getFontFamily(locale);

  return (
    <div 
      className={`${directionClasses.container} ${fontFamily} ${className}`}
      dir={direction}
    >
      {children}
    </div>
  );
}

/**
 * Hook to get current direction and locale information
 */
export function useDirection() {
  const locale = useLocale() as 'en' | 'ar';
  const direction = getDirection(locale);
  const directionClasses = getDirectionClasses(direction);
  const fontFamily = getFontFamily(locale);
  const isRTL = direction === 'rtl';

  return {
    locale,
    direction,
    directionClasses,
    fontFamily,
    isRTL,
  };
}
