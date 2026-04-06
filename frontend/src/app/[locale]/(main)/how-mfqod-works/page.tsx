import Footer from "@/components/Footer";
import HowMfqodWorks from "@/components/HowMfqodWorks";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "howMfqodWorks" });
  return {
    title: t("sectionTitle"),
    description: t("pageMetaDescription"),
  };
}

export default function HowMfqodWorksPage() {
  return (
    <main className="overflow-hidden flex flex-col">
      <HowMfqodWorks className="pt-12 sm:pt-16" />
      <Footer />
    </main>
  );
}
