/**
 * Client-side replacement for the old Next.js middleware `src/proxy.ts` (+ next-intl middleware).
 *
 * It is mounted ONCE, in the root route (RootLayout), and runs on every location change before
 * any page renders — the same place the middleware ran (every request / RSC navigation):
 *
 *  1. Auth check (src/proxy.ts, replicated exactly): for /dashboard/** and /search/** (with or
 *     without locale prefix) a JWT must be present in cookie `token` (or `jwt`) and not be
 *     expired. Otherwise the cookies token, jwt, refresh_token, user are cleared and the user is
 *     sent to /<locale>/auth/login?returnUrl=<original pathname>.
 *     NOTE: this was never real security (the cookie is not verified) — the backend enforces
 *     authentication and permissions on every API call. That has not changed.
 *  2. Locale prefix (next-intl middleware): URLs without a valid locale prefix are redirected to
 *     /<locale><path> where locale = NEXT_LOCALE cookie → browser languages → 'ar'.
 *     "/" → "/ar", "/dashboard/items" → "/ar/dashboard/items", "/fr" → "/ar/fr" (→ 404),
 *     "/AR/search" → "/ar/search". A trailing slash is removed ("/ar/" → "/ar"), like Next.
 */
import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { routing } from '@/i18n/routing';
import { detectLocale, hasCookie, readCookie } from '@/i18n/locale';

/* ---------------------------------- src/proxy.ts (verbatim logic) ---------------------------------- */

// Function to check if user is authenticated via JWT token in cookies
export function isAuthenticated(): boolean {
  const tokenValue = hasCookie('token') ? readCookie('token') : hasCookie('jwt') ? readCookie('jwt') : undefined;

  if (tokenValue === undefined) {
    return false;
  }

  try {
    // Decode JWT token to check if it's valid
    const payload = JSON.parse(atob(tokenValue.split('.')[1]));

    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

// Function to check if a route is protected
export function isProtectedRoute(pathname: string): boolean {
  // Remove locale prefix for checking
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';

  // Protected routes include:
  // - /dashboard/** (all dashboard routes)
  // - /search (search routes)
  const protectedPatterns = [
    /^\/dashboard/, // Matches /dashboard, /en/dashboard, /ar/dashboard, etc.
    /^\/search/, // Matches /search, /en/search, /ar/search, etc.
  ];

  return protectedPatterns.some((pattern) => pattern.test(pathWithoutLocale));
}

// Function to extract locale from pathname
function getLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  // Locales are 'en' or 'ar'
  if (segments.length > 0 && (segments[0] === 'en' || segments[0] === 'ar')) {
    return segments[0];
  }
  return 'ar'; // Default locale
}

function expireCookie(name: string) {
  document.cookie = `${name}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/** Clears the auth cookies the proxy deleted on a failed check. */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;
  expireCookie('token');
  expireCookie('jwt');
  expireCookie('refresh_token');
  expireCookie('user');
}

/* ------------------------------------- middleware decision ------------------------------------- */

// Same as the old `config.matcher`: skip /api, /trpc, /_next, /_vercel and any path containing a dot.
const MATCHER = /^\/(?!api|trpc|_next|_vercel|.*\..*).*$/;

export type GuardDecision =
  | { type: 'pass' }
  | { type: 'login'; to: string }
  | { type: 'redirect'; to: string };

function sanitizePathname(pathname: string): string {
  return pathname.replace(/\\/g, '%5C').replace(/\/+/g, '/');
}

/** Pure function: what the old middleware chain would do for this URL. */
export function resolveGuard(pathname: string, search: string, hash: string): GuardDecision {
  // Next.js removes trailing slashes (308) before the middleware runs.
  if (pathname.length > 1 && pathname.endsWith('/')) {
    const trimmed = pathname.replace(/\/+$/, '') || '/';
    return { type: 'redirect', to: `${trimmed}${search}${hash}` };
  }

  if (!MATCHER.test(pathname)) return { type: 'pass' };

  // 1. src/proxy.ts
  if (isProtectedRoute(pathname) && !isAuthenticated()) {
    const locale = getLocaleFromPathname(pathname);
    const params = new URLSearchParams();
    // Store the original pathname as returnUrl so user can be redirected back after login
    params.set('returnUrl', pathname);
    return { type: 'login', to: `/${locale}/auth/login?${params.toString()}` };
  }

  // 2. next-intl middleware (localePrefix: 'always')
  let decoded: string;
  try {
    decoded = decodeURI(pathname);
  } catch {
    return { type: 'pass' };
  }
  const external = sanitizePathname(decoded);
  const segments = external.split('/');
  const first = segments[1] ?? '';
  const exact = (routing.locales as readonly string[]).find((l) => l === first);
  if (exact) return { type: 'pass' };

  const caseInsensitive = (routing.locales as readonly string[]).find((l) => l === first.toLowerCase());
  let locale: string;
  let unprefixed: string;
  if (caseInsensitive) {
    locale = caseInsensitive;
    unprefixed = '/' + segments.slice(2).join('/');
  } else {
    locale = detectLocale();
    unprefixed = external;
  }
  if (unprefixed !== '/' && unprefixed.endsWith('/')) unprefixed = unprefixed.replace(/\/+$/, '');
  const target = unprefixed === '/' ? `/${locale}` : `/${locale}${unprefixed}`;
  return { type: 'redirect', to: `${target}${search}${hash}` };
}

/**
 * Wrap the app's route outlet with this (RootLayout does). Children only render when the old
 * middleware would have let the request through.
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { pathname, search, hash } = useLocation();
  const decision = resolveGuard(pathname, search, hash);

  if (decision.type === 'login') {
    // Clear expired or invalid tokens from cookies (before the login page renders).
    clearAuthCookies();
    return <Navigate to={decision.to} replace />;
  }
  if (decision.type === 'redirect') {
    return <Navigate to={decision.to} replace />;
  }
  return <>{children}</>;
}
