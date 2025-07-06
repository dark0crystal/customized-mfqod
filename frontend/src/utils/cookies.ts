// utils/cookies.ts
export const cookieUtils = {
  // Set a cookie
  set: (name: string, value: string, days: number = 7) => {
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; secure; samesite=strict`
  },

  // Get a cookie
  get: (name: string): string | null => {
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
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
  },

  // Get user from cookie
  getUser: () => {
    const user = cookieUtils.get('user')
    return user ? JSON.parse(user) : null
  },

  // Get token from cookie
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
    // Redirect to login page
    window.location.href = '/login'
  }
}