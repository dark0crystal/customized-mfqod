"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { setHasNavigatedWithinApp } from "@/lib/splashScreenTracker";

/**
 * Tracks when user visits a non-home page.
 * When they later navigate to home via client-side routing, SplashScreen will not show.
 */
export default function SplashScreenTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    // Home is /ar or /en (locale root with always prefix)
    const isHome = pathname === "/ar" || pathname === "/en" || pathname === "/";
    if (!isHome) {
      setHasNavigatedWithinApp();
    }
  }, [pathname]);

  return null;
}
