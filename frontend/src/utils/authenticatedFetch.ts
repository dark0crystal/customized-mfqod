import { tokenManager } from './tokenManager';

/**
 * Authenticated fetch wrapper that automatically handles token expiration.
 * When a 401 error with "Token has expired" message is detected, it automatically
 * redirects the user to the login page.
 * 
 * @param url - The URL to fetch
 * @param options - Fetch options (headers will be merged with auth headers)
 * @returns Promise<Response> - The fetch response
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get the access token
  const token = tokenManager.getAccessToken();
  
  // Prepare headers
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Add authorization header if token exists
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Make the fetch request
  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized responses
  if (response.status === 401) {
    try {
      // Try to parse the error message
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.detail || errorData.message || '';
      
      // Check if it's a token expiration error
      if (
        errorMessage.toLowerCase().includes('token has expired') ||
        errorMessage.toLowerCase().includes('token expired') ||
        errorMessage.toLowerCase().includes('expired')
      ) {
        // Clear tokens and redirect to login
        tokenManager.clearTokens();
        
        // Only redirect in browser environment and if not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
          window.location.href = '/auth/login';
        }
        
        // Throw an error to prevent further processing
        throw new Error('Token has expired. Redirecting to login...');
      }
    } catch (error) {
      // If we already handled the redirect, re-throw
      if (error instanceof Error && error.message.includes('Token has expired')) {
        throw error;
      }
      
      // For other 401 errors, still clear tokens and redirect as a safety measure
      tokenManager.clearTokens();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
        window.location.href = '/auth/login';
      }
      throw error;
    }
  }

  return response;
}


