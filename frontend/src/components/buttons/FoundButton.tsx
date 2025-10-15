"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { tokenManager } from "@/utils/tokenManager";
import { useRouter } from "next/navigation";

export default function FoundButton() {
    const t = useTranslations("HomePage");
    const router = useRouter();

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault();
        
        // Check if user is authenticated
        if (!tokenManager.isAuthenticated()) {
            // Redirect to login page
            router.push('/auth/login');
        } else {
            // User is authenticated, proceed to report missing item
            router.push('/dashboard/report-missing-item');
        }
    };

    return (
        <button 
            onClick={handleClick}
            className="w-full md:w-[200px] bg-gradient-to-r from-white to-white border border-black p-4 rounded-xl text-black font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer"
        >
            <h1>{t("report")}</h1>
        </button>
    );
}