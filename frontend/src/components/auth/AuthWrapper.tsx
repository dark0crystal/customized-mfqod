'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { tokenManager } from '@/utils/tokenManager'

interface AuthWrapperProps {
  children: React.ReactNode
  redirectTo?: string
  fallback?: React.ReactNode
}

export default function AuthWrapper({ 
  children, 
  redirectTo = '/auth/login',
  fallback 
}: AuthWrapperProps) {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if user is authenticated
    const authStatus = tokenManager.isAuthenticated()
    setIsAuthenticated(authStatus)
    
    if (!authStatus) {
      // Redirect to login page if not authenticated
      router.push(redirectTo)
    }
  }, [router, redirectTo])

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Show loading or redirect if not authenticated
  if (!isAuthenticated) {
    return fallback || (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  // User is authenticated, render children
  return <>{children}</>
}
