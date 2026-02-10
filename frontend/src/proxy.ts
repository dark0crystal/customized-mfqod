import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// next-intl middleware: runs first for locale negotiation, redirects, and x-next-intl-locale header
const intlMiddleware = createMiddleware(routing);

// Base64url decode (JWT payload uses base64url, not standard base64)
function base64UrlDecode(str: string): string {
  const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  const padded = pad ? base64 + '='.repeat(4 - pad) : base64;
  return atob(padded);
}

function isAuthenticated(request: NextRequest): boolean {
  const token =
    request.cookies.get('token') || request.cookies.get('jwt');

  if (!token?.value) return false;

  try {
    const parts = token.value.split('.');
    if (parts.length !== 3) return false;

    const payloadJson = base64UrlDecode(parts[1]);
    const payload = JSON.parse(payloadJson) as { exp?: number };

    if (payload.exp != null && payload.exp < Date.now() / 1000) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function isProtectedRoute(pathname: string): boolean {
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';
  const protectedPatterns = [/^\/dashboard/, /^\/search/];
  return protectedPatterns.some((pattern) => pattern.test(pathWithoutLocale));
}

function getLocaleFromPathname(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 0 && (segments[0] === 'en' || segments[0] === 'ar')) {
    return segments[0];
  }
  return routing.defaultLocale;
}

/**
 * Next.js 16 proxy (middleware).
 * 1. Run next-intl middleware first so locale is negotiated and headers set.
 * 2. Then apply auth: redirect to login for protected routes when not authenticated.
 */
export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Step 1: Run next-intl middleware (locale negotiation, redirects, rewrites)
  const response = intlMiddleware(request);

  // Step 2: For protected routes, enforce auth (override with redirect if needed)
  if (isProtectedRoute(pathname) && !isAuthenticated(request)) {
    const locale = getLocaleFromPathname(pathname);
    const loginUrl = new URL(`/${locale}/auth/login`, request.url);
    loginUrl.searchParams.set('returnUrl', pathname);

    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.cookies.delete('token');
    redirectResponse.cookies.delete('jwt');
    redirectResponse.cookies.delete('refresh_token');
    redirectResponse.cookies.delete('user');
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
};
