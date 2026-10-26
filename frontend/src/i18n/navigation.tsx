/**
 * Locale-aware navigation APIs — same exports and semantics as the former
 * `createNavigation(routing)` from next-intl 4 (localePrefix: 'always', no `pathnames`):
 *
 *   import { Link, redirect, usePathname, useRouter, getPathname } from '@/i18n/navigation'
 *
 * - usePathname()            → current path WITHOUT the locale prefix ("/dashboard/items")
 * - <Link href="/search">    → renders href="/ar/search" (current locale prefixed)
 * - <Link href="/" locale="en"> → "/en" and updates the NEXT_LOCALE cookie (language switcher)
 * - useRouter().push('/x', { locale: 'en' }) / replace(...) → prefixed navigation (+ cookie sync)
 * - getPathname({ href, locale }) → "/<locale><href>"
 * - redirect({ href, locale })     → next-compat redirect() to the prefixed path
 *
 * Absolute URLs (with protocol) and relative hrefs (not starting with "/") are left untouched,
 * exactly like next-intl.
 */
import { forwardRef, useMemo, type ComponentPropsWithoutRef, type ForwardedRef, type MouseEvent } from 'react';
import { useLocale } from 'use-intl';
import { routing } from './routing';
import { syncLocaleCookieOnSwitch } from './locale';
import {
  Link as BaseLink,
  redirect as compatRedirect,
  permanentRedirect as compatPermanentRedirect,
  usePathname as useNextPathname,
  useRouter as useNextRouter,
  formatUrl,
  type ParsedUrlQueryInput,
  type RedirectType,
  type UrlObject,
  type NavigateOptions,
} from '@/lib/next-compat';

type Locale = (typeof routing.locales)[number];

export type Href = string | (UrlObject & { pathname: string; query?: ParsedUrlQueryInput });

/* -------------------------------------------------------------------------------------------- */
/* helpers (ported from next-intl/dist/esm/development/shared/utils.js + navigation/shared/utils.js) */

function isRelativeHref(href: string | UrlObject): boolean {
  const pathname = typeof href === 'object' ? href.pathname : href;
  return pathname != null && !pathname.startsWith('/');
}

function isLocalHref(href: string | UrlObject): boolean {
  if (typeof href === 'object') {
    return href.host == null && href.hostname == null;
  }
  return !/^[a-z]+:/i.test(href);
}

function isLocalizableHref(href: string | UrlObject): boolean {
  return isLocalHref(href) && !isRelativeHref(href);
}

function prefixPathname(prefix: string, pathname: string): string {
  let localizedHref = prefix;
  // Avoid trailing slashes
  if (/^\/(\?.*)?$/.test(pathname)) {
    pathname = pathname.slice(1);
  }
  localizedHref += pathname;
  return localizedHref;
}

function serializeSearchParams(searchParams: ParsedUrlQueryInput): string {
  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (Array.isArray(value)) {
      value.forEach((cur) => urlSearchParams.append(key, String(cur)));
    } else {
      urlSearchParams.set(key, String(value));
    }
  }
  return '?' + urlSearchParams.toString();
}

function applyPathnamePrefix(pathname: string, locale: string, force?: boolean): string {
  let shouldPrefix: boolean | undefined;
  if (force !== undefined) {
    shouldPrefix = force;
  } else if (isLocalizableHref(pathname)) {
    // localePrefix: 'always'
    shouldPrefix = true;
  }
  return shouldPrefix ? prefixPathname('/' + locale, pathname) : pathname;
}

/* -------------------------------------------------------------------------------------------- */

export interface GetPathnameArgs {
  href: Href;
  locale: Locale | string;
  forcePrefix?: boolean;
}

/** Returns the locale-prefixed pathname for `href`, e.g. getPathname({ href: '/search', locale: 'ar' }) → '/ar/search'. */
export function getPathname({ href, locale, forcePrefix }: GetPathnameArgs): string {
  let pathname: string;
  if (typeof href === 'object') {
    pathname = href.pathname;
    if (href.query) {
      pathname += serializeSearchParams(href.query);
    }
  } else {
    pathname = href;
  }
  return applyPathnamePrefix(pathname, locale, forcePrefix);
}

