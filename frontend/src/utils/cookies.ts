// utils/cookies.ts
export const cookieUtils = {
  // Set a cookie
  set: (name: string, value: string, days: number = 7) => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    
    // URL encode the value to handle special characters
    const encodedValue = encodeURIComponent(value)
    
    // Only use secure flag in production (HTTPS), not in development (localhost)
    const isProduction = typeof window !== 'undefined' && 
                        window.location.protocol === 'https:' && 
                        !window.location.hostname.includes('localhost') &&
                        !window.location.hostname.includes('127.0.0.1')
    
    // Use SameSite=Lax for better compatibility, or Strict for production
    const sameSite = isProduction ? 'strict' : 'lax'
    const secureFlag = isProduction ? '; secure' : ''
    
    document.cookie = `${name}=${encodedValue}; expires=${expires.toUTCString()}; path=/; samesite=${sameSite}${secureFlag}`
  },

  // Get a cookie - hydration safe
  get: (name: string): string | null => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') return null;
    
    const nameEQ = name + "="
    const ca = document.cookie.split(';')
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i]
      while (c.charAt(0) === ' ') c = c.substring(1, c.length)
      if (c.indexOf(nameEQ) === 0) {
        const value = c.substring(nameEQ.length, c.length)
        // URL decode the value since we encode it when setting
        return decodeURIComponent(value)
      }
    }
    return null
  },

  // Delete a cookie
  delete: (name: string) => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  },

  // Alias for delete method (for consistency with tokenManager)
  remove: (name: string) => {
    cookieUtils.delete(name)
  },

  // Get user from cookie - hydration safe
  getUser: () => {
    const user = cookieUtils.get('user')
    return user ? JSON.parse(user) : null
  },

  // Get token from cookie - hydration safe
  getToken: () => {
    return cookieUtils.get('token')
  },

  // Clear all auth cookies
  clearAuth: () => {
    cookieUtils.delete('token')
    cookieUtils.delete('access_token') // Legacy cleanup
    cookieUtils.delete('user')
  }
}

// Auth helper functions
export const authUtils = {
  // Check if user is logged in
  isLoggedIn: () => {
    return !!cookieUtils.getToken()
  },

  // Get current user
  getCurrentUser: () => {
    return cookieUtils.getUser()
  },

  // Logout user
  logout: () => {
    cookieUtils.clearAuth()
    // Only redirect in browser environment
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login'
    }
  }
}