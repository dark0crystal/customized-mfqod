import {defineRouting} from 'next-intl/routing';
import {getDirection} from '@/utils/direction';
 
export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ['en', 'ar'],
 
  // Used when no locale matches
  defaultLocale: 'ar',
  
  // Always show locale in URL
  localePrefix: 'always'
});

// Export direction utilities for use in components
export const getLocaleDirection = (locale: string) => getDirection(locale as 'en' | 'ar');