// utils/cookies.ts
export const cookieUtils = {
  // Set a cookie
  set: (name: string, value: string, days: number = 7) => {
    // Only run in browser environment
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`
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
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length)
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