import Image from "@/lib/Image";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "use-intl";

export default function Brand() {
  const t = useTranslations("navbar");

  return (
    <Link href="/" className="flex items-center gap-1">
      {/* Brand Name */}
      <div className={`text-black text-[28px] sm:text-[42px] font-lalezar`}>
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
          src="/squlogo.svg"
          alt="Sultan Qaboos University Logo"
          width={204}
          height={93}
          className="object-contain w-[138px] h-[80px] sm:w-[152px] sm:h-[88px] md:w-[204px] md:h-[93px]"
        />
      </div>
    </Link>
  );
}
