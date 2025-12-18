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
  | 'admin'
  | 'super_admin'
  | 'can_access_admin'
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
  } catch (error) {
    console.error('Error decoding JWT:', error);
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
        console.warn('Invalid or missing roleId, skipping permissions fetch');
        return [];
      }

      console.log(`Attempting to fetch permissions for role: ${roleId}`);
      console.log(`API URL: ${API_BASE}/api/permissions/role/${roleId}`);

      const response = await fetch(`${API_BASE}/api/permissions/role/${roleId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      console.log(`Response status: ${response.status}`);
      console.log(`Response headers:`, response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`API Error Response:`, errorText);
        throw new Error(`Failed to fetch permissions: ${response.status} - ${errorText}`);
      }

      const responseText = await response.text();
      console.log('[PERMISSIONS] Raw API response:', responseText);

      let permissionsData: PermissionResponse[] = [];
      try {
        permissionsData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[PERMISSIONS] Failed to parse JSON response:', parseError);
        console.error('[PERMISSIONS] Response text:', responseText);
        throw new Error('Invalid JSON response from permissions API');
      }

      console.log('[PERMISSIONS] Parsed permissions data:', permissionsData);
      console.log(`[PERMISSIONS] Total permissions received: ${permissionsData.length}`);

      if (permissionsData.length === 0) {
        console.warn(`[PERMISSIONS] WARNING: No permissions returned for role_id: ${roleId}`);
        console.warn(`[PERMISSIONS] This could mean:`);
        console.warn(`[PERMISSIONS] 1. The role has no permissions assigned in the database`);
        console.warn(`[PERMISSIONS] 2. The role_id doesn't match any role in the database`);
        console.warn(`[PERMISSIONS] 3. There's an issue with the database query`);
      }

      // Map API response to your Permission type
      const mappedPermissions = permissionsData
        .map(perm => {
          console.log(`[PERMISSIONS] Mapping permission:`, perm);
          // Handle both object with name property and string format
          if (typeof perm === 'string') return perm as Permission;
          if (perm && typeof perm === 'object' && 'name' in perm) return (perm as any).name as Permission;
          return undefined as unknown as Permission;
        })
        .filter(perm => perm !== undefined && perm !== null);

      console.log('[PERMISSIONS] Mapped permissions:', mappedPermissions);
      console.log(`[PERMISSIONS] Total mapped permissions: ${mappedPermissions.length}`);
      if (mappedPermissions.length > 0) {
        console.log('[PERMISSIONS] Permission names:', mappedPermissions.join(', '));
      } else {
        console.error('[PERMISSIONS] ERROR: No permissions were successfully mapped!');
      }
      return mappedPermissions;
    } catch (error) {
      console.error('Error fetching permissions:', error);

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
      console.log('========================================');
      console.log('[PERMISSIONS] Initializing permissions...');
      console.log('========================================');

      // Get JWT token from cookies
      token = getCookie('token') || getCookie('jwt') || getCookie('access_token');
      const refreshToken = getCookie('refresh_token');
      
      // Helper to mask token
      const maskToken = (t: string | null): string => {
        if (!t) return 'null';
        if (t.length <= 20) return t;
        return `${t.substring(0, 10)}...${t.substring(t.length - 10)}`;
      };
      
      console.log('[PERMISSIONS] Token Information:');
      console.log('  - Access token found:', !!token);
      console.log('  - Access token (masked):', maskToken(token));
      console.log('  - Refresh token found:', !!refreshToken);
      console.log('  - Refresh token (masked):', maskToken(refreshToken));

      if (!token) {
        console.log('No token found, setting as guest');
        setIsAuthenticated(false);
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        return;
      }

      // Decode JWT to get role_id
      payload = decodeJWT(token);
      console.log('[PERMISSIONS] Decoded JWT Payload:');
      console.log('  - Full payload:', payload);
      if (payload) {
        console.log('  - User ID:', payload.user_id || payload.sub);
        console.log('  - Email:', payload.email);
        console.log('  - Role:', payload.role);
        console.log('  - Role ID:', payload.role_id);
        console.log('  - Expires at:', payload.exp ? new Date(payload.exp * 1000).toISOString() : 'N/A');
        console.log('  - Issued at:', payload.iat ? new Date(payload.iat * 1000).toISOString() : 'N/A');
        console.log('  - Token expired:', payload.exp ? payload.exp * 1000 < Date.now() : 'Unknown');
      }

      if (!payload) {
        console.log('Invalid token, setting as guest');
        setIsAuthenticated(false);
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        return;
      }

      // Check if token is expired
      if (isTokenExpired(payload)) {
        console.warn('JWT token is expired');
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
        const role = payload.role.toLowerCase() as UserRole;
        setUserRole(role);
        console.log(`[PERMISSIONS] Set user role to "${role}" from JWT payload`);
      } else {
        setUserRole('user');
        console.log('[PERMISSIONS] No role in JWT, defaulting to "user"');
      }

      // For all roles, validate role_id exists in payload
      if (!payload.role_id) {
        console.warn('[PERMISSIONS] WARNING: No role_id found in JWT payload!');
        console.warn('[PERMISSIONS] Existing tokens might need refresh, but user role is set to:', payload.role);
        setRoleId(null);
        setPermissions([]);
        setIsAuthenticated(true);
        setIsLoading(false);
        return;
      }

      setRoleId(payload.role_id);
      console.log(`[PERMISSIONS] Extracted role_id from JWT: ${payload.role_id}`);

      // Fetch permissions from API for all users (permission-based access)
      console.log(`[PERMISSIONS] Starting to fetch permissions for role_id: ${payload.role_id}`);
      console.log(`[PERMISSIONS] API URL: ${API_BASE}/api/permissions/role/${payload.role_id}`);
      const fetchedPermissions = await fetchPermissions(payload.role_id, token);
      console.log(`[PERMISSIONS] Successfully fetched ${fetchedPermissions.length} permissions`);
      setPermissions(fetchedPermissions);

      // Determine user role based on permissions fetched from API
      console.log('[PERMISSIONS] Fetched permissions:', fetchedPermissions);
      console.log(`[PERMISSIONS] Permissions state updated with ${fetchedPermissions.length} items`);
      if (fetchedPermissions.length > 0) {
        console.log('[PERMISSIONS] Permission names:', fetchedPermissions.join(', '));
      } else {
        console.warn('[PERMISSIONS] WARNING: No permissions fetched!');
      }

      console.log('[PERMISSIONS] Final State:');
      console.log('  - Is authenticated:', true);
      console.log('  - User role:', payload.role?.toLowerCase() || 'user');
      console.log('  - Role ID:', payload.role_id);
      console.log('  - Permissions count:', fetchedPermissions.length);
      console.log('========================================');
      console.log('[PERMISSIONS] Permissions initialized successfully');
      console.log('========================================');

    } catch (error) {
      console.error('[PERMISSIONS] Failed to initialize permissions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      console.error('[PERMISSIONS] Error details:', {
        message: errorMessage,
        error: error,
        roleId: payload?.role_id,
        hasToken: !!token
      });
      setError(errorMessage);

      // Fallback to guest permissions
      setIsAuthenticated(false);
      setUserRole('guest');
      setRoleId(null);
      setPermissions([]);
      console.warn('[PERMISSIONS] Fallback to guest permissions due to error');
    } finally {
      setIsLoading(false);
      console.log('[PERMISSIONS] Permission initialization complete. Loading:', false);
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
    const hasAllCritical = criticalPermissions.every(perm => permissions.includes(perm));
    if (hasAllCritical) {
      console.log('[PERMISSIONS] Full access granted: User has all critical permissions');
    }
    return hasAllCritical;
  };

  // Helper functions
  const hasPermission = (permission: Permission): boolean => {
    // Full access bypass: If user has all critical permissions, grant access to everything
    if (hasFullAccess()) {
      console.log(`[PERMISSIONS] Full access granted for: ${permission}`);
      return true;
    }

    const hasPerm = permissions.includes(permission);
    console.log(`[PERMISSIONS] Checking permission "${permission}": ${hasPerm} (Available: ${permissions.length} permissions)`);
    return hasPerm;
  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    // Full access bypass: If user has all critical permissions, grant access to everything
    if (hasFullAccess()) {
      console.log('[PERMISSIONS] Full access user: granting access to permissions:', requiredPermissions);
      return true;
    }

    const hasPerm = requiredPermissions.some(permission => permissions.includes(permission));
    console.log('[PERMISSIONS] hasAnyPermission check:', {
      userRole,
      requiredPermissions,
      userPermissions: permissions,
      userPermissionCount: permissions.length,
      hasPermission: hasPerm
    });
    return hasPerm;
  };

  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
    // Full access bypass: If user has all critical permissions, grant access to everything
    if (hasFullAccess()) {
      console.log('[PERMISSIONS] Full access user: granting all permissions:', requiredPermissions);
      return true;
    }

    const hasAll = requiredPermissions.every(permission => permissions.includes(permission));
    const missing = requiredPermissions.filter(perm => !permissions.includes(perm));
    console.log('[PERMISSIONS] hasAllPermissions check:', {
      requiredPermissions,
      userPermissions: permissions,
      hasAll,
      missingPermissions: missing.length > 0 ? missing : 'none'
    });
    return hasAll;
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

      {hasPermission('admin') && (
        <button>Admin Panel</button>
      )}
    </div>
  );
}