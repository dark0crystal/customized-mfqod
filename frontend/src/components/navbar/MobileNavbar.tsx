"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, useEffect } from "react";
import Brand from "./Brand";
import { RxHamburgerMenu } from "react-icons/rx";
import { IoClose } from "react-icons/io5";
// import Profile from "./Profile";

export default function MobileNavbar() {
  const t = useTranslations("navbar");
  const [show, setShow] = useState(false);

  // Toggle Navbar and Body Scroll
  const toggleNavbar = () => {
    setShow((prev) => !prev);
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
          className={`absolute top-[12vh] left-0 w-full h-screen bg-white z-50 flex flex-col  space-y-6 p-6`}
        >
          <Link href="/search" onClick={toggleNavbar}>
            <h1 className="text-2xl font-normal text-gray-700 hover:text-blue-600">
              {t("search")}
            </h1>
          </Link>

          <Link href="/report-found-item" onClick={toggleNavbar}>
            <h1 className="text-2xl font-normal text-gray-700 hover:text-blue-600">
              {t("report")}
            </h1>
          </Link>

          {/* <Profile/> */}
        </div>
      )}

    </nav>
  );
}