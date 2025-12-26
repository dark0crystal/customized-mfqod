import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

// Create the internationalization middleware
const intlMiddleware = createMiddleware(routing);

// Function to check if user is authenticated via JWT token in cookies
function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get('token') || 
                request.cookies.get('jwt') || 
                request.cookies.get('access_token');
  
  if (!token) {
    return false;
  }

  try {
    // Decode JWT token to check if it's valid
    const payload = JSON.parse(atob(token.value.split('.')[1]));
    
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
function isProtectedRoute(pathname: string): boolean {
  // Remove locale prefix for checking
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';
  
  // Protected routes include:
  // - /dashboard/** (all dashboard routes)
  // - /search (search routes)
  // - Any route that should require authentication
  const protectedPatterns = [
    /^\/dashboard/,  // Matches /dashboard, /en/dashboard, /ar/dashboard, etc.
    /^\/search/,     // Matches /search, /en/search, /ar/search, etc.
  ];
  
  return protectedPatterns.some(pattern => pattern.test(pathWithoutLocale));
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

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if this is a protected route
  if (isProtectedRoute(pathname)) {
    // Check authentication for protected routes
    if (!isAuthenticated(request)) {
      // Extract locale from pathname
      const locale = getLocaleFromPathname(pathname);
      
      // Create login URL with locale preserved
      const loginUrl = new URL(`/${locale}/auth/login`, request.url);
      
      // Create response with redirect
      const response = NextResponse.redirect(loginUrl);
      
      // Clear expired or invalid tokens from cookies
      response.cookies.delete('token');
      response.cookies.delete('jwt');
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      response.cookies.delete('user');
      
      return response;
    }
    
    // Note: Detailed permission checking is done in server components
    // Middleware only handles authentication. Permission verification happens
    // at the page level using server components for better security and performance.
  }
  
  // Apply internationalization middleware for all other routes
  return intlMiddleware(request);
}
 
export const config = {
  // Match all pathnames except for
  // - … if they start with `/api`, `/trpc`, `/_next` or `/_vercel`
  // - … the ones containing a dot (e.g. `favicon.ico`)
  matcher: '/((?!api|trpc|_next|_vercel|.*\\..*).*)'
};