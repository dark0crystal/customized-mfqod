import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { routing } from "@/i18n/routing";

export const metadata: Metadata = {
  title: "مفقود | MFQOD",
  description: "مفقود - Lost and Found System",
};

/**
 * Single [locale] layout so all pages under /en/... and /ar/... receive
 * the same NextIntlClientProvider with messages and locale. This ensures
 * translations from en.json / ar.json are available in every page.
 */
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      {children}
    </NextIntlClientProvider>
  );
}
