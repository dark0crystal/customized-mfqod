"use client"
import React, { useState, useEffect } from 'react';
import {
  Home,
  FileText,
  Shield,
  PlusCircle,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  LogOut,
  User,
  Building2,
  Package,
  TrendingUp,
  UserCheck,
  Key,
  Tags,
  Loader2,
  ArrowRightLeft
} from 'lucide-react';
import Brand from '@/components/navbar/Brand';
import { Link } from '@/i18n/navigation';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';
import { usePendingItemsCount } from '@/hooks/usePendingItemsCount';

// Helper to get user from cookies
const getUserFromCookies = () => {
  if (typeof document !== "undefined") {
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === "user") {
        try {
          return JSON.parse(decodeURIComponent(value));
        } catch {
          console.error("Failed to parse user cookie");
          return null;
        }
      }
    }
  }
  return null;
};

import { usePermissions, Permission } from "@/PermissionsContext";

// Navigation item interface
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  requiredPermissions?: Permission[];
  requiredRole?: string;
  allowedRoles?: string[];
  children?: NavItem[];
  showBadge?: boolean; // Whether to show pending items badge
}

export default function SideNavbar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [loadingLinks, setLoadingLinks] = useState<Set<string>>(new Set());
  const { userRole, hasAnyPermission, isAuthenticated } = usePermissions();
  const user = getUserFromCookies();
  const { logout, isLoading: logoutLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('dashboard.sideNavbar');
  const { count: pendingItemsCount, loading: pendingLoading, error: pendingError } = usePendingItemsCount();
  
  // #region agent log
  React.useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SideNavbar.tsx:useEffect:badge_state',message:'Badge state in SideNavbar',data:{pendingItemsCount,loading:pendingLoading,error:pendingError},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
  }, [pendingItemsCount, pendingLoading, pendingError]);
  // #endregion

  // Clear loading states when pathname changes
  useEffect(() => {
    setLoadingLinks(new Set());
  }, [pathname]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      // The logout function in useAuth already handles redirecting to login
    } catch (error) {
      console.error('Logout failed:', error);
      // Even if logout fails, redirect to login page
      router.push('/auth/login');
    }
  };

  // Handle navigation with loading state
  const handleNavigation = (href: string, itemId: string) => {
    if (pathname === href) return; // Don't navigate if already on the page

    setLoadingLinks(prev => new Set(prev).add(itemId));

    // Clear loading state when navigation completes
    const handleRouteChange = () => {
      setLoadingLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    };

    // Listen for route changes
    const originalPush = router.push;
    router.push = (...args) => {
      handleRouteChange();
      return originalPush.apply(router, args);
    };

    // Fallback: clear loading after 2 seconds if route change doesn't happen
    setTimeout(() => {
      setLoadingLinks(prev => {
        const newSet = new Set(prev);
        newSet.delete(itemId);
        return newSet;
      });
    }, 2000);
  };

  // Navigation configuration
  const navigationItems: NavItem[] = [
    {
      id: 'dashboard',
      label: t('dashboard'),
      icon: <Home size={20} />,
      href: '/dashboard',
    },
    {
      id: 'Items',
      label: t('itemsManagement'),
      icon: <Package size={20} />,
      href: '/dashboard/items',
      requiredPermissions: ['create_post', 'edit_post'],
      children: [
        {
          id: 'Items',
          label: t('items'),
          icon: <Package size={16} />,
          href: '/dashboard/items',
          requiredPermissions: ['create_post', 'edit_post'],
          showBadge: true
        },
        {
          id: 'report-found-item',
          label: t('reportFoundItem'),
          icon: <PlusCircle size={16} />,
          href: '/dashboard/report-found-item',
          requiredPermissions: ['create_post']
        },
        {
          id: 'report-missing-item',
          label: t('reportMissingItem'),
          icon: <FileText size={16} />,
          href: '/dashboard/report-missing-item',
          requiredPermissions: ['can_create_missing_items']
        },
        {
          id: 'missing-items',
          label: t('missingItems'),
          icon: <FileText size={16} />,
          href: '/dashboard/missing-items',
          requiredPermissions: ['create_post', 'edit_post'],
          showBadge: true
        },
        {
          id: 'transfer-requests',
          label: t('transferRequests'),
          icon: <ArrowRightLeft size={16} />,
          href: '/dashboard/transfer-requests',
          requiredPermissions: ['can_view_items']
        }

      ]
    },

    {
      id: 'analytics',
      label: t('analytics'),
      icon: <TrendingUp size={20} />,
      href: '/dashboard/analytics',
      requiredPermissions: ['view_analytics']
    },

    {
      id: 'admin',
      label: t('adminPanel'),
      icon: <Shield size={20} />,
      href: '/admin',
      allowedRoles: ['super_admin', 'admin'],
      children: [
        {
          id: 'manage-branches',
          label: t('manageBranches'),
          icon: <Building2 size={16} />,
          href: '/dashboard/branch',
          requiredPermissions: ['super_admin', 'admin']
        },
        {
          id: 'item-types',
          label: t('itemTypes'),
          icon: <Tags size={16} />,
          href: '/dashboard/item-types',
          requiredPermissions: ['can_create_item_types']
        },
        {
          id: 'manage-users',
          label: t('manageUsers'),
          icon: <UserCheck size={16} />,
          href: '/dashboard/manage-users',
          requiredPermissions: ['super_admin', 'admin']
        },
        {
          id: 'manage-permissions',
          label: t('managePermissions'),
          icon: <Key size={16} />,
          href: '/dashboard/permissions',
          requiredPermissions: ['super_admin', 'admin']
        }
      ]
    }
  ];

  // Check if user can access a nav item
  const canAccessItem = (item: NavItem): boolean => {
    if (!isAuthenticated && item.href !== '/auth/login') {
      console.log('Access denied: not authenticated for', item.id);
      return false;
    }

    // Check role requirements
    if (item.requiredRole && userRole !== item.requiredRole) {
      console.log('Access denied: role mismatch for', item.id, 'required:', item.requiredRole, 'user:', userRole);
      return false;
    }

    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
      console.log('Access denied: not in allowed roles for', item.id, 'allowed:', item.allowedRoles, 'user:', userRole);
      return false;
    }

    // Check permission requirements
    if (item.requiredPermissions) {
      const hasPermission = hasAnyPermission(item.requiredPermissions);
      console.log('Permission check for', item.id, 'required:', item.requiredPermissions, 'hasPermission:', hasPermission);
      if (!hasPermission) {
        console.log('Access denied: missing permissions for', item.id);
        return false;
      }
    }

    console.log('Access granted for', item.id);
    return true;
  };

  // Toggle expanded state for items with children
  const toggleExpanded = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  // Badge component - styled as pink circle with red number
  const Badge = ({ count }: { count: number }) => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SideNavbar.tsx:Badge:render',message:'Badge render check',data:{count,will_render:count > 0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    if (count === 0) return null;
    
    return (
      <span className="ml-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-pink-100 text-red-800 text-xs font-semibold">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  // Render navigation item
  const renderNavItem = (item: NavItem, depth: number = 0) => {
    if (!canAccessItem(item)) {
      return null;
    }

    const isExpanded = expandedItems.includes(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const accessibleChildren = item.children?.filter(child => canAccessItem(child)) || [];
    const isActive = pathname === item.href;
    const isChildActive = item.children?.some(child => pathname === child.href);
    const isLoading = loadingLinks.has(item.id);
    const shouldShowBadge = item.showBadge && pendingItemsCount > 0;
    
    // #region agent log
    if (item.showBadge) {
      fetch('http://127.0.0.1:7242/ingest/69e531fd-3951-4df8-bc69-ee7e2dc1cf2a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SideNavbar.tsx:renderNavItem:badge_check',message:'Badge visibility check',data:{itemId:item.id,showBadge:item.showBadge,pendingItemsCount,shouldShowBadge},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    }
    // #endregion

    return (
      <div key={item.id} className="mb-1">
        {hasChildren && accessibleChildren.length > 0 ? (
          <div
            className={`
              flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
              hover:bg-blue-50 hover:text-blue-600 group
              ${depth > 0 ? 'ml-4 py-1.5' : ''}
              ${isActive ? 'bg-blue-50 text-blue-600' : ''}
              ${isChildActive && !isActive ? 'bg-gray-50' : ''}
              ${isLoading ? 'opacity-75' : ''}
            `}
            onClick={() => toggleExpanded(item.id)}
          >
            <div className="flex items-center flex-1 gap-2">
              <div className="text-gray-600 group-hover:text-blue-600 transition-colors">
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  item.icon
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-700 group-hover:text-blue-600">
                    {item.label}
                  </span>
                  {shouldShowBadge && <Badge count={pendingItemsCount} />}
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="text-gray-400 group-hover:text-blue-600 transition-colors">
                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
            )}
          </div>
        ) : (
          <Link
            href={item.href}
            onClick={() => handleNavigation(item.href, item.id)}
            className={`
              flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
              hover:bg-blue-50 hover:text-blue-600 group
              ${depth > 0 ? 'ml-4 py-1.5' : ''}
              ${isActive ? 'bg-blue-50 text-blue-600' : ''}
              ${isLoading ? 'opacity-75' : ''}
            `}
          >
            <div className="flex items-center flex-1 gap-2">
              <div className={`text-gray-600 group-hover:text-blue-600 transition-colors ${isActive ? 'text-blue-600' : ''}`}>
                {isLoading ? (
                  <Loader2 size={20} className="animate-spin" />
                ) : (
                  item.icon
                )}
              </div>
              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <span className={`text-sm font-medium text-gray-700 group-hover:text-blue-600 ${isActive ? 'text-blue-600' : ''}`}>
                    {item.label}
                  </span>
                  {shouldShowBadge && <Badge count={pendingItemsCount} />}
                </div>
              )}
            </div>
          </Link>
        )}

        {/* Children */}
        {hasChildren && accessibleChildren.length > 0 && isExpanded && !isCollapsed && (
          <div className="ml-2 mt-1 border-l-2 border-gray-100 pl-2">
            {accessibleChildren.map(child => renderNavItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`
      bg-white shadow-lg border-r border-gray-200 min-h-[88vh] max-h-[100vh] flex flex-col transition-all duration-300
      ${isCollapsed ? 'w-16' : 'w-72'}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <Brand />
            </div>
          )}

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isCollapsed ? <Menu size={20} /> : <X size={20} />}
          </button>
        </div>
      </div>

      {/* User Info */}
      {isAuthenticated && (
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-full flex items-center justify-center border-2" style={{ backgroundColor: '#3277AE', borderColor: '#3277AE' }}>
              <User className="text-white" size={20} />
            </div>
            {!isCollapsed && (
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-800">
                  {user?.name || user?.first_name + ' ' + (user?.last_name || '') || user?.email || 'User'}
                </p>
                <p className="text-xs text-gray-500 capitalize">{userRole}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <div className="space-y-1">
          {navigationItems.map((item) => renderNavItem(item))}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        {isAuthenticated && (
          <button
            onClick={handleLogout}
            disabled={logoutLoading}
            className="w-full flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed gap-2"
          >
            <LogOut size={20} />
            {!isCollapsed && (
              <span className="text-sm font-medium">
                {logoutLoading ? 'Logging out...' : t('logout')}
              </span>
            )}
          </button>
        )}
      </div>

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <style jsx>{`
          .group:hover::after {
            content: attr(data-tooltip);
            position: absolute;
            left: 100%;
            margin-left: 8px;
            background: #374151;
            color: white;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            white-space: nowrap;
            z-index: 1000;
          }
        `}</style>
      )}
    </div>
  );
}