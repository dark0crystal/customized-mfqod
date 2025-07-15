// app/admin/layout.tsx
import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import "./globals.css"
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import SideNavbar from "./SideNavbar";
import { Alexandria } from "next/font/google";
import { PermissionsProvider } from "@/PermissionsContext";


const alexandria = Alexandria({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});


export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Admin dashboard layout",
};

export default async function AdminLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  let direction = "";
  if (locale == "ar") {
    direction = "rtl";
  } else {
    direction = "ltr";
  }

  return (
    <html lang={locale} dir={direction}>
      <body className={`${alexandria.variable}  antialiased bg-gray-50`}>
        <NextIntlClientProvider>
          <PermissionsProvider>
          <div className="flex h-screen overflow-hidden">
            {/* Sidebar */}
            <SideNavbar/>

            {/* Content Area */}
            <div className="flex flex-col flex-1 overflow-y-auto">
              {/* Topbar */}
              {/* <AdminTopbar /> */}

              {/* Page Content */}
              <main className="p-6">{children}</main>
            </div>
          </div>
          </PermissionsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}