"use client"
import Brand from "./navbar/Brand";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import LanguageChange from "./navbar/LangChange";
import { tokenManager } from "@/utils/tokenManager";
import { useRouter } from "next/navigation";
import Image from "next/image";

// Footer component
export default function Footer() {
  const t = useTranslations("footer");
  const router = useRouter();

  // Data arrays for the links
  const quickLinks = [
    { href: "/dashboard/report-missing-item", label: `${t("report")}`, requiresAuth: true },
    { href: "/search", label: `${t("search")}`, requiresAuth: false },
    { href: "/guides", label: `${t("guides")}`, requiresAuth: false },
  ];

  const privacyLinks = [
    { href: "/legal/privacy", label: `${t("privacy")}` },
    { href: "/legal/terms", label: `${t("terms")}`},
  ];

  const otherLinks = [
    { href: "/dashboard", label: `${t("dashboard")}`, requiresAuth: true },
    { href: "/auth/login", label: `${t("Register")}` },
  ];

  const handleLinkClick = (href: string, requiresAuth: boolean = false) => {
    if (requiresAuth && !tokenManager.isAuthenticated()) {
      router.push('/auth/login');
    } else {
      router.push(href);
    }
  };

  return (
    <footer className="text-gray-500 mt-24 border-t border-gray-300 bg-gray-50">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 py-12">
          {/* Brand and Language Change */}
          <div className="lg:col-span-1">
            <div className="mb-6">
              <Brand />
              <p className="text-sm text-gray-500 mt-3 leading-relaxed">
                {t("description")}
              </p>
            </div>
            <div className="mb-4">
              <LanguageChange/>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-1">
            <h3 className="text-black mb-6 font-semibold text-lg">{t("quickLinks")}</h3>
            <div className="space-y-3">
              {quickLinks.map((link, index) => (
                <div key={index}>
                  {link.requiresAuth ? (
                    <button 
                      onClick={() => handleLinkClick(link.href, link.requiresAuth)}
                      className="text-gray-500 hover:text-blue-600 transition-colors cursor-pointer text-left block"
                    >
                      {link.label}
                    </button>
                  ) : (
                    <Link 
                      href={link.href}
                      className="text-gray-500 hover:text-blue-600 transition-colors block"
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Privacy and Terms */}
          <div className="lg:col-span-1">
            <h3 className="text-black mb-6 font-semibold text-lg">{t("privacyTitle")}</h3>
            <div className="space-y-3">
              {privacyLinks.map((link, index) => (
                <div key={index}>
                  {link.label && (
                    <Link 
                      href={link.href}
                      className="text-gray-500 hover:text-blue-600 transition-colors block"
                    >
                      {link.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Other Links */}
          <div className="lg:col-span-1">
            <h3 className="text-black mb-6 font-semibold text-lg">{t("seeAlso")}</h3>
            <div className="space-y-3">
              {otherLinks.map((link, index) => (
                <div key={index}>
                  <button 
                    onClick={() => handleLinkClick(link.href, link.requiresAuth)}
                    className="text-gray-500 hover:text-blue-600 transition-colors cursor-pointer text-left block"
                  >
                    {link.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="bg-gray-200 h-[1.5px] w-full"/>

      {/* Copyright Section with DSA Logo */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          {/* DSA Logo */}
          <div className="flex-shrink-0">
            <Image
              src="/dsalogo.png"
              alt="Deanship of Student's Affairs Logo"
              width={320}
              height={160}
              className="h-36 w-auto sm:h-40 sm:w-auto lg:h-44 lg:w-auto"
              priority
            />
          </div>
          
          {/* Copyright Text */}
          <div className="text-center sm:text-right">
            <p className="text-gray-500 text-sm sm:text-base">{t("copyright")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}