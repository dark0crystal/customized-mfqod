import type { Metadata } from "next";
import "./globals.css";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { Alexandria } from "next/font/google";
import NavBar from "@/components/navbar/Navbar";


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

   let direction ="";
  if(locale == "ar"){
    direction ="rtl"
  }else{
    direction ="ltr"
  }
  return (
    <html lang={locale} dir={direction}>
      <body
        className={`${alexandria.className} antialiased`}
      >
         <NextIntlClientProvider>
           <NavBar/>
          {children}
          </NextIntlClientProvider>
      </body>
    </html>
  );
}
