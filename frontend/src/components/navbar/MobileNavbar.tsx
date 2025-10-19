"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Brand from "./Brand";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
import { tokenManager } from "@/utils/tokenManager";
import { useRouter } from "next/navigation";
import LanguageChange from "./LangChange";
import UserProfile from "./UserProfile";

export default function MobileNavbar() {
  const t = useTranslations("navbar");
  const [show, setShow] = useState(false);
  const router = useRouter();

  // Toggle Navbar and Body Scroll
  const toggleNavbar = () => {
    setShow((prev) => !prev);
  };

  const handleReportClick = () => {
    if (!tokenManager.isAuthenticated()) {
      router.push('/auth/login');
    } else {
      router.push('/dashboard/report-missing-item');
    }
    toggleNavbar();
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
          className={`absolute top-[12vh] left-0 w-full h-screen bg-white z-50 flex flex-col space-y-8 py-8 px-6`}
        >
          {/* Main Navigation Links */}
          <div className="space-y-6 my-4">
            <Link href="/search" onClick={toggleNavbar}>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-normal text-gray-700 hover:text-blue-600 transition-colors py-2">
                {t("search")}
              </h1>
            </Link>

            <Link href="/branches-info" onClick={toggleNavbar}>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-normal text-gray-700 hover:text-blue-600 transition-colors py-2">
                {t("branchesInfo")}
              </h1>
            </Link>

            <button onClick={handleReportClick}>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-normal text-gray-700 hover:text-blue-600 transition-colors py-2">
                {t("report")}
              </h1>
            </button>
          </div>

          {/* Divider */}
          <div className="border-t border-gray-200 my-8"></div>

          {/* User Authentication & Language */}
          <div className="space-y-6 my-4">
            <div className="flex items-center justify-between gap-4 py-2">
              <span className="text-base sm:text-lg md:text-xl font-medium text-gray-600">Language / اللغة</span>
              <LanguageChange />
            </div>
            
            <div className="flex items-center justify-center py-2">
              <UserProfile />
            </div>
          </div>
        </div>
      )}

    </nav>
  );
}