"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type Permission =
  // Consolidated hierarchical permissions
  | 'can_manage_items'
  | 'can_manage_missing_items'
  | 'can_manage_claims'
  | 'can_manage_item_types'
  | 'can_manage_branches'
  | 'can_manage_addresses'
  | 'can_manage_organizations'
  | 'can_manage_transfer_requests'
  | 'can_manage_users'
  | 'can_view_analytics'
  // System & Admin permissions
  | 'super_admin'

  | 'can_manage_roles'
  | 'can_manage_permissions'
  | 'can_configure_system'
  | 'can_view_system_logs'
  // Legacy role types (for backward compatibility)
  | 'moderator'
  | 'user'
  | string; // Allow any string for dynamic permissions from API

const API_BASE = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

// Define user roles
export type UserRole = 'super_admin' | 'admin' | 'moderator' | 'user' | 'guest';

// JWT payload interface
interface JWTPayload {
  sub: string;
  role_id?: string;
  exp: number;
  iat: number;
  role?: string;
  email?: string;
  [key: string]: unknown;
}

// API response interface for permissions
interface PermissionResponse {
  id: string;
  name: string;
  description?: string;
}

// Context type
interface PermissionsContextType {
  permissions: Permission[];
  userRole: UserRole;
  roleId: string | null;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasFullAccess: () => boolean;
  setUserPermissions: (permissions: Permission[]) => void;
  setUserRole: (role: UserRole) => void;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshPermissions: () => Promise<void>;
  error: string | null;
}

// Create the context
const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// Provider props
interface PermissionsProviderProps {
  children: ReactNode;
}

// Utility function to get cookie value
const getCookie = (name: string): string | null => {
  if (typeof document === 'undefined') return null;

  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

// Utility function to decode JWT (without verification - client-side only)
const decodeJWT = (token: string): JWTPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function (c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
  } catch {

    return null;
  }
};

// Check if JWT is expired
const isTokenExpired = (payload: JWTPayload): boolean => {
  return payload.exp * 1000 < Date.now();
};

