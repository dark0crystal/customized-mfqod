// app/admin/layout.tsx
import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import "./globals.css"
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
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

  // Load messages for this locale
  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>
      <PermissionsProvider>
        <DashboardShell initialDirection={initialDirection}>
          {children}
        </DashboardShell>
      </PermissionsProvider>
    </NextIntlClientProvider>
  );
}