/**
 * use-intl provider replacing next-intl's request config + NextIntlClientProvider.
 *
 * - Messages are bundled per locale (dynamic import → one chunk per locale).
 * - Same English fallback as the old src/i18n/request.ts: for non-English locales the
 *   English messages are the base and the locale's messages are deep-merged on top, so a key
 *   missing in ar.json falls back to the English text.
 * - Keeps <html lang/dir> and the body direction classes in sync with the URL locale,
 *   like the old RootLayout (`<html lang dir>` + `<body class="… antialiased rtl|ltr">`).
 */
import { use, useEffect, useLayoutEffect, type ReactNode } from 'react';
import { IntlProvider } from 'use-intl';
import type { AbstractIntlMessages } from 'use-intl';
import { routing, type AppLocale } from './routing';
import { getDirectionForLocale, syncLocaleCookieForRequest } from './locale';

type Messages = AbstractIntlMessages;

// Helper function to deep merge objects (copied from the old src/i18n/request.ts)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function deepMerge(target: any, source: any): any {
  const output = { ...target };
  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      if (isObject(source[key])) {
        if (!(key in target)) {
          Object.assign(output, { [key]: source[key] });
        } else {
          output[key] = deepMerge(target[key], source[key]);
        }
      } else {
        Object.assign(output, { [key]: source[key] });
      }
    });
  }
  return output;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

async function importMessages(locale: AppLocale): Promise<Messages> {
  return (await import(`../../messages/${locale}.json`)).default as Messages;
}

async function buildMessages(locale: AppLocale): Promise<Messages> {
  // Load messages for current locale
  const messages = await importMessages(locale);

  // If locale is not English, merge English messages as fallback
  let finalMessages = messages;
  if (locale !== 'en') {
    try {
      const englishMessages = await importMessages('en');
      // Deep merge: English as base, current locale messages override (take precedence)
      // This way missing keys in current locale will fall back to English
      finalMessages = deepMerge(englishMessages, messages);
    } catch (error) {
      // If English messages can't be loaded, just use current locale messages
      console.warn('Could not load English messages for fallback:', error);
    }
  }
  return finalMessages;
}

type TrackedPromise<T> = Promise<T> & { status?: 'pending' | 'fulfilled' | 'rejected'; value?: T; reason?: unknown };

const cache = new Map<AppLocale, TrackedPromise<Messages>>();

/**
 * Returns (and caches) the merged messages for a locale. The promise is annotated with
 * status/value so React's `use()` reads an already-loaded locale synchronously (no suspend).
 * Call it early (main.tsx does) to start loading before the first render.
 */
export function loadMessages(locale: AppLocale): TrackedPromise<Messages> {
  let p = cache.get(locale);
  if (!p) {
    p = buildMessages(locale) as TrackedPromise<Messages>;
    p.status = 'pending';
    p.then(
      (value) => {
        p!.status = 'fulfilled';
        p!.value = value;
      },
      (reason) => {
        p!.status = 'rejected';
        p!.reason = reason;
        cache.delete(locale);
      },
    );
    cache.set(locale, p);
  }
  return p;
}

const timeZone = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
})();

/** Sets <html lang/dir> + body classes before any child effect runs (render it first). */
function DocumentLocaleSync({ locale }: { locale: AppLocale }) {
  useLayoutEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  // next-intl middleware synced the NEXT_LOCALE cookie on every request.
  useEffect(() => {
    syncLocaleCookieForRequest(locale);
  }, [locale]);

  return null;
}

/** Mirror of the old RootLayout: <html lang dir> and <body class="antialiased rtl|ltr">. */
export function applyDocumentLocale(locale: string): void {
  if (typeof document === 'undefined') return;
  const direction = getDirectionForLocale(locale);
  const html = document.documentElement;
  if (html.lang !== locale) html.lang = locale;
  if (html.dir !== direction) html.dir = direction;
  const body = document.body;
  if (body) {
    body.classList.add('antialiased');
    body.classList.remove(direction === 'rtl' ? 'ltr' : 'rtl');
    body.classList.add(direction);
  }
}

export interface AppIntlProviderProps {
  locale: AppLocale;
  children: ReactNode;
}

/**
 * Provides `useTranslations` / `useLocale` / `useFormatter` (from 'use-intl') to the tree.
 * Suspends while a locale's messages load for the first time.
 */
export default function AppIntlProvider({ locale, children }: AppIntlProviderProps) {
  const messages = use(loadMessages(locale) as Promise<Messages>);
  return (
    <IntlProvider locale={locale} messages={messages} timeZone={timeZone}>
      <DocumentLocaleSync locale={locale} />
      {children}
    </IntlProvider>
  );
}

export { routing };
