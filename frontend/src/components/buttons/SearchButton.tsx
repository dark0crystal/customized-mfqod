"use client";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SearchButton() {
    const t = useTranslations("HomePage");

    return (
        <Link 
            href="/search" 
            className="w-full md:w-[200px] p-4 rounded-xl text-white font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer"
            style={{ backgroundColor: '#3277AE' }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2a5f94';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3277AE';
            }}
        >
            {t("search")}
        </Link>
    );
}