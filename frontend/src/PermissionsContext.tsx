"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Permission = 
  | 'can_create_item_types'
  | 'can_delete_item_types' 
  | 'delete'
  | 'admin'
  | 'moderator'
  | 'user'
  | 'create_post'
  | 'can_edit_item_types'
  | 'view_analytics';

const API_BASE = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

// Define user roles
export type UserRole = 'admin' | 'moderator' | 'user' | 'guest';

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
      
      // Validate role_id exists in payload
      if (!payload.role_id) {
        console.warn('No role_id found in JWT payload, setting as guest');
        setUserRole('guest');
        setRoleId(null);
        setPermissions([]);
        return;
      }
      
      setRoleId(payload.role_id);

      // Fetch permissions from API
      const fetchedPermissions = await fetchPermissions(payload.role_id, token);
      setPermissions(fetchedPermissions);

      // Determine user role based on permissions
      if (fetchedPermissions.includes('admin')) {
        setUserRole('admin');
      } else if (fetchedPermissions.includes('moderator')) {
        setUserRole('moderator');
      } else {
        setUserRole('user');
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

  // Initialize permissions when component mounts
  useEffect(() => {
    initializePermissions();
  }, []);

  // Helper functions
  const hasPermission = (permission: Permission): boolean => {
    return permissions.includes(permission);
  };

  const hasAnyPermission = (requiredPermissions: Permission[]): boolean => {
    return requiredPermissions.some(permission => permissions.includes(permission));
  };

  const hasAllPermissions = (requiredPermissions: Permission[]): boolean => {
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
      return <div>Loading permissions...</div>;
    }
    
    if (!hasAllPermissions(requiredPermissions)) {
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