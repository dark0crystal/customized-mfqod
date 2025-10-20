"use client";

import { usePermissions } from "@/PermissionsContext";

export default function DebugUserInfo() {
  const { userRole, permissions, isAuthenticated, isLoading } = usePermissions();

  if (isLoading) {
    return <div>Loading user info...</div>;
  }

  return (
    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg m-4">
      <h3 className="text-lg font-semibold text-yellow-800 mb-2">Debug User Info</h3>
      <div className="space-y-2 text-sm">
        <div><strong>Authenticated:</strong> {isAuthenticated ? 'Yes' : 'No'}</div>
        <div><strong>User Role:</strong> {userRole}</div>
        <div><strong>Permissions:</strong> {permissions.join(', ') || 'None'}</div>
        <div><strong>Is Super Admin:</strong> {userRole === 'super_admin' ? 'Yes' : 'No'}</div>
        <div><strong>Is Admin:</strong> {userRole === 'admin' ? 'Yes' : 'No'}</div>
        <div><strong>Is Super Admin or Admin:</strong> {(userRole === 'super_admin' || userRole === 'admin') ? 'Yes' : 'No'}</div>
        <div><strong>Has Super Admin Permission:</strong> {permissions.includes('super_admin') ? 'Yes' : 'No'}</div>
        <div><strong>Has Admin Permission:</strong> {permissions.includes('admin') ? 'Yes' : 'No'}</div>
      </div>
    </div>
  );
}
