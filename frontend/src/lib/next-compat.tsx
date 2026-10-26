/**
 * `next/navigation` + `next/link` compatibility layer for React Router.
 *
 * Semantics follow Next.js 16 (App Router):
 *   - usePathname()      → current pathname WITH the locale prefix, e.g. "/ar/dashboard/items"
 *   - useSearchParams()  → read-only URLSearchParams of the current URL
 *   - useParams()        → dynamic route params, incl. `locale` (e.g. { locale: 'ar', itemId: '12' })
 *   - useRouter()        → { push, replace, back, forward, refresh, prefetch } (stable object)
 *                          hrefs are used as-is (NO locale added — use '@/i18n/navigation' for that)
 *   - notFound()         → throws; the nearest route error boundary renders the 404 page
 *   - redirect(url)      → throws; the nearest route error boundary performs a replace-navigation
 *   - <Link>             → plain <a>, client-side navigation on unmodified left click
 *
 *   import { useRouter, usePathname, useSearchParams, useParams, Link } from '@/lib/next-compat'
 */
import {
  forwardRef,
  useMemo,
  type AnchorHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { useLocation, useNavigate, useParams as useRRParams } from 'react-router';

/* ------------------------------------------------------------------------------------------------
 * URL helpers
 * ---------------------------------------------------------------------------------------------- */

export type ParsedUrlQueryInput = Record<
  string,
  string | number | boolean | ReadonlyArray<string | number | boolean> | null | undefined
>;

/** Subset of Node's `UrlObject` accepted by next/link and next/navigation. */
export interface UrlObject {
  pathname?: string | null;
  query?: string | ParsedUrlQueryInput | null;
  search?: string | null;
  hash?: string | null;
  href?: string | null;
  protocol?: string | null;
  host?: string | null;
  hostname?: string | null;
  port?: string | number | null;
}

export type Url = string | UrlObject;

function querystringify(query: ParsedUrlQueryInput): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (Array.isArray(value)) {
      value.forEach((v) => sp.append(key, stringifyQueryValue(v)));
    } else {
      sp.set(key, stringifyQueryValue(value as string | number | boolean | null | undefined));
    }
  }
  return sp.toString();
}

function stringifyQueryValue(value: string | number | boolean | null | undefined): string {
  if (typeof value === 'string') return value;
  if ((typeof value === 'number' && !isNaN(value)) || typeof value === 'boolean') return String(value);
  return '';
}

/** Same output as Next's `formatUrl` for the cases used in this app. */
export function formatUrl(url: Url): string {
  if (typeof url === 'string') return url;
  let protocol = url.protocol || '';
  let pathname = url.pathname || '';
  let hash = url.hash || '';
  let query = url.query || '';
  let host: string | false = false;

  if (url.host) {
    host = url.host;
  } else if (url.hostname) {
    host = url.hostname + (url.port ? `:${url.port}` : '');
  }

  if (query && typeof query === 'object') {
    query = querystringify(query);
  }

  let search = url.search || (query && `?${query}`) || '';

  if (protocol && !protocol.endsWith(':')) protocol += ':';
  if (/^(https?|ftp|gopher|file):$/.test(protocol) || host) {
    host = '//' + (host || '');
    if (pathname && pathname[0] !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }
  if (hash && hash[0] !== '#') hash = '#' + hash;
  if (search && search[0] !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, encodeURIComponent);
  search = search.replace('#', '%23');
  return `${protocol}${host}${pathname}${search}${hash}`;
}

type Resolved = { internal: true; to: string } | { internal: false; href: string };

/** Resolve an href against the current location (browser semantics, like Next). */
function resolveHref(href: string): Resolved {
  if (typeof window === 'undefined') return { internal: true, to: href };
  let url: URL;
  try {
    url = new URL(href, window.location.href);
  } catch {
    return { internal: true, to: href };
  }
  if (url.origin !== window.location.origin) {
    return { internal: false, href: url.href };
  }
  return { internal: true, to: `${url.pathname}${url.search}${url.hash}` };
}

/* ------------------------------------------------------------------------------------------------
 * Errors thrown by notFound() / redirect() — caught by the route error boundary (RouteErrorBoundary)
 * ---------------------------------------------------------------------------------------------- */

export class NotFoundError extends Error {
  readonly digest = 'NEXT_HTTP_ERROR_FALLBACK;404';
  constructor() {
    super('NEXT_HTTP_ERROR_FALLBACK;404');
    this.name = 'NotFoundError';
  }
}

export type RedirectType = 'push' | 'replace';

export class RedirectError extends Error {
  readonly digest: string;
  constructor(
    readonly url: string,
    readonly type: RedirectType = 'replace',
    readonly permanent = false,
  ) {
    super('NEXT_REDIRECT');
    this.name = 'RedirectError';
    this.digest = `NEXT_REDIRECT;${type};${url}`;
  }
}

export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

export function isRedirectError(error: unknown): error is RedirectError {
  return error instanceof RedirectError;
}

/**
 * Renders the 404 page instead of the current route (like `notFound()` from next/navigation).
 * Call it during render (or in an effect). Prefer rendering `<NotFound />` directly when convenient.
 */
export function notFound(): never {
  throw new NotFoundError();
}

/**
 * Like `redirect()` from next/navigation (client side): throws, and the route error boundary
 * navigates to `url` (replace by default). Only call during render/effects — in event
 * handlers use `router.replace()`/`router.push()` instead.
 */
export function redirect(url: string, type: RedirectType = 'replace'): never {
  throw new RedirectError(url, type);
}

export function permanentRedirect(url: string, type: RedirectType = 'replace'): never {
  throw new RedirectError(url, type, true);
}

/* ------------------------------------------------------------------------------------------------
 * Hooks
 * ---------------------------------------------------------------------------------------------- */

export interface NavigateOptions {
  /** Default true. `false` keeps the current scroll position. */
  scroll?: boolean;
}

export interface PrefetchOptions {
  kind?: unknown;
  onInvalidate?: () => void;
}

export interface AppRouterInstance {
  push(href: string, options?: NavigateOptions): void;
  replace(href: string, options?: NavigateOptions): void;
  back(): void;
  forward(): void;
  /** No-op in the SPA (there are no server components to re-fetch). Kept for API compatibility. */
  refresh(): void;
  /** No-op (route modules are lazy-loaded on navigation). */
  prefetch(href: string, options?: PrefetchOptions): void;
}

/** `useRouter()` from next/navigation. The returned object is stable across renders. */
export function useRouter(): AppRouterInstance {
  const navigate = useNavigate();
  return useMemo<AppRouterInstance>(() => {
    const go = (href: string, replace: boolean, options?: NavigateOptions) => {
      const resolved = resolveHref(href);
      if (!resolved.internal) {
        if (replace) window.location.replace(resolved.href);
        else window.location.assign(resolved.href);
        return;
      }
      void navigate(resolved.to, { replace, preventScrollReset: options?.scroll === false });
    };
    return {
      push: (href, options) => go(href, false, options),
      replace: (href, options) => go(href, true, options),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => {},
      prefetch: () => {},
    };
  }, [navigate]);
}

/** `usePathname()` from next/navigation — includes the locale prefix ("/ar/search"). */
export function usePathname(): string {
  return useLocation().pathname;
}

/** Read-only URLSearchParams, like Next's `ReadonlyURLSearchParams`. */
export class ReadonlyURLSearchParams extends URLSearchParams {
  /** @deprecated read-only */
  append(): never {
    throw new Error('Method unavailable on `ReadonlyURLSearchParams`. Read more: https://nextjs.org/docs/app/api-reference/functions/use-search-params#updating-searchparams');
  }
  /** @deprecated read-only */
  delete(): never {
    throw new Error('Method unavailable on `ReadonlyURLSearchParams`.');
  }
  /** @deprecated read-only */
  set(): never {
    throw new Error('Method unavailable on `ReadonlyURLSearchParams`.');
  }
  /** @deprecated read-only */
  sort(): never {
    throw new Error('Method unavailable on `ReadonlyURLSearchParams`.');
  }
}

/** `useSearchParams()` from next/navigation. To change the query, build a new URL and router.push/replace it. */
export function useSearchParams(): ReadonlyURLSearchParams {
  const { search } = useLocation();
  return useMemo(() => new ReadonlyURLSearchParams(search), [search]);
}

export type Params = Record<string, string | string[]>;

/** `useParams()` from next/navigation: all dynamic params of the current URL, including `locale`. */
export function useParams<T extends Params = Params>(): T {
  const params = useRRParams();
  return useMemo(() => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      if (key === '*' || value === undefined) continue;
      out[key] = value;
    }
    return out as unknown as T;
  }, [params]);
}

