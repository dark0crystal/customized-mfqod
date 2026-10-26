/**
 * Locale detection + NEXT_LOCALE cookie handling, replicating the next-intl 4 middleware
 * (resolveLocale.js / syncCookie.js) on the client.
 */
import { isAppLocale, routing, type AppLocale } from './routing';

export function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const part of document.cookie ? document.cookie.split(';') : []) {
    const idx = part.indexOf('=');
    const key = (idx === -1 ? part : part.slice(0, idx)).trim();
    if (key !== name) continue;
    const raw = idx === -1 ? '' : part.slice(idx + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return undefined;
}

export function hasCookie(name: string): boolean {
  return readCookie(name) !== undefined;
}

/** Locale stored in the NEXT_LOCALE cookie, if valid. */
export function getCookieLocale(): AppLocale | undefined {
  const value = readCookie(routing.localeCookie.name);
  return isAppLocale(value) ? value : undefined;
}

/**
 * Equivalent of next-intl's Accept-Language negotiation, using navigator.languages
 * (the browser builds Accept-Language from the same list).
 */
export function getBrowserLocale(): AppLocale {
  const langs =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages && navigator.languages.length
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : [];
  for (const lang of langs) {
    const lower = String(lang).toLowerCase();
    if (isAppLocale(lower)) return lower;
    const base = lower.split('-')[0];
    if (isAppLocale(base)) return base;
  }
  return routing.defaultLocale;
}

/** Locale for an un-prefixed URL: cookie → browser languages → default ('ar'). */
export function detectLocale(): AppLocale {
  return getCookieLocale() ?? getBrowserLocale();
}

/** Write the NEXT_LOCALE cookie exactly like next-intl does (`NEXT_LOCALE=en;sameSite=lax;path=/;`). */
export function writeLocaleCookie(locale: AppLocale): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${routing.localeCookie.name}=${locale};sameSite=${routing.localeCookie.sameSite};path=/;`;
}

/**
 * next-intl middleware `syncCookie`: runs for every request with the resolved locale.
 * - cookie present but different → update it
 * - no cookie and the browser language would pick a different locale → set it
 */
export function syncLocaleCookieForRequest(locale: AppLocale): void {
  const current = readCookie(routing.localeCookie.name);
  if (current !== undefined) {
    if (current !== locale) writeLocaleCookie(locale);
  } else if (getBrowserLocale() !== locale) {
    writeLocaleCookie(locale);
  }
}

/** next-intl `syncLocaleCookie` used by Link/useRouter when switching locale. */
export function syncLocaleCookieOnSwitch(curLocale: string, nextLocale: string | undefined): void {
  if (nextLocale == null || nextLocale === curLocale) return;
  if (!isAppLocale(nextLocale)) {
    document.cookie = `${routing.localeCookie.name}=${nextLocale};sameSite=${routing.localeCookie.sameSite};path=/;`;
    return;
  }
  writeLocaleCookie(nextLocale);
}

export function getDirectionForLocale(locale: string): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr';
}
