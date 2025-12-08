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
  } catch (error) {
    return false;
  }
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Check if the path is a search route that needs protection
  const isSearchRoute = pathname.includes('/search');
  
  if (isSearchRoute) {
    // Check authentication for search routes
    if (!isAuthenticated(request)) {
      // Redirect to login page
      const loginUrl = new URL('/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
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