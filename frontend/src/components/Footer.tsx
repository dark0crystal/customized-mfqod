"use client"
import Brand from "./navbar/Brand";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import LanguageChange from "./navbar/LangChange";



// Footer component
export default function Footer() {
  const t =useTranslations("footer");


  // Data arrays for the links
const quickLinks = [
  
  { href: "/report-found-item", label: `${t("report")}` },
  { href: "/search", label: `${t("search")}` },
];

const privacyLinks = [
  { href: "/legal/privacy", label: `${t("privacy")}` },
  { href: "/legal/terms", label: `${t("terms")}`},
];

const otherLinks = [
  { href: "/dashboard", label: `${t("dashboard")}` },
  { href: "/login", label: `${t("Register")}` },
];

  return (
    <footer className="text-gray-500 mt-24 border-t-2">
      <div className="flex flex-col lg:flex-row justify-around md:items-center  py-[2rem]">
        {/* Brand and Language Change */}
        <div className="p-4">
          <div>
            <Brand />
            <p className="text-sm text-gray-500">
                {t("description")}
            </p>
          </div>
          <div className="my-3">
            <LanguageChange/>
          </div>
        </div>

        {/* Links */}
        <div className="flex flex-col md:flex-row gap-2">
          {/* Quick Links */}
          <div className="mx-4">
            <h1 className="text-black mb-4 font-semibold">{t("quickLinks")}</h1>
            {quickLinks.map((link, index) => (
              <div key={index} className="m-2">
                <Link href={link.href}>{link.label}</Link>
              </div>
            ))}
          </div>

          {/* Privacy and Terms */}
          <div className="mx-4">
            <h1 className="text-black mb-4 font-semibold">{t("privacyTitle")}</h1>
            {privacyLinks.map((link, index) => (
              <div key={index} className="m-2">
                {link.label && <Link href={link.href}>{link.label}</Link>}
              </div>
            ))}
          </div>

          {/* Other Links */}
          <div className="mx-4">
            <h1 className="text-black mb-4 font-semibold">{t("seeAlso")}</h1>
            {otherLinks.map((link, index) => (
              <div key={index} className="m-2">
                <Link href={link.href}>{link.label}</Link>
              </div>
            ))}
          </div>
        </div>
      </div>
          <div className="bg-gray-200 h-[1.5px] w-full "/>
      <div className="p-8 md:p-12 text-center">
      <h1 className=" text-gray-500 text-sm md:text-lg " >{t("disclaimer")}</h1>
      <div className="mt-4 text-center">
        <Link className="bg-blue-200"  href="https://mrdasdev.vercel.app/">{t("developer")}</Link>
      </div>
      </div>
    </footer>
  );
}