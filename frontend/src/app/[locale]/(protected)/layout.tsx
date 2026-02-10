"use client"

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from '@/i18n/navigation'
import { tokenManager } from '@/utils/tokenManager'
import { PermissionsProvider } from '@/PermissionsContext'

interface ProtectedLayoutProps {
  children: React.ReactNode
}

function AuthOverlay({ message }: { message: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  )
}

export default function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    const authStatus = tokenManager.isAuthenticated()
    queueMicrotask(() => setIsAuthenticated(authStatus))

    if (!authStatus) {
      const returnUrl = encodeURIComponent(pathname || '/')
      router.push(`/auth/login?returnUrl=${returnUrl}`)
    }
  }, [router, pathname])

  // While checking auth, show overlay but still render children so the tree can hydrate on refresh.
  if (isAuthenticated === null) {
    return (
      <PermissionsProvider>
        <AuthOverlay message="Checking authentication..." />
        {children}
      </PermissionsProvider>
    )
  }

  // Not authenticated: do not mount dashboard (avoids 401s and broken state). Show overlay only.
  if (!isAuthenticated) {
    return (
      <PermissionsProvider>
        <AuthOverlay message="Redirecting to login..." />
      </PermissionsProvider>
    )
  }

  return (
    <PermissionsProvider>
      {children}
    </PermissionsProvider>
  )
}
