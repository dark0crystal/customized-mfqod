// app/admin/layout.tsx
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import "./globals.css"
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { PermissionsProvider } from "@/PermissionsContext";
import DashboardShell from "./DashboardShell";

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
  const initialDirection = locale === 'ar' ? 'rtl' : 'ltr';

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return (
    <PermissionsProvider>
      <DashboardShell initialDirection={initialDirection}>
        {children}
      </DashboardShell>
    </PermissionsProvider>
  );
}