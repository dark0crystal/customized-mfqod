import type { Metadata } from "next";
import { Alexandria } from "next/font/google";
import { getLocale } from "next-intl/server";
import "leaflet/dist/leaflet.css";

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
        {children}
      </body>
    </html>
  );
}
