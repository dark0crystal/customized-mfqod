"use client";

import React, { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import SideNavbar from "./SideNavbar";
import Brand from "@/components/navbar/Brand";
import { usePermissions } from '@/PermissionsContext';

interface DashboardShellProps {
  children: React.ReactNode;
  initialDirection?: 'ltr' | 'rtl';
}

export default function DashboardShell({ children, initialDirection }: DashboardShellProps) {
  const { permissions, userRole, roleId, isAuthenticated, isLoading: permissionsLoading } = usePermissions();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Use initialDirection directly - no state or syncing needed
  const resolvedDirection = initialDirection || 'ltr';
  const effectiveIsRTL = resolvedDirection === "rtl";

  // Log when DashboardShell mounts
  useEffect(() => {
    console.log('[DASHBOARD_SHELL] Component mounted');
    console.log('[DASHBOARD_SHELL] Initial direction:', initialDirection);
    console.log('[DASHBOARD_SHELL] Resolved direction:', resolvedDirection);
    console.log('[DASHBOARD_SHELL] Is RTL:', effectiveIsRTL);
    console.log('[DASHBOARD_SHELL] Permissions loading:', permissionsLoading);
    console.log('[DASHBOARD_SHELL] Is authenticated:', isAuthenticated);
    console.log('[DASHBOARD_SHELL] User role:', userRole);
    console.log('[DASHBOARD_SHELL] Role ID:', roleId);
    console.log('[DASHBOARD_SHELL] Permissions count:', permissions.length);
  }, [initialDirection, resolvedDirection, effectiveIsRTL, permissionsLoading, isAuthenticated, userRole, roleId, permissions.length]);



  const toggleMobile = () => setIsMobileOpen((prev) => !prev);
  const closeMobile = () => setIsMobileOpen(false);

  const sidebarPositionClass = effectiveIsRTL ? "right-0" : "left-0";
  const sidebarTranslateClosed = effectiveIsRTL ? "translate-x-full" : "-translate-x-full";
  const topbarDirectionClass = effectiveIsRTL ? "flex-row-reverse" : "flex-row";

  return (
    <div className={`flex h-screen overflow-hidden bg-gray-50 ${resolvedDirection}`} dir={resolvedDirection}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <SideNavbar className="h-full" />
      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div
          className={`lg:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm ${topbarDirectionClass} ${resolvedDirection}`}
          dir={resolvedDirection}
        >
          <button
            onClick={toggleMobile}
            aria-label="Toggle sidebar"
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="flex items-center">
            <Brand />
          </div>

          {/* spacer for symmetry */}
          <div className="w-6" />
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-6">{children}</main>
      </div>

      {/* Mobile sidebar & backdrop */}
      <div className="lg:hidden">
        <div
          onClick={closeMobile}
          className={`fixed inset-0 z-30 bg-black/40 transition-opacity duration-200 ${isMobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            }`}
        />

        <div
          className={`fixed top-0 bottom-0 z-40 w-72 max-w-[80vw] bg-white shadow-lg border border-gray-200 transition-transform duration-300 transform-gpu ${sidebarPositionClass} ${isMobileOpen ? "translate-x-0 opacity-100" : `${sidebarTranslateClosed} opacity-0 pointer-events-none`
            }`}
          aria-hidden={!isMobileOpen}
        >
          <SideNavbar className="h-full" onClose={closeMobile} showCollapseToggle={false} />
        </div>
      </div>
    </div>
  );
}

