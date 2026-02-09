"use client";

import { useState, useEffect } from "react";
import { Lalezar } from "next/font/google";
import { getHasNavigatedWithinApp } from "@/lib/splashScreenTracker";

const lalezarFont = Lalezar({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial", "sans-serif"],
  adjustFontFallback: true,
});

export default function SplashScreen() {
  // Only show splash on full page load (reload/direct visit), not when navigating from other pages
  const [isVisible, setIsVisible] = useState(() => !getHasNavigatedWithinApp());

  useEffect(() => {
    // Skip timer if we arrived via client-side nav (initial state already set isVisible=false)
    if (getHasNavigatedWithinApp()) return;

    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white">
        <div className={`text-center text-6xl sm:text-7xl md:text-8xl ${lalezarFont.className}`}>
          <p className="relative z-20 text-slate-800">
            مفقود
            <span className="absolute -z-10 left-0 top-0 light-turn-on" style={{ color: '#3277AE' }}>
              مَفقوُد
            </span>
          </p>
        </div>
        <p className="absolute bottom-8 left-1/2 transform -translate-x-1/2 text-gray-500 text-xs sm:text-sm text-center z-10">
          المرداس البوسعيدي X عمادة شؤون الطلبة
        </p>
      </div>
      <style jsx>{`
        @keyframes lightTurnOn {
          0% {
            opacity: 0.1;
            filter: brightness(0.2);
          }
          20% {
            opacity: 0.3;
            filter: brightness(0.5);
          }
          40% {
            opacity: 1;
            filter: brightness(1.5);
          }
          50% {
            opacity: 0.8;
            filter: brightness(1.2);
          }
          60% {
            opacity: 1;
            filter: brightness(1.5);
          }
          70% {
            opacity: 0.9;
            filter: brightness(1.3);
          }
          100% {
            opacity: 1;
            filter: brightness(1);
          }
        }
        
        .light-turn-on {
          animation: lightTurnOn 2.5s ease-out forwards;
        }
      `}</style>
    </>
  );
}
