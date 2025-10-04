"use client"
import React, { useState } from 'react';
import { 
  Home, 
  Users, 
  Settings, 
  BarChart3, 
  FileText, 
  Shield, 
  PlusCircle, 
  Edit3, 
  Eye,
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
  Tags
} from 'lucide-react';
import Brand from '@/components/navbar/Brand';
import { Link } from '@/i18n/navigation';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';

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

// Mock permissions hook - replace with your actual hook
const usePermissions = () => {
  // This is a mock - replace with your actual permissions context
  const [userRole] = useState('admin'); // Change to test different roles
  const [permissions] = useState(['admin', 'create_post', 'edit_post', 'view_analytics', 'can_create_item_types']);
  const [isAuthenticated] = useState(true);
  const [user] = useState(getUserFromCookies());
  
  const hasPermission = (permission: string) => permissions.includes(permission);
  const hasAnyPermission = (perms: string[]) => perms.some(p => permissions.includes(p));
  
  return {
    userRole,
    permissions,
    isAuthenticated,
    hasPermission,
    hasAnyPermission,
    user
  };
};

// Navigation item interface
interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  requiredPermissions?: string[];
  requiredRole?: string;
  allowedRoles?: string[];
  children?: NavItem[];
}

export default function SideNavbar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const { userRole, hasPermission, hasAnyPermission, isAuthenticated, user } = usePermissions();
  const pathname = usePathname();
  const t = useTranslations('dashboard.sideNavbar');

  // Navigation configuration
  const navigationItems: NavItem[] = [
    {
      id: 'dashboard',
      label: t('dashboard'),
      icon: <Home size={20} />,
      href: '/dashboard',
    },
    {
      id: 'manage-branches',
      label: t('manageBranches'),
      icon: <Building2 size={20} />,
      href: '/dashboard/branch',
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
        requiredPermissions: ['create_post', 'edit_post']
        },
        {
          id: 'report-found-item',
          label: t('reportFoundItem'),
          icon: <PlusCircle size={16} />,
          href: '/dashboard/report-found-item',
          requiredPermissions: ['create_post']
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
      requiredRole: 'admin',
      children: [
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
          requiredPermissions: ['admin']
        },
        {
          id: 'manage-permissions',
          label: t('managePermissions'),
          icon: <Key size={16} />,
          href: '/dashboard/permissions',
          requiredPermissions: ['admin']
        }
      ]
    },
    {
      id: 'settings',
      label: t('settings'),
      icon: <Settings size={20} />,
      href: '/dashboard/settings'
    }
  ];

  // Check if user can access a nav item
  const canAccessItem = (item: NavItem): boolean => {
    if (!isAuthenticated && item.href !== '/login') {
      return false;
    }

    // Check role requirements
    if (item.requiredRole && userRole !== item.requiredRole) {
      return false;
    }

    if (item.allowedRoles && !item.allowedRoles.includes(userRole)) {
      return false;
    }

    // Check permission requirements
    if (item.requiredPermissions) {
      if (!hasAnyPermission(item.requiredPermissions)) {
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
            `}
            onClick={() => toggleExpanded(item.id)}
          >
            <div className="flex items-center flex-1">
              <div className="text-gray-600 group-hover:text-blue-600 transition-colors">
                {item.icon}
              </div>
              {!isCollapsed && (
                <span className="ml-3 text-sm font-medium text-gray-700 group-hover:text-blue-600">
                  {item.label}
                </span>
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
            className={`
              flex items-center px-3 py-2 rounded-lg cursor-pointer transition-all duration-200
              hover:bg-blue-50 hover:text-blue-600 group
              ${depth > 0 ? 'ml-4 py-1.5' : ''}
              ${isActive ? 'bg-blue-50 text-blue-600' : ''}
            `}
          >
            <div className="flex items-center flex-1">
              <div className={`text-gray-600 group-hover:text-blue-600 transition-colors ${isActive ? 'text-blue-600' : ''}`}>
                {item.icon}
              </div>
              {!isCollapsed && (
                <span className={`ml-3 text-sm font-medium text-gray-700 group-hover:text-blue-600 ${isActive ? 'text-blue-600' : ''}`}>
                  {item.label}
                </span>
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
      ${isCollapsed ? 'w-16' : 'w-64'}
    `}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          {!isCollapsed && (
            <div className="flex items-center space-x-2">
              <Brand/>
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
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
              <User className="text-gray-600" size={20} />
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
            onClick={() => {
              // Handle logout
              console.log('Logging out...');
            }}
            className="w-full flex items-center px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut size={20} />
            {!isCollapsed && <span className="ml-3 text-sm font-medium">{t('logout')}</span>}
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