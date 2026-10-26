import Footer from "@/components/Footer";
import HowMfqodWorks from "@/components/HowMfqodWorks";
import { useTranslations } from "use-intl";

export default function HowMfqodWorksPage() {
  const t = useTranslations("howMfqodWorks");
  return (
    <main className="overflow-hidden flex flex-col">
      <title>{t("sectionTitle")}</title>
      <HowMfqodWorks className="pt-12 sm:pt-16" />
      <Footer />
    </main>
  );
}
