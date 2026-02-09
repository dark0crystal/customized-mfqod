"use client";

import React, { useState } from "react";
import { Menu, X } from "lucide-react";
import SideNavbar from "./SideNavbar";
import Brand from "@/components/navbar/Brand";
import { usePendingItemsCount } from "@/hooks/usePendingItemsCount";
import { usePendingMissingItemsCount } from "@/hooks/usePendingMissingItemsCount";
import { usePendingTransferRequestsCount } from "@/hooks/usePendingTransferRequestsCount";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Fetch badge counts once at shell level and share with both sidebars (avoids duplicate requests)
  const { count: pendingItemsCount } = usePendingItemsCount();
  const { count: pendingMissingItemsCount } = usePendingMissingItemsCount();
  const { count: pendingTransferRequestsCount } = usePendingTransferRequestsCount();


  // CSS-based logic relies on html[dir] attribute set by RootLayout
  const sidebarPositionClass = "start-0";

  // Using explicit attribute selectors for robustness if tailwind rtl variant isn't configured
  const sidebarTranslateClosed = "ltr:-translate-x-full rtl:translate-x-full [dir=ltr]:-translate-x-full [dir=rtl]:translate-x-full";

  // Use flex-row-reverse to position Menu on the opposite side of Start (Left in AR, Right in EN)
  const topbarDirectionClass = "flex-row-reverse";

  const toggleMobile = () => setIsMobileOpen((prev) => !prev);
  const closeMobile = () => setIsMobileOpen(false);

  return (
    <div className={`flex h-screen overflow-hidden bg-gray-50`}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full">
        <SideNavbar
          className="h-full"
          pendingItemsCount={pendingItemsCount}
          pendingMissingItemsCount={pendingMissingItemsCount}
          pendingTransferRequestsCount={pendingTransferRequestsCount}
        />

      </div>

      {/* Main content */}
      <div className="flex flex-col flex-1 overflow-y-auto">
        <div
          className={`lg:hidden sticky top-0 z-30 flex items-center justify-between bg-white border-b border-gray-200 px-4 py-3 shadow-sm ${topbarDirectionClass}`}
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
          <SideNavbar
            className="h-full"
            onClose={closeMobile}
            showCollapseToggle={false}
            pendingItemsCount={pendingItemsCount}
            pendingMissingItemsCount={pendingMissingItemsCount}
            pendingTransferRequestsCount={pendingTransferRequestsCount}
          />

        </div>
      </div>
    </div>
  );
}

