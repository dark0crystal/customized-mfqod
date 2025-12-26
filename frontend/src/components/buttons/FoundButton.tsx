"use client";

import { useTranslations } from "next-intl";
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
            className="w-full md:w-[200px] p-4 rounded-xl font-semibold text-center hover:shadow-lg transform hover:scale-105 transition-all duration-300 cursor-pointer"
            style={{ 
                backgroundColor: 'white',
                border: '2px solid #3277AE',
                color: '#3277AE'
            }}
            onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#3277AE';
                e.currentTarget.style.color = 'white';
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'white';
                e.currentTarget.style.color = '#3277AE';
            }}
        >
            <h1>{t("report")}</h1>
        </button>
    );
}