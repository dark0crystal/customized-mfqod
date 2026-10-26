import { getDirection } from '@/utils/direction';

/**
 * Routing configuration (same values as the former next-intl `defineRouting` call).
 * Every URL is prefixed with a locale: /ar/..., /en/...
 */
export const routing = {
  // A list of all locales that are supported
  locales: ['en', 'ar'] as const,

  // Used when no locale matches
  defaultLocale: 'ar' as const,

  // Always show locale in URL
  localePrefix: 'always' as const,

  // Name/attributes of the cookie that remembers the user's locale (next-intl default)
  localeCookie: { name: 'NEXT_LOCALE', sameSite: 'lax' as const },
};

export type AppLocale = (typeof routing.locales)[number];

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === 'string' && (routing.locales as readonly string[]).includes(value);
}

// Export direction utilities for use in components
export const getLocaleDirection = (locale: string) => getDirection(locale as 'en' | 'ar');
