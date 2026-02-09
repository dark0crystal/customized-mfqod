import type { Metadata } from "next";
import "./globals.css";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { notFound } from "next/navigation";
import NavBar from "@/components/navbar/Navbar";

export const metadata: Metadata = {
  title: "مفقود | MFQOD",
  description: "مفقود",
};

export default async function MainLayout({
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
    <>
      <div className="absolute top-0 z-[-2] h-screen w-screen bg-white bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(70,130,180,0.3),rgba(255,255,255,0))]"></div>
      <NavBar />
      {children}
    </>
  );
}