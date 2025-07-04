"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SearchButton() {
    const t =  useTranslations("HomePage");

  return (
    <Link href="/search" className="w-full md:w-[200px]  bg-gradient-to-r from-[#2196f3] to-[#2f7ce1] p-4 rounded-xl text-white font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer">
          {t("search")}
    </Link>
  );
}