/**
 * Route-to-Permission Mapping
 * Centralized mapping of routes to required permissions
 * Used by middleware and page components for server-side protection
 */

export interface RoutePermissionConfig {
  permission: string | string[];
  description?: string;
}

/**
 * Map of route patterns to required permissions
 * Routes are matched in order, first match wins
 */
export const routePermissions: Record<string, RoutePermissionConfig> = {
  // Dashboard routes
  '/dashboard': {
    permission: [], // Dashboard itself is accessible to all authenticated users
    description: 'Main dashboard - accessible to all authenticated users',
  },
  
  // Items management
  '/dashboard/items': {
    permission: 'can_manage_items',
    description: 'View and manage items',
  },
  '/dashboard/items/': {
    permission: 'can_manage_items',
    description: 'View and manage items',
  },
  
  // Missing items management
  '/dashboard/missing-items': {
    permission: [],
    description: 'View and manage missing items - accessible to all authenticated users (users see their own missing items, admins see all)',
  },
  '/dashboard/missing-items/': {
    permission: [],
    description: 'View and manage missing items - accessible to all authenticated users (users see their own missing items, admins see all)',
  },
  '/dashboard/report-missing-item': {
    permission: [],
    description: 'Report missing items - accessible to all authenticated users',
  },
  
  // Claims management
  '/dashboard/claims': {
    permission: [],
    description: 'View and manage claims - accessible to all authenticated users (users see their own claims, admins see all)',
  },
  '/dashboard/claims/': {
    permission: [],
    description: 'View and manage claims - accessible to all authenticated users (users see their own claims, admins see all)',
  },
  
  // Item types management
  '/dashboard/item-types': {
    permission: 'can_manage_item_types',
    description: 'Manage item types',
  },
  
  // Branches management
  '/dashboard/branch': {
    permission: 'can_manage_branches',
    description: 'Manage branches',
  },
  
  // Users management
  '/dashboard/manage-users': {
    permission: 'can_manage_users',
    description: 'Manage users',
  },
  '/dashboard/manage-users/': {
    permission: 'can_manage_users',
    description: 'Manage users',
  },
  
  // Permissions management
  '/dashboard/permissions': {
    permission: 'can_manage_permissions',
    description: 'Manage permissions and roles',
  },
  
  // Audit logs
  '/dashboard/audit-logs': {
    permission: 'can_view_audit_logs',
    description: 'View audit logs',
  },
  
  // Transfer requests
  '/dashboard/transfer-requests': {
    permission: 'can_manage_transfer_requests',
    description: 'Manage transfer requests',
  },
  
  // Analytics
  '/dashboard/analytics': {
    permission: 'can_view_analytics',
    description: 'View analytics',
  },
  
  // Report found item (requires can_manage_items permission)
  '/dashboard/report-found-item': {
    permission: 'can_manage_items',
    description: 'Report found items - requires can_manage_items permission',
  },
};

/**
 * Get required permission for a route
 * @param pathname - The route pathname (e.g., '/dashboard/items')
 * @returns Permission config or null if route doesn't require specific permissions
 */
export function getRoutePermission(pathname: string): RoutePermissionConfig | null {
  // Normalize pathname (remove trailing slashes, ensure it starts with /)
  const normalized = pathname.replace(/\/$/, '') || '/';
  
  // Try exact match first
  if (routePermissions[normalized]) {
    return routePermissions[normalized];
  }
  
  // Try with trailing slash
  if (routePermissions[normalized + '/']) {
    return routePermissions[normalized + '/'];
  }
  
  // Try prefix match (for nested routes like /dashboard/items/[itemId])
  const matchingRoute = Object.keys(routePermissions)
    .sort((a, b) => b.length - a.length) // Sort by length descending (longest first)
    .find(route => normalized.startsWith(route));
  
  if (matchingRoute) {
    return routePermissions[matchingRoute];
  }
  
  // No specific permission required
  return null;
}

/**
 * Check if a route requires authentication
 * All /dashboard routes require authentication
 */
export function requiresAuthentication(pathname: string): boolean {
  return pathname.startsWith('/dashboard') || pathname.startsWith('/[locale]/dashboard');
}

/**
 * Check if a route requires specific permissions
 */
export function requiresPermission(pathname: string): boolean {
  const config = getRoutePermission(pathname);
  return config !== null && Array.isArray(config.permission) && config.permission.length > 0;
}



