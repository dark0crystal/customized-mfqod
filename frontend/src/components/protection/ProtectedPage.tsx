'use client'

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/PermissionsContext';

interface ProtectedPageProps {
  children: React.ReactNode;
  requiredPermission?: string | string[];
  redirectTo?: string;
}

/**
 * Client component wrapper for protecting pages that use "use client"
 * Checks permissions using the PermissionsContext and redirects if access is denied
 * 
 * Usage:
 * ```tsx
 * export default function MyPage() {
 *   return (
 *     <ProtectedPage requiredPermission="can_manage_items">
 *       <MyPageContent />
 *     </ProtectedPage>
 *   );
 * }
 * ```
 */
export default function ProtectedPage({
  children,
  requiredPermission,
  redirectTo = '/unauthorized',
}: ProtectedPageProps) {
  const router = useRouter();
  const { hasPermission, hasFullAccess, isLoading } = usePermissions();

  useEffect(() => {
    // Don't check if still loading permissions
    if (isLoading) {
      return;
    }

    // If no requiredPermission specified, allow access (route is accessible to all authenticated users)
    if (!requiredPermission) {
      return;
    }

    // Normalize to array
    const permissions = Array.isArray(requiredPermission) 
      ? requiredPermission 
      : [requiredPermission];

    // Check if user has full access or required permission
    const hasAccess = hasFullAccess || permissions.some(perm => hasPermission(perm));

    if (!hasAccess) {
      router.push(redirectTo);
    }
  }, [isLoading, hasPermission, hasFullAccess, requiredPermission, router, redirectTo]);

  // Show loading state while checking permissions
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // Render children if we reach here (permission check passed or no permission required)
  return <>{children}</>;
}

