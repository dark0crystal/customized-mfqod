/**
 * Server-Side Permission HOC
 * Wraps server components to check permissions before rendering
 */

import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { requirePermission } from './permissions';

interface WithPermissionsProps {
  children: ReactNode;
  permission: string | string[];
  redirectTo?: string;
}

/**
 * Server component wrapper that checks permissions before rendering
 * Usage in page.tsx:
 * 
 * export default async function MyPage() {
 *   return (
 *     <WithPermissions permission="can_manage_items">
 *       <MyPageContent />
 *     </WithPermissions>
 *   );
 * }
 */
export async function WithPermissions({
  children,
  permission,
  redirectTo = '/unauthorized',
}: WithPermissionsProps) {
  // This will redirect if permission is missing
  await requirePermission(permission, redirectTo);
  
  // If we reach here, user has permission
  return <>{children}</>;
}

/**
 * Higher-order component for protecting server components
 * Usage:
 * 
 * const ProtectedPage = withPermissions(MyPage, 'can_manage_items');
 */
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermission: string | string[],
  redirectTo: string = '/unauthorized'
) {
  return async function PermissionProtectedComponent(props: P) {
    await requirePermission(requiredPermission, redirectTo);
    return <Component {...props} />;
  };
}














