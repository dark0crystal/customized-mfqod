/**
 * Root layout (port of the old app/layout.tsx).
 * - leaflet CSS (global, as before)
 * - <html lang/dir> and <body class="antialiased rtl|ltr"> are kept in sync by the
 *   i18n provider (src/i18n/IntlProvider.tsx) — index.html carries the 'ar' defaults
 * - Alexandria font: src/styles/fonts.css (imported in main.tsx) instead of next/font
 * - RequireAuth = the old middleware (auth + locale prefix redirects)
 */
import "leaflet/dist/leaflet.css";
import { Outlet, ScrollRestoration } from "react-router";
import SplashScreenTracker from "@/components/SplashScreenTracker";
import RequireAuth from "@/lib/RequireAuth";

export default function RootLayout() {
  return (
    <>
      {/* Default title (root metadata). Deeper layouts/pages render their own <title>, which
          React inserts before this one, so the most specific title wins — like Next metadata. */}
      <title>مفقود | MFQOD</title>
      <ScrollRestoration />
      <SplashScreenTracker />
      <RequireAuth>
        <Outlet />
      </RequireAuth>
    </>
  );
}
