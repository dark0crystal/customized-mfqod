import { useEffect, useState } from 'react'
import { Outlet } from 'react-router'
import { useRouter, usePathname } from '@/lib/next-compat'
import { tokenManager } from '@/utils/tokenManager'
import { PermissionsProvider } from '@/PermissionsContext'

export default function ProtectedLayout() {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    // Check if user is authenticated
    const authStatus = tokenManager.isAuthenticated()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ported 1:1 from the Next.js layout
    setIsAuthenticated(authStatus)
    
    if (!authStatus) {
      // Redirect to login page with returnUrl parameter
      const returnUrl = encodeURIComponent(pathname || '/')
      router.push(`/auth/login?returnUrl=${returnUrl}`)
    }
  }, [router, pathname])

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
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
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    )
  }

  return (
    <PermissionsProvider>
      <Outlet />
    </PermissionsProvider>
  )
}