/** next-intl `redirect({ href, locale })` → throws a next-compat redirect to the prefixed path. */
export function redirect(args: GetPathnameArgs, type?: RedirectType): never {
  return compatRedirect(getPathname(args), type);
}

export function permanentRedirect(args: GetPathnameArgs, type?: RedirectType): never {
  return compatPermanentRedirect(getPathname(args), type);
}

/** Path of the current page WITHOUT the locale prefix: "/ar/search/5" → "/search/5", "/ar" → "/". */
export function usePathname(): string {
  const pathname = useNextPathname();
  const locale = useLocale();
  return useMemo(() => {
    if (!pathname) return pathname;
    const prefix = '/' + locale;
    const isPrefixed = pathname === prefix || pathname.startsWith(`${prefix}/`);
    return isPrefixed ? pathname.replace(new RegExp(`^${prefix}`), '') || '/' : pathname;
  }, [locale, pathname]);
}

export interface LocaleNavigateOptions extends NavigateOptions {
  /** Navigate to the same href in another locale (also updates the NEXT_LOCALE cookie). */
  locale?: Locale | string;
}

export interface LocaleRouter {
  push(href: Href, options?: LocaleNavigateOptions): void;
  replace(href: Href, options?: LocaleNavigateOptions): void;
  prefetch(href: Href, options?: LocaleNavigateOptions): void;
  back(): void;
  forward(): void;
  refresh(): void;
}

/** Like next/navigation's useRouter, but push/replace/prefetch add the (current or given) locale prefix. */
export function useRouter(): LocaleRouter {
  const router = useNextRouter();
  const curLocale = useLocale();
  return useMemo(() => {
    function createHandler(fn: (href: string, options?: NavigateOptions) => void) {
      return function handler(href: Href, options?: LocaleNavigateOptions) {
        const { locale: nextLocale, ...rest } = options || {};
        const pathname = getPathname({
          href,
          locale: nextLocale || curLocale,
          // Always include a prefix when changing locales
          forcePrefix: nextLocale != null || undefined,
        });
        syncLocaleCookieOnSwitch(curLocale, nextLocale);
        fn(pathname, Object.keys(rest).length > 0 ? rest : undefined);
      };
    }
    return {
      ...router,
      push: createHandler(router.push),
      replace: createHandler(router.replace),
      prefetch: createHandler((href) => router.prefetch(href)),
    };
  }, [curLocale, router]);
}

export type LinkProps = Omit<ComponentPropsWithoutRef<typeof BaseLink>, 'href' | 'locale'> & {
  href: Href;
  /** Link to this locale instead of the current one (language switcher). */
  locale?: Locale | string;
};

function LinkImpl({ href, locale, onClick, ...rest }: LinkProps, ref: ForwardedRef<HTMLAnchorElement>) {
  const curLocale = useLocale();
  const isChangingLocale = locale != null && locale !== curLocale;
  const pathname = typeof href === 'object' ? href.pathname : href;
  const isLocalizable = isLocalizableHref(href);
  const finalPathname = isLocalizable
    ? getPathname({
        locale: locale || curLocale,
        href: pathname,
        // Always include a prefix when changing locales
        forcePrefix: locale != null || undefined,
      })
    : pathname;
  const finalHref = typeof href === 'object' ? formatUrl({ ...href, pathname: finalPathname }) : finalPathname;

  return (
    <BaseLink
      {...rest}
      ref={ref}
      href={finalHref}
      hrefLang={isChangingLocale ? locale : rest.hrefLang}
      onClick={(event: MouseEvent<HTMLAnchorElement>) => {
        syncLocaleCookieOnSwitch(curLocale, locale);
        if (onClick) onClick(event);
      }}
    />
  );
}

/** Locale-aware <Link>: `href="/search"` renders `/ar/search` (current locale). */
export const Link = forwardRef(LinkImpl);