// Provider component
export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Function to fetch permissions from API
  const fetchPermissions = async (roleId: string, token: string): Promise<Permission[]> => {
    try {
      // Validate roleId before making the request
      if (!roleId || roleId === 'undefined' || roleId === 'null') {
        return [];
      }


      const response = await fetch(`${API_BASE}/api/permissions/role/${roleId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();

        throw new Error(`Failed to fetch permissions: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();


      let permissionsData: PermissionResponse[] = [];
      try {
        permissionsData = JSON.parse(responseText);
      } catch {
        throw new Error('Invalid JSON response from permissions API');
      }

      if (permissionsData.length === 0) {

        return []; // Return empty array instead of error
      }

      // Map API response to your Permission type
      const mappedPermissions = permissionsData
        .map(perm => {

          // Handle both object with name property and string format
          if (typeof perm === 'string') return perm as Permission;
          if (perm && typeof perm === 'object' && 'name' in perm) {
            const permObj = perm as PermissionResponse;
            return permObj.name as Permission;
          }

          return undefined as unknown as Permission;
        })
        .filter(perm => perm !== undefined && perm !== null);

      return mappedPermissions;
    } catch (error) {

      // More specific error handling
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Unable to connect to the server. Is the backend running?');
      }

      throw error;
    }
  };

  // Function to initialize permissions
  const initializePermissions = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    // Declare variables outside try block for use in catch
    let token: string | null = null;
    let payload: JWTPayload | null = null;

    try {
      // Get JWT token from cookies
      token = getCookie('token') || getCookie('jwt');

      if (!token) {

        setIsAuthenticated(false);
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        return;
      }

      // Decode JWT to get role_id
      payload = decodeJWT(token);

      if (!payload) {

        setIsAuthenticated(false);
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        return;
      }

      // Check if token is expired
      if (isTokenExpired(payload)) {

        setIsAuthenticated(false);
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        setError('Token expired. Please log in again.');
        return;
      }

      // Set authenticated state
      setIsAuthenticated(true);

      // Determine user role based on JWT payload FIRST
      if (payload.role) {
        setUserRole(payload.role.toLowerCase() as UserRole);
      } else {
        setUserRole('user');

      }

      // For all roles, validate role_id exists in payload
      if (!payload.role_id) {

        setRoleId(null);
        setPermissions([]);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      setRoleId(payload.role_id);

      // Fetch permissions from API for all users (permission-based access)
      const fetchedPermissions = await fetchPermissions(payload.role_id, token);
      setPermissions(fetchedPermissions);

    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error occurred');


      // Fallback to guest permissions
      setIsAuthenticated(false);
      setUserRole('guest');
      setRoleId(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);

    }
  }, []);

  // Function to refresh permissions
  const refreshPermissions = async () => {
    await initializePermissions();
  };

  // Initialize client-side state
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Initialize permissions when component mounts and client is ready
  useEffect(() => {
    if (isClient) {
      initializePermissions();
    }
  }, [isClient, initializePermissions]);

  // Helper function to check if user has full access (all permissions)
  const hasFullAccess = (): boolean => {
    // Comprehensive permissions check (heuristic)
    const criticalPermissions = [
      'can_manage_items',
      'can_manage_missing_items',
      'can_manage_claims',
      'can_manage_item_types',
      'can_manage_branches',
      'can_manage_addresses',
      'can_manage_organizations',
      'can_manage_transfer_requests',
      'can_manage_users',
      'can_manage_roles',
      'can_manage_permissions'
    ];

    // If user has all critical permissions, consider them as having full access
    return criticalPermissions.every(perm => permissions.includes(perm));

  };

  // Helper functions
  const hasPermission = (permission: Permission): boolean => {
    // Full access bypass: If user has all critical permissions, grant access to everything
    if (hasFullAccess()) {
      return true;
    }
    return permissions.includes(permission);

  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    // Full access bypass: If user has all critical permissions, grant access to everything
    if (hasFullAccess()) {
      return true;
    }
    return requiredPermissions.some(permission => permissions.includes(permission));

  };

  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    // Full access bypass: If user has all critical permissions, grant access to everything
    if (hasFullAccess()) {
      return true;
    }
    return requiredPermissions.every(permission => permissions.includes(permission));

  };

  const setUserPermissions = (newPermissions: Permission[]) => {
    setPermissions(newPermissions);
  };

  const contextValue: PermissionsContextType = {
    permissions,
    userRole,
    roleId,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    hasFullAccess,
    setUserPermissions,
    setUserRole,
    isLoading,
    isAuthenticated,
    refreshPermissions,
    error
  };

  // Show loading state during SSR and initial client render
  if (!isClient) {
    return (
      <PermissionsContext.Provider value={{
        permissions: [],
        userRole: 'guest',
        roleId: null,
        hasPermission: () => false,
        hasAnyPermission: () => false,
        hasAllPermissions: () => false,
        hasFullAccess: () => false,
        setUserPermissions: () => { },
        setUserRole: () => { },
        isLoading: true,
        isAuthenticated: false,
        refreshPermissions: async () => { },
        error: null
      }}>
        {children}
      </PermissionsContext.Provider>
    );
  }

  return (
    <PermissionsContext.Provider value={contextValue}>
      {children}
    </PermissionsContext.Provider>
  );
}

// Custom hook to use permissions
export function usePermissions(): PermissionsContextType {
  const context = useContext(PermissionsContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

// HOC for permission-based rendering
export function withPermissions<P extends object>(
  Component: React.ComponentType<P>,
  requiredPermissions: Permission[]
) {
  return function PermissionWrappedComponent(props: P) {
    const { hasAllPermissions, isLoading } = usePermissions();

    if (isLoading) {
      // Note: This is a low-level component, translations would require context
      // For now, keeping English as fallback
      return <div>Loading permissions...</div>;
    }

    if (!hasAllPermissions(requiredPermissions)) {
      // Note: This is a low-level component, translations would require context
      // For now, keeping English as fallback
      return <div>Access denied. Insufficient permissions.</div>;
    }

    return <Component {...props} />;
  };
}

// Enhanced example usage component with error display
export function ExampleUsage() {
  const {
    permissions,
    userRole,
    roleId,
    hasPermission,
    isLoading,
    isAuthenticated,
    refreshPermissions,
    error
  } = usePermissions();

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  return (
    <div>
      <h2>Permission Status</h2>

      {error && (
        <div style={{ color: 'red', padding: '10px', border: '1px solid red', marginBottom: '10px' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
      <p>Role: {userRole}</p>
      <p>Role ID: {roleId}</p>
      <p>Permissions: {permissions.join(', ')}</p>

      <button onClick={refreshPermissions}>
        Refresh Permissions
      </button>

      {hasPermission('can_create_item_types') && (
        <button>Create Item Types</button>
      )}

    </div>
  );
}