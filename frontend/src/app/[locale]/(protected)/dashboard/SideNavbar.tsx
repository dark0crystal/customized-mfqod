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
  ArrowRightLeft,
  ClipboardList,
  FileSearch,
  HelpCircle
} from 'lucide-react';
import Brand from '@/components/navbar/Brand';
import { Link } from '@/i18n/navigation';
import { usePathname, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/hooks/useAuth';

// Helper to get user from cookies
interface SidebarUser {
  id?: string;
  name?: string;
  first_name?: string;
  middle_name?: string | null;
  last_name?: string;
  email?: string;
  role?: string;
  role_id?: string | number | null;
}

const getUserFromCookies = (): SidebarUser | null => {
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
  requireAllPermissions?: boolean; // If true, requires ALL permissions; if false, requires ANY permission
  requiredRole?: string;
  allowedRoles?: string[];
  children?: NavItem[];
  showBadge?: boolean; // Whether to show pending items badge
}

interface SideNavbarProps {
  className?: string;
  onClose?: () => void;
  showCollapseToggle?: boolean;
  pendingItemsCount?: number;
  pendingMissingItemsCount?: number;
  pendingTransferRequestsCount?: number;
}

export default function SideNavbar({
  className = '',
  onClose,
  showCollapseToggle = true,
  pendingItemsCount = 0,
  pendingMissingItemsCount = 0,
  pendingTransferRequestsCount = 0,
}: SideNavbarProps) {

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [loadingLinks, setLoadingLinks] = useState<Set<string>>(new Set());
  const [user, setUser] = useState<SidebarUser | null>(null);
  const { userRole, hasAnyPermission, hasAllPermissions, isAuthenticated, permissions, isLoading: permissionsLoading, roleId } = usePermissions();
  const { logout, isLoading: logoutLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('dashboard.sideNavbar');

  
  const API_BASE_URL = process.env.NEXT_PUBLIC_HOST_NAME || "http://localhost:8000";

  // Fetch fresh user data on mount and when pathname changes
  useEffect(() => {
    const fetchUser = async () => {
      try {
        // Get token from cookies
        const getTokenFromCookies = (): string | null => {
          if (typeof document === "undefined") return null;
          const cookies = document.cookie.split(';');
          for (const cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'token') {

              return decodeURIComponent(value);
            }
          }
          return null;
        };

        const token = getTokenFromCookies();
        if (!token) {
          // Fallback to cookie user if no token
          setUser(getUserFromCookies());
          return;
        }

        // Fetch fresh user data from API
        const res = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          },
        });

        if (res.ok) {
          const data = await res.json();
          // Build full name from components if name is missing
          if (!data.name && (data.first_name || data.last_name)) {
            const nameParts = [data.first_name, data.middle_name, data.last_name].filter(Boolean);
            data.name = nameParts.join(' ').trim();
          }
          setUser(data);
          // Update cookie with fresh data
          if (typeof document !== 'undefined') {
            const userCookie = `user=${encodeURIComponent(JSON.stringify(data))}; path=/; max-age=${7 * 24 * 60 * 60}`;
            document.cookie = userCookie;
          }
        } else {
          // Fallback to cookie user if API fails
          setUser(getUserFromCookies());
        }
      } catch (error) {
        console.error('Error fetching user for sidebar:', error);
        // Fallback to cookie user on error
        setUser(getUserFromCookies());
      }
    };

    if (isAuthenticated) {
      fetchUser();
    }
  }, [isAuthenticated, pathname]);

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
    if (pathname === href) {
      onClose?.();
      return; // Don't navigate if already on the page
    }

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

    onClose?.();
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
      label: t('items'),
      icon: <Package size={20} />,
      href: '/dashboard/items',
      requiredPermissions: ['can_manage_items'],
      showBadge: true
    },
    {
      id: 'missing-items',
      label: t('missingItems'),
      icon: <FileText size={20} />,
      href: '/dashboard/missing-items',
      requiredPermissions: [],
      showBadge: true
    },
    {
      id: 'items-management',
      label: t('itemsManagement'),
      icon: <Package size={20} />,
      href: '/dashboard/items',
      requiredPermissions: ['can_manage_items'],
      children: [
        {
          id: 'report-found-item',
          label: t('reportFoundItem'),
          icon: <PlusCircle size={16} />,
          href: '/dashboard/report-found-item',
          requiredPermissions: ['can_manage_items']
        },
        {
          id: 'report-missing-item',
          label: t('reportMissingItem'),
          icon: <FileText size={16} />,
          href: '/dashboard/report-missing-item',
          requiredPermissions: []
        }

      ]
    },
    {
      id: 'claims',
      label: t('claims'),
      icon: <ClipboardList size={20} />,
      href: '/dashboard/claims',
      requiredPermissions: ['can_manage_claims']
    },
    {
      id: 'admin',
      label: t('adminPanel'),
      icon: <Shield size={20} />,
      href: '/admin',
      requiredPermissions: ['can_manage_permissions', 'can_manage_users', 'can_manage_branches', 'can_manage_item_types'],
      requireAllPermissions: true, // Admin panel requires ALL of these permissions
      children: [
        {
          id: 'manage-branches',
          label: t('manageBranches'),
          icon: <Building2 size={16} />,
          href: '/dashboard/branch',
          requiredPermissions: ['can_manage_branches']
        },
        {
          id: 'item-types',
          label: t('itemTypes'),
          icon: <Tags size={16} />,
          href: '/dashboard/item-types',
          requiredPermissions: ['can_manage_item_types']
        },
        {
          id: 'manage-users',
          label: t('manageUsers'),
          icon: <UserCheck size={16} />,
          href: '/dashboard/manage-users',
          requiredPermissions: ['can_manage_users']
        },
        {
          id: 'manage-permissions',
          label: t('managePermissions'),
          icon: <Key size={16} />,
          href: '/dashboard/permissions',
          requiredPermissions: ['can_manage_permissions']
        }
      ]
    },
    {
      id: 'transfer-requests',
      label: t('transferRequests'),
      icon: <ArrowRightLeft size={20} />,
      href: '/dashboard/transfer-requests',
      requiredPermissions: ['can_manage_transfer_requests'],
      showBadge: true
    },
    {
      id: 'audit-logs',
      label: t('auditLogs'),
      icon: <FileSearch size={20} />,
      href: '/dashboard/audit-logs',
      requiredPermissions: ['can_view_audit_logs']
    },
    {
      id: 'analytics',
      label: t('analytics'),
      icon: <TrendingUp size={20} />,
      href: '/dashboard/analytics',
      requiredPermissions: ['can_view_analytics']
    },
    {
      id: 'help',
      label: t('help'),
      icon: <HelpCircle size={20} />,
      href: '/dashboard/help',
      requiredPermissions: ['can_manage_items']
    }
  ];

  // Check if user can access a nav item
  const canAccessItem = (item: NavItem): boolean => {
    if (permissionsLoading) {

      return false;
    }

    if (!isAuthenticated && item.href !== '/auth/login') {

      return false;
    }

    // Check permission requirements
    if (item.requiredPermissions && item.requiredPermissions.length > 0) {
      const hasPermission = item.requireAllPermissions 
        ? hasAllPermissions(item.requiredPermissions)
        : hasAnyPermission(item.requiredPermissions);
      if (!hasPermission) {

        return false;
      }
    }

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
    if (count === 0) return null;
    
    return (
      <span className="ml-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-pink-100 text-red-800 text-xs font-semibold">
        {count > 99 ? '99+' : count}
      </span>
    );
  };

  // Yellow badge component for transfer requests
  const TransferRequestBadge = ({ count }: { count: number }) => {
    // Validate count: must be a positive number
    const validCount = typeof count === 'number' && count > 0 ? count : 0;
    
    if (validCount === 0) {
      return null;
    }
    
    return (
      <span className="ml-2 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-yellow-100 text-yellow-800 text-xs font-semibold border border-yellow-200">
        {validCount > 99 ? '99+' : validCount}
      </span>
    );
  };

  // Render navigation item
  const renderNavItem = (item: NavItem, depth: number = 0) => {
    const hasChildren = item.children && item.children.length > 0;
    const accessibleChildren = item.children?.filter(child => canAccessItem(child)) || [];
    
    // For items with children: show parent if ANY child is accessible OR parent has permission
    // For items without children: show only if parent has permission
    if (hasChildren) {
      // Parent with children: show if at least one child is accessible OR parent has permission
      if (accessibleChildren.length === 0 && !canAccessItem(item)) {
        return null;
      }
    } else {
      // Parent without children: show only if parent has permission
      if (!canAccessItem(item)) {
        return null;
      }
    }

    const isExpanded = expandedItems.includes(item.id);
    const isActive = pathname === item.href;
    const isChildActive = item.children?.some(child => pathname === child.href);
    const isLoading = loadingLinks.has(item.id);
    // Use pendingMissingItemsCount for missing-items, pendingItemsCount for Items
    const badgeCount = item.id === 'missing-items' ? pendingMissingItemsCount : pendingItemsCount;
    const shouldShowBadge = item.showBadge && badgeCount > 0 && item.id !== 'transfer-requests';
    // Validate transfer requests count: must be a number > 0
    const transferCount = typeof pendingTransferRequestsCount === 'number' ? pendingTransferRequestsCount : 0;
    const shouldShowTransferBadge = item.showBadge && transferCount > 0 && item.id === 'transfer-requests';
    

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
                  {shouldShowBadge && <Badge count={badgeCount} />}
                  {shouldShowTransferBadge && <TransferRequestBadge count={transferCount} />}
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
                  {shouldShowBadge && <Badge count={badgeCount} />}
                  {shouldShowTransferBadge && <TransferRequestBadge count={transferCount} />}
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
      ${className}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <Brand />
            </div>
          )}

          {showCollapseToggle && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              {isCollapsed ? <Menu size={20} /> : <X size={20} />}
            </button>
          )}
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
                  {user?.name || 
                   (user?.first_name && user?.last_name 
                     ? `${user.first_name} ${user.middle_name || ''} ${user.last_name}`.trim()
                     : user?.first_name || user?.email || 'User')}
                </p>
                <p className="text-xs text-gray-500 capitalize">{userRole}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto" data-tour="sidebar-navigation">
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