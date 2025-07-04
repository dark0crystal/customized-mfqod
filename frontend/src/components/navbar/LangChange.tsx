'use client'
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useLocale } from "next-intl";
// import { Inter } from "next/font/google";

// const inter = Inter({ subsets: ["latin"], weight: ["400", "700"] ,display: 'swap',});

export default function LanguageChange() {
    const pathName = usePathname();
    const locale = useLocale();

    // Remove the current locale from the pathname
    const pathWithoutLocale = pathName.replace(`/${locale}`, "");

    return (
        <div >
            {locale === "ar" ? (
                <Link className="mx-6 text-3xl font-bold" href={`/en${pathWithoutLocale}`} locale="en">
                    🇬🇧
                </Link>
            ) : (
                <Link className="mx-6 text-3xl font-bold" href={`/ar${pathWithoutLocale}`} locale="ar">
                    🇴🇲
                </Link>
            )}
        </div>
    );
}