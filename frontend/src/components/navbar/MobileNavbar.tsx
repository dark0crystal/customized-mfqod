"use client";

import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Brand from "./Brand";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import { Search, MapPinned, FileQuestion, LayoutDashboard, LogOut, UserCircle2 } from "lucide-react";
import { tokenManager } from "@/utils/tokenManager";
import { useRouter } from "next/navigation";
import LanguageChange from "./LangChange";
import { useAuth } from "@/hooks/useAuth";

export default function MobileNavbar() {
  const t = useTranslations("navbar");
  const [show, setShow] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const router = useRouter();
  const { isAuthenticated, logout, user } = useAuth();

  // Toggle Navbar and Body Scroll
  const toggleNavbar = () => {
    setShow((prev) => {
      const next = !prev;
      if (!next) setProfileOpen(false);
      return next;
    });
  };

  const handleReportClick = () => {
    if (!tokenManager.isAuthenticated()) {
      router.push('/auth/login');
    } else {
      router.push('/dashboard/report-missing-item');
    }
    toggleNavbar();
  };

  const handleSearchClick = () => {
    router.push("/search");
    toggleNavbar();
  };

  const handleBranchesClick = () => {
    router.push("/branches-info");
    toggleNavbar();
  };

  const handleDashboardClick = () => {
    router.push("/dashboard");
    setProfileOpen(false);
    toggleNavbar();
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setProfileOpen(false);
      toggleNavbar();
    }
  };

  // Prevent body scroll when the navbar is open
  useEffect(() => {
    if (show) {
      document.body.style.overflow = "hidden"; // Disable scrolling
    } else {
      document.body.style.overflow = ""; // Reset scrolling
    }
    return () => {
      document.body.style.overflow = ""; // Clean up on unmount
    };
  }, [show]);

  return (
    <nav className={`flex items-center justify-between h-[12vh] max-h-[12vh] px-4 lg:hidden relative ${show && "bg-white"}`}>
      {/* Brand Logo */}
      <Brand />

      {/* Toggle Button */}
      <button
        onClick={toggleNavbar}
        className="text-gray-700 focus:outline-none"
        aria-label="Toggle navigation menu"
      >
        {show ? <IoClose size={30} /> : <RxHamburgerMenu size={30} />}
      </button>

      {/* Dropdown Menu */}
      {show && (
        <div
          className="absolute top-[12vh] left-0 w-full min-h-screen bg-white z-50 flex flex-col py-6 px-6 space-y-6"
        >
          {/* Main Navigation Links */}
          <div className="space-y-3">
            <button
              onClick={handleSearchClick}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-gray-50 hover:bg-blue-50 text-gray-800 text-lg sm:text-xl font-semibold transition-colors"
            >
              <Search size={22} className="text-gray-600" />
              <span>{t("search")}</span>
            </button>

            <button
              onClick={handleBranchesClick}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-gray-50 hover:bg-blue-50 text-gray-800 text-lg sm:text-xl font-semibold transition-colors"
            >
              <MapPinned size={22} className="text-gray-600" />
              <span>{t("branchesInfo")}</span>
            </button>

            <button
              onClick={handleReportClick}
              className="w-full flex items-center gap-3 rounded-xl px-3 py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-lg sm:text-xl font-semibold transition-colors"
            >
              <FileQuestion size={22} className="text-blue-700" />
              <span>{t("report")}</span>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-4" />

          {/* Language */}
          <div className="flex items-center justify-between gap-4 py-2">
            <span className="text-base sm:text-lg font-semibold text-gray-700">Language / اللغة</span>
            <LanguageChange />
          </div>

          {/* Profile */}
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setProfileOpen((prev) => !prev)}
              className="w-full flex items-center justify-between rounded-xl px-3 py-3 bg-gray-50 hover:bg-blue-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <UserCircle2 size={26} className="text-blue-700" />
                <div className="flex flex-col items-start">
                  <span className="text-base sm:text-lg font-semibold text-gray-800">
                    {isAuthenticated ? (user?.first_name || t("user")) : t("login")}
                  </span>
                  {isAuthenticated && (
                    <span className="text-sm text-gray-500 truncate max-w-[180px]">
                      {user?.email}
                    </span>
                  )}
                </div>
              </div>
              <span className="text-gray-500 text-lg">{profileOpen ? "▴" : "▾"}</span>
            </button>

            {profileOpen && isAuthenticated && (
              <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                <button
                  onClick={handleDashboardClick}
                  className="w-full flex items-center gap-3 px-4 py-3 text-base sm:text-lg text-gray-800 hover:bg-blue-50 transition-colors"
                >
                  <LayoutDashboard size={20} className="text-gray-600" />
                  <span>{t("dashboard")}</span>
                </button>
                <div className="h-px bg-gray-100" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-base sm:text-lg text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} className="text-red-600" />
                  <span>{t("logout")}</span>
                </button>
              </div>
            )}

            {!isAuthenticated && (
              <button
                onClick={() => {
                  router.push("/auth/login");
                  toggleNavbar();
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white text-base sm:text-lg font-semibold transition-colors"
                style={{ backgroundColor: '#3277AE' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#2563eb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#3277AE';
                }}
              >
                <LogOut size={20} className="text-white rotate-180" />
                <span>{t("login")}</span>
              </button>
            )}
          </div>
        </div>
      )}

    </nav>
  );
}