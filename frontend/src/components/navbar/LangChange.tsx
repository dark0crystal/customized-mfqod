'use client'
import { usePathname } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { useLocale } from "next-intl";

export default function LanguageChange() {
    const pathName = usePathname();
    const locale = useLocale();

    // Locale segments should be at pathname start as /en/..., /ar/...
    // Remove leading locale from pathname (handles if not at root, or if missing)
    function stripLocale(path: string, locale: string) {
        if (path === `/${locale}`) return "";
        if (path.startsWith(`/${locale}/`)) return path.slice(locale.length + 1);
        return path;
    }

    const pathWithoutLocale = stripLocale(pathName, locale);

    // Build proper href for switch, always include "/" before path if needed
    function switchHref(path: string) {
        // Home: path is empty string
        if (!path || path === "/") return "/";
        // If path already starts with "/", just use path
        return path.startsWith("/") ? path : `/${path}`;
    }

    return (
        <div className="flex items-center">
            {locale === "ar" ? (
                <Link 
                    className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-100" 
                    href={switchHref(pathWithoutLocale)}
                    locale="en"
                    prefetch={false}
                >
                    English
                </Link>
            ) : (
                <Link 
                    className="px-3 py-1 text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors rounded-md hover:bg-gray-100" 
                    href={switchHref(pathWithoutLocale)}
                    locale="ar"
                    prefetch={false}
                >
                    العربية
                </Link>
            )}
        </div>
    );
}