/* ------------------------------------------------------------------------------------------------
 * <Link> (next/link)
 * ---------------------------------------------------------------------------------------------- */

export interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: Url;
  /** Replace the current history entry instead of pushing. */
  replace?: boolean;
  /** Default true. `false` keeps the scroll position after navigation. */
  scroll?: boolean;
  /** Ignored (kept for API compatibility). */
  prefetch?: boolean | 'auto' | null;
  /** Ignored legacy next/link props. */
  as?: Url;
  shallow?: boolean;
  passHref?: boolean;
  legacyBehavior?: boolean;
  locale?: string | false;
  /** Called before a client-side navigation; call `e.preventDefault()` to cancel it. */
  onNavigate?: (e: { preventDefault: () => void }) => void;
  children?: ReactNode;
}

function isModifiedEvent(event: ReactMouseEvent<HTMLAnchorElement>): boolean {
  const target = event.currentTarget.getAttribute('target');
  return (
    (target && target !== '_self') ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    (event.nativeEvent && event.nativeEvent.which === 2) ||
    event.button !== 0
  ) as boolean;
}

/** `next/link` replacement: renders a plain <a href> and navigates client-side on plain left clicks. */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  {
    href,
    replace = false,
    scroll,
    prefetch: _prefetch,
    as: _as,
    shallow: _shallow,
    passHref: _passHref,
    legacyBehavior: _legacyBehavior,
    locale: _locale,
    onNavigate,
    onClick,
    children,
    ...rest
  },
  ref,
) {
  const navigate = useNavigate();
  const hrefString = formatUrl(href);

  const handleClick = (e: ReactMouseEvent<HTMLAnchorElement>) => {
    if (typeof onClick === 'function') onClick(e);
    if (e.defaultPrevented) return;
    if (isModifiedEvent(e) || e.currentTarget.hasAttribute('download')) return;

    const resolved = resolveHref(hrefString);
    if (!resolved.internal) {
      if (replace) {
        e.preventDefault();
        window.location.replace(resolved.href);
      }
      return;
    }

    e.preventDefault();
    if (onNavigate) {
      let cancelled = false;
      onNavigate({ preventDefault: () => (cancelled = true) });
      if (cancelled) return;
    }
    void navigate(resolved.to, { replace, preventScrollReset: scroll === false });
  };

  return (
    <a {...rest} ref={ref} href={hrefString} onClick={handleClick}>
      {children}
    </a>
  );
});

export default Link;
