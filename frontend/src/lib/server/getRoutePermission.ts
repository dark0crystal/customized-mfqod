/**
 * Get required permission for a route pathname
 * Handles locale prefixes and route normalization
 * Used by both server and client protection
 */

import { getRoutePermission as getRoutePermissionConfig, type RoutePermissionConfig } from './routePermissions';

/**
 * Normalize pathname by removing locale prefix and trailing slashes
 * @param pathname - The route pathname (e.g., '/en/dashboard/items' or '/dashboard/items')
 * @returns Normalized pathname without locale prefix
 */
export function normalizePathname(pathname: string): string {
  // Remove locale prefix (en/ar)
  const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '') || '/';
  
  // Remove trailing slashes
  const normalized = pathWithoutLocale.replace(/\/$/, '') || '/';
  
  return normalized;
}

/**
 * Get required permission configuration for a route
 * @param pathname - The route pathname (can include locale prefix)
 * @returns RoutePermissionConfig or null if route doesn't require specific permissions
 */
export function getRoutePermission(pathname: string): RoutePermissionConfig | null {
  const normalized = normalizePathname(pathname);
  return getRoutePermissionConfig(normalized);
}

/**
 * Check if a route requires a specific permission
 * @param pathname - The route pathname
 * @returns True if route requires a permission (non-empty array or string)
 */
export function routeRequiresPermission(pathname: string): boolean {
  const config = getRoutePermission(pathname);
  if (!config) return false;
  
  // Check if permission is a non-empty array or non-empty string
  if (Array.isArray(config.permission)) {
    return config.permission.length > 0;
  }
  
  if (typeof config.permission === 'string') {
    return config.permission.length > 0;
  }
  
  return false;
}

