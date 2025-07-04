import type { Metadata } from "next";
import "./globals.css";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Alexandria } from "next/font/google";


const alexandria = Alexandria({ 
   subsets: ["latin"],
   weight: ["100","200","300","400","500","600", "700","800","900"],
 });
 
export const metadata: Metadata = {
  title: "مفقود | MFQOD",
  description:"مفقود",
};


export default async function RootLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}>) {

    // Ensure that the incoming `locale` is valid
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }
  return (
    <html lang={locale}>
      <body
        className={`${alexandria.className} antialiased`}
      >
         <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
