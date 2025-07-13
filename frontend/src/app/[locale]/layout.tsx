import type { Metadata } from "next";
import "./globals.css";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Alexandria } from "next/font/google";
import NavBar from "@/components/navbar/Navbar";
import { PermissionsProvider } from "@/PermissionsContext";

const alexandria = Alexandria({
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "مفقود | MFQOD",
  description: "مفقود",
};

export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  // Ensure that the incoming `locale` is valid
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Get messages for the locale
  const messages = await getMessages();

  let direction = "";
  if (locale == "ar") {
    direction = "rtl";
  } else {
    direction = "ltr";
  }

  return (
    <html lang={locale} dir={direction}>
      <body className={`${alexandria.className} antialiased`}>
        <div className="absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(70,130,180,0.3),rgba(255,255,255,0))]"></div>
        <NextIntlClientProvider messages={messages}>
          <PermissionsProvider>
            <NavBar />
            {children}
          </PermissionsProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}