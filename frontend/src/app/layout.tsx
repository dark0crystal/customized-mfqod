import type { Metadata } from "next";
import localFont from "next/font/local";
import { getLocale } from "next-intl/server";
import "leaflet/dist/leaflet.css";
import SplashScreenTracker from "@/components/SplashScreenTracker";

const alexandria = localFont({
  src: [
    { path: "../../public/fonts/alexandria-100.woff2", weight: "100", style: "normal" },
    { path: "../../public/fonts/alexandria-200.woff2", weight: "200", style: "normal" },
    { path: "../../public/fonts/alexandria-300.woff2", weight: "300", style: "normal" },
    { path: "../../public/fonts/alexandria-400.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/alexandria-500.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/alexandria-600.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/alexandria-700.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/alexandria-800.woff2", weight: "800", style: "normal" },
    { path: "../../public/fonts/alexandria-900.woff2", weight: "900", style: "normal" },
  ],
  fallback: ["system-ui", "arial", "sans-serif"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "مفقود | MFQOD",
  description: "مفقود - Lost and Found System",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  // Determine direction based on locale
  const direction = locale === 'ar' ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction} className={alexandria.className} suppressHydrationWarning>
      <body
        className={`${alexandria.className} antialiased ${direction === 'rtl' ? 'rtl' : 'ltr'}`}
        suppressHydrationWarning
      >
        <SplashScreenTracker />
        {children}
      </body>
    </html>
  );
}
