'use client'
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export default function LanguageChange() {
    const pathname = usePathname(); // Returns pathname without locale
    const locale = useLocale();

    const handleLocaleChange = (e: React.MouseEvent<HTMLAnchorElement>, newLocale: 'en' | 'ar') => {
        e.preventDefault();
        // Construct URL with new locale and force full page reload
        const newPath = `/${newLocale}${pathname === '/' ? '' : pathname}`;
        window.location.href = newPath;
    };

    return (
        <div className="flex items-center">
            {locale === "ar" ? (
                <Link 
                    href={pathname}
                    locale="en"
                    onClick={(e) => handleLocaleChange(e, 'en')}
                    className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-100"
                >
                    English
                </Link>
            ) : (
                <Link 
                    href={pathname}
                    locale="ar"
                    onClick={(e) => handleLocaleChange(e, 'ar')}
                    className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-100"
                >
                    العربية
                </Link>
            )}
        </div>
    );
}