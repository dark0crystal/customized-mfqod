// app/admin/layout.tsx
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import "./globals.css"
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import SideNavbar from "./SideNavbar";
import { PermissionsProvider } from "@/PermissionsContext";

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

  return (
    <PermissionsProvider>
      <div className="flex h-screen overflow-hidden bg-gray-50">
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
  );
}