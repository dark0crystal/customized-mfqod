// hooks/useAuth.ts
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { tokenManager, type User, type TokenInfo } from '@/utils/tokenManager'

interface UseAuthReturn {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
  error: string | null
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Initialize auth state
  useEffect(() => {
    const initAuth = () => {
      try {
        const currentUser = tokenManager.getUser()
        const isAuth = tokenManager.isAuthenticated()
        
        setUser(currentUser)
        setIsLoading(false)
        
        // If not authenticated and not on login page, redirect
        if (!isAuth && typeof window !== 'undefined' && !window.location.pathname.includes('/auth/login')) {
          router.push('/auth/login')
        }
      } catch (err) {
        console.error('Auth initialization error:', err)
        setError('Authentication initialization failed')
        setIsLoading(false)
      }
    }

    initAuth()
  }, [router])

  const login = useCallback(async (identifier: string, password: string) => {
    setIsLoading(true)
    setError(null)
    
    try {
      const result = await tokenManager.login(identifier, password)
      setUser(result.user)
      setError(null)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed'
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoading(true)
    
    try {
      await tokenManager.logout()
      setUser(null)
      setError(null)
      router.push('/auth/login')
    } catch (err) {
      console.error('Logout error:', err)
      setError('Logout failed')
    } finally {
      setIsLoading(false)
    }
  }, [router])

  const refreshToken = useCallback(async () => {
    try {
      await tokenManager.refreshAccessToken()
      // Update user info after refresh
      const updatedUser = tokenManager.getUser()
      setUser(updatedUser)
      setError(null)
    } catch (err) {
      console.error('Token refresh error:', err)
      setError('Token refresh failed')
      // If refresh fails, logout user
      await logout()
    }
  }, [logout])

  return {
    user,
    isAuthenticated: !!user && tokenManager.isAuthenticated(),
    isLoading,
    login,
    logout,
    refreshToken,
    error,
  }
}

// hooks/useTokenStatus.ts
interface UseTokenStatusReturn {
  tokenInfo: TokenInfo | null
  isLoading: boolean
  error: string | null
  checkStatus: () => Promise<void>
}

export function useTokenStatus(): UseTokenStatusReturn {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const checkStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const info = await tokenManager.getTokenInfo()
      setTokenInfo(info)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get token status'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Check status on mount and set up interval
  useEffect(() => {
    checkStatus()
    
    // Check every minute
    const interval = setInterval(checkStatus, 60000)
    
    return () => clearInterval(interval)
  }, [checkStatus])

  return {
    tokenInfo,
    isLoading,
    error,
    checkStatus,
  }
}

// hooks/useApiRequest.ts
interface UseApiRequestOptions {
  url: string
  options?: RequestInit
  dependencies?: any[]
}

interface UseApiRequestReturn<T> {
  data: T | null
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useApiRequest<T = any>({
  url,
  options = {},
  dependencies = []
}: UseApiRequestOptions): UseApiRequestReturn<T> {
  const [data, setData] = useState<T | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const makeRequest = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    
    try {
      const response = await tokenManager.makeAuthenticatedRequest(url, options)
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status}`)
      }
      
      const result = await response.json()
      setData(result)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Request failed'
      setError(errorMessage)
      console.error('API request error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [url, ...dependencies])

  useEffect(() => {
    makeRequest()
  }, [makeRequest])

  return {
    data,
    isLoading,
    error,
    refetch: makeRequest,
  }
}

// hooks/useProtectedRoute.ts
import { usePermissions } from '@/PermissionsContext'

interface UseProtectedRouteOptions {
  redirectTo?: string
  requiredPermission?: string | string[]
  // Deprecated: Use requiredPermission instead
  requiredRole?: string
}

/**
 * Client-side hook for protecting routes
 * Note: This is for UX only. Server-side protection is the primary security mechanism.
 * For server components, use WithPermissions or requirePermission from lib/server/permissions
 */
export function useProtectedRoute(options: UseProtectedRouteOptions = {}) {
  const { redirectTo = '/auth/login', requiredPermission, requiredRole } = options
  const { user, isAuthenticated, isLoading } = useAuth()
  const { hasPermission, hasFullAccess, isLoading: permissionsLoading } = usePermissions()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !permissionsLoading) {
      if (!isAuthenticated) {
        router.push(redirectTo)
        return
      }

      // Check permissions if required
      if (requiredPermission) {
        const hasAccess = hasFullAccess || hasPermission(requiredPermission as string)
        if (!hasAccess) {
          router.push('/unauthorized')
          return
        }
      }
      
      // Legacy role-based check (deprecated - use permissions instead)
      if (requiredRole && !requiredPermission) {
        console.warn('useProtectedRoute: requiredRole is deprecated. Use requiredPermission instead.')
        // Note: Role-based checks are removed. Use permission-based checks instead.
        // If you need role-based checks, assign appropriate permissions to roles.
      }
    }
  }, [isAuthenticated, isLoading, user, requiredPermission, requiredRole, router, redirectTo, hasPermission, hasFullAccess, permissionsLoading])

  return {
    isAuthenticated,
    isLoading: isLoading || permissionsLoading,
    user,
    hasAccess: !requiredPermission || hasFullAccess || hasPermission(requiredPermission as string),
    // Deprecated
    hasRequiredRole: !requiredRole,
  }
}