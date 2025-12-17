"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
  role_id: string;
  exp: number;
  iat: number;
  [key: string]: any;
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
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
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

      const permissionsData: PermissionResponse[] = await response.json();
      console.log('Fetched permissions data:', permissionsData);
      
      // Map API response to your Permission type
      const mappedPermissions = permissionsData
        .map(perm => perm.name as Permission)
        .filter(perm => perm !== undefined);

      console.log('Mapped permissions:', mappedPermissions);
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
  const initializePermissions = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      console.log('Initializing permissions...');
      
      // Get JWT token from cookies
      const token = getCookie('token') || getCookie('jwt') || getCookie('access_token');
      console.log('Token found:', !!token);
      
      if (!token) {
        console.log('No token found, setting as guest');
        setIsAuthenticated(false);
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        return;
      }

      // Decode JWT to get role_id
      const payload = decodeJWT(token);
      console.log('Decoded JWT payload:', payload);
      
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
      
      // Determine user role based on JWT payload
      console.log('JWT payload role:', payload.role);
      console.log('JWT payload role_id:', payload.role_id);
      console.log('JWT payload email:', payload.email);
      console.log('JWT payload sub:', payload.sub);
      
      // For all roles, validate role_id exists in payload
      if (!payload.role_id) {
        console.warn('No role_id found in JWT payload, setting as user');
        setUserRole('user');
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

      // Determine user role based on permissions fetched from API
      console.log('Fetched permissions:', fetchedPermissions);
      
      // Set role based on role name from JWT if available, otherwise default to 'user'
      if (payload.role) {
        setUserRole(payload.role.toLowerCase() as UserRole);
        console.log(`Set user role to ${payload.role.toLowerCase()} from JWT payload`);
      } else {
        setUserRole('user');
        console.log('Set user role to user (default)');
      }

      console.log('Permissions initialized successfully');

    } catch (error) {
      console.error('Failed to initialize permissions:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      setError(errorMessage);
      
      // Fallback to guest permissions
      setIsAuthenticated(false);
      setUserRole('guest');
      setRoleId(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

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
  }, [isClient]);

  // Helper function to check if user has full access (all permissions)
  const hasFullAccess = (): boolean => {
    // Check if user has a comprehensive set of all manage permissions
    // This is a heuristic - ideally we'd fetch all permissions and compare
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
      console.log('Full access user: granting access to permissions:', requiredPermissions);
      return true;
    }
    
    const hasPermission = requiredPermissions.some(permission => permissions.includes(permission));
    console.log('Permission check:', { userRole, requiredPermissions, permissions, hasPermission });
    return hasPermission;
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
        setUserPermissions: () => {},
        setUserRole: () => {},
        isLoading: true,
        isAuthenticated: false,
        refreshPermissions: async () => {},
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