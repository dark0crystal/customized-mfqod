"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function FoundButton() {
const t  = useTranslations("HomePage")

  return (
    <Link href="/report-found-item" className=" w-full md:w-[200px] bg-gradient-to-r from-white to-white border border-black p-4 rounded-xl text-black font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
          <h1>{t("report")}</h1>
    </Link>
  );
}