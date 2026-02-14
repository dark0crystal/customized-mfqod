/**
 * Server-side permission utilities
 * These functions run on the server and cannot be bypassed by client-side manipulation
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_HOST_NAME || 'http://localhost:8000';

interface PermissionCheckResult {
  hasPermission: boolean;
  hasFullAccess: boolean;
  userPermissions: string[];
  userId?: string;
  roleId?: string;
}

/**
 * Extract JWT token from cookies
 * Decodes URL-encoded value since the client stores the token with encodeURIComponent
 */
export async function getTokenFromCookies(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const raw =
      cookieStore.get('token')?.value ||
      cookieStore.get('jwt')?.value;

    if (!raw) return null;
    // Client sets cookie with encodeURIComponent(token), so dots become %2E — decode so JWT parse works
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  } catch {
    return null;
  }
}

/**
 * Decode JWT token to extract payload (without verification)
 * Note: This is for extracting user info only. Actual verification happens on backend.
 */
export function decodeToken(token: string): any {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      Buffer.from(base64, 'base64').toString('utf-8')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeToken(token);
  if (!payload || !payload.exp) {
    return true;
  }
  return payload.exp * 1000 < Date.now();
}

/**
 * Get user permissions from backend API
 * This makes a server-side call to verify permissions
 */
export async function getUserPermissions(token: string): Promise<PermissionCheckResult> {
  try {
    // First, decode token to get role_id
    const payload = decodeToken(token);
    if (!payload || !payload.role_id) {
      return {
        hasPermission: false,
        hasFullAccess: false,
        userPermissions: [],
      };
    }

    // Ensure role_id is string (JWT may encode it as number)
    const roleId = String(payload.role_id);

    // Call backend API to get permissions for the role
    const response = await fetch(`${API_BASE}/api/permissions/role/${roleId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store', // Always fetch fresh permissions
    });

    if (!response.ok) {
      // 401: invalid/expired token; 404: role not found — treat as no permissions
      if (response.status === 401 || response.status === 404) {
        return {
          hasPermission: false,
          hasFullAccess: false,
          userPermissions: [],
        };
      }
      throw new Error(`Failed to fetch permissions: ${response.status}`);
    }

    const permissions: Array<{ id: string; name: string }> = await response.json();
    const permissionNames = permissions.map(p => p.name);
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
      'can_manage_permissions',
    ];
    const hasFullAccess = criticalPermissions.every(perm => permissionNames.includes(perm));

    return {
      hasPermission: false, // Will be set by checkPermission
      hasFullAccess,
      userPermissions: permissionNames,
      userId: payload.user_id || payload.sub,
      roleId: payload.role_id,
    };
  } catch {
    return {
      hasPermission: false,
      hasFullAccess: false,
      userPermissions: [],
    };
  }
}

/**
 * Check if user has a specific permission
 */
export async function checkPermission(
  requiredPermission: string | string[],
  token?: string | null
): Promise<PermissionCheckResult> {
  const authToken = token || await getTokenFromCookies();

  if (!authToken) {
    return {
      hasPermission: false,
      hasFullAccess: false,
      userPermissions: [],
    };
  }

  // Check if token is expired
  if (isTokenExpired(authToken)) {
    return {
      hasPermission: false,
      hasFullAccess: false,
      userPermissions: [],
    };
  }

  // Get user permissions
  const result = await getUserPermissions(authToken);

  if (result.hasFullAccess) {
    return {
      ...result,
      hasPermission: true,
    };
  }

  // Check if user has required permission(s)
  const requiredPermissions = Array.isArray(requiredPermission)
    ? requiredPermission
    : [requiredPermission];

  const hasPermission = requiredPermissions.some(perm =>
    result.userPermissions.includes(perm)
  );

  return {
    ...result,
    hasPermission,
  };
}

/**
 * Require permission - throws redirect if permission is missing
 * Use this in server components to protect pages
 */
export async function requirePermission(
  requiredPermission: string | string[],
  redirectTo: string = '/unauthorized'
): Promise<PermissionCheckResult> {
  const result = await checkPermission(requiredPermission);

  if (!result.hasPermission && !result.hasFullAccess) {
    redirect(redirectTo);
  }

  return result;
}

/**
 * Get authenticated user info from token
 */
export async function getAuthenticatedUser(): Promise<{
  userId?: string;
  roleId?: string;
  email?: string;
  role?: string;
} | null> {
  const token = await getTokenFromCookies();

  if (!token || isTokenExpired(token)) {
    return null;
  }

  const payload = decodeToken(token);
  if (!payload) {
    return null;
  }

  return {
    userId: payload.user_id || payload.sub,
    roleId: payload.role_id,
    email: payload.email,
    role: payload.role,
  };
}


