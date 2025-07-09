"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Lalezar } from "next/font/google";
import { useTranslations } from "next-intl";
import squLogo from "../../../public/Sultan_Qaboos_University_Logo.png"

const lalezarFont = Lalezar({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

export default function Brand() {
  const t = useTranslations("navbar");

  return (
    <Link href="/" className="flex items-center gap-1">
      {/* Brand Name */}
       <div className=" text-black text-[42px] ">
            <Link className={lalezarFont.className} href='/'><p className="flex flex-col relative z-20 text-slate-800">{t("brand-duplicate")} <span className="absolute -z-10 text-blue-600">{t("brand")}</span></p></Link>
        </div>
      
      {/* Styled Separator */}
      <div className="text-4xl font-light text-gray-500 mx-1">
        |
      </div>
      
      {/* Organization Logo */}
      <div className="flex items-center">
        <Image
          src={squLogo}
          alt="Sultan Qaboos University Logo"
          width={38}
          height={38}
          className="object-contain"
        />
      </div>
    </Link>
  );
}