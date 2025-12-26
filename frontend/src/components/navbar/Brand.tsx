"use client";

import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Lalezar } from "next/font/google";
import { useTranslations } from "next-intl";
import squLogo from "../../../public/squlogo.svg";

const lalezarFont = Lalezar({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "arial", "sans-serif"],
  adjustFontFallback: true,
});

export default function Brand() {
  const t = useTranslations("navbar");

  return (
    <Link href="/" className="flex items-center gap-1">
      {/* Brand Name */}
      <div className={`text-black text-[28px] sm:text-[42px] ${lalezarFont.className}`}>
        <p className="flex flex-col relative z-20 text-slate-800">
          {t("brand-duplicate")}
          <span className="absolute -z-10" style={{ color: '#3277AE' }}>
            {t("brand")}
          </span>
        </p>
      </div>

      {/* Styled Separator */}
      <div className="text-[27px] sm:text-4xl font-light text-gray-500 mx-1">|</div>

      {/* Organization Logo */}
      <div className="flex items-center">
        <Image
          src={squLogo}
          alt="Sultan Qaboos University Logo"
          width={176}
          height={80}
          className="object-contain w-[120px] h-[80px] md:w-[176px] md:h-[80px]"
        />
      </div>
    </Link>
  );
}
