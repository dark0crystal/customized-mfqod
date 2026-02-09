import type { Metadata } from "next";
import { Alexandria } from "next/font/google";
import { headers } from "next/headers";
import "leaflet/dist/leaflet.css";
import SplashScreenTracker from "@/components/SplashScreenTracker";
import { routing } from "@/i18n/routing";

/** Get locale from request. Uses next-intl middleware header (x-next-intl-locale) per docs. */
async function getLocale(): Promise<string> {
  const h = await headers();
  const locale = h.get("x-next-intl-locale");
  return locale && routing.locales.includes(locale as "en" | "ar") ? locale : routing.defaultLocale;
}

const alexandria = Alexandria({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  fallback: ["system-ui", "arial", "sans-serif"],
  display: "swap",
  adjustFontFallback: true,
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
