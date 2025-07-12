"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';


export type Permission = 
  | 'can_create_item_types'
  | 'write' 
  | 'delete'
  | 'admin'
  | 'moderator'
  | 'user'
  | 'create_post'
  | 'edit_post'
  | 'view_analytics';

// Define user roles
export type UserRole = 'admin' | 'moderator' | 'user' | 'guest';

// Context type
interface PermissionsContextType {
  permissions: Permission[];
  userRole: UserRole;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  setUserPermissions: (permissions: Permission[]) => void;
  setUserRole: (role: UserRole) => void;
  isLoading: boolean;
}

// Create the context
const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

// Provider props
interface PermissionsProviderProps {
  children: ReactNode;
}

// Role-based permission mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: ['can_create_item_types', 'write', 'delete', 'admin', 'create_post', 'edit_post', 'view_analytics'],
  moderator: ['can_create_item_types', 'write', 'moderator', 'create_post', 'edit_post'],
  user: ['can_create_item_types', 'create_post'],
  guest: ['can_create_item_types']
};

// Provider component
export function PermissionsProvider({ children }: PermissionsProviderProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [userRole, setUserRole] = useState<UserRole>('guest');
  const [isLoading, setIsLoading] = useState(true);

  // Initialize permissions when component mounts
  useEffect(() => {
    // Simulate fetching user permissions from API
    const initializePermissions = async () => {
      try {
        // This would be your actual API call
        // const response = await fetch('/api/user/permissions');
        // const { role, permissions } = await response.json();
        
        // For demo purposes, set default permissions
        const defaultRole: UserRole = 'guest';
        const defaultPermissions = rolePermissions[defaultRole];
        
        setUserRole(defaultRole);
        setPermissions(defaultPermissions);
      } catch (error) {
        console.error('Failed to load permissions:', error);
        // Fallback to guest permissions
        setUserRole('guest');
        setPermissions(rolePermissions.guest);
      } finally {
        setIsLoading(false);
      }
    };

    initializePermissions();
  }, []);

  // Update permissions when role changes
  useEffect(() => {
    setPermissions(rolePermissions[userRole]);
  }, [userRole]);

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
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    setUserPermissions,
    setUserRole,
    isLoading
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
    const { hasAllPermissions } = usePermissions();
    
    if (!hasAllPermissions(requiredPermissions)) {
      return <div>Access denied. Insufficient permissions.</div>;
    }
    
    return <Component {...props} />;
  };
}
