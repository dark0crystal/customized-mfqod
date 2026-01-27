/**
 * Server-side route protection utilities
 * Automatically protects routes based on routePermissions configuration
 */

import React from 'react';
import { headers } from 'next/headers';
import { getRoutePermission, normalizePathname } from './getRoutePermission';
import { requirePermission } from './permissions';

/**
 * Protect a route based on its pathname
 * Automatically gets the required permission from routePermissions config
 * and checks if the user has access
 * 
 * @param pathname - The route pathname (can include locale prefix)
 * @param redirectTo - Where to redirect if access is denied (default: '/unauthorized')
 * @returns Promise that resolves if user has access, redirects otherwise
 */
export async function protectRoute(
  pathname: string,
  redirectTo: string = '/unauthorized'
): Promise<void> {
  const normalized = normalizePathname(pathname);
  const routeConfig = getRoutePermission(normalized);

  // If route doesn't require specific permissions, allow access
  if (!routeConfig || !routeConfig.permission) {
    return;
  }

  // Check if permission is empty array (accessible to all authenticated users)
  const permissions = Array.isArray(routeConfig.permission)
    ? routeConfig.permission
    : [routeConfig.permission];

  if (permissions.length === 0) {
    return;
  }

  // Require the permission (will redirect if missing)
  await requirePermission(routeConfig.permission, redirectTo);
}

/**
 * Server component wrapper that automatically protects routes
 * Usage:
 * 
 * export default async function MyPage() {
 *   return (
 *     <AutoRouteProtection>
 *       <MyPageContent />
 *     </AutoRouteProtection>
 *   );
 * }
 */
export async function AutoRouteProtection({
  children,
  redirectTo = '/unauthorized',
}: {
  children: React.ReactNode;
  redirectTo?: string;
}) {
  // Get the current pathname from headers
  const headersList = await headers();
  const pathname = headersList.get('x-pathname') || headersList.get('referer') || '';

  // Protect the route
  await protectRoute(pathname, redirectTo);

  return children;
}

