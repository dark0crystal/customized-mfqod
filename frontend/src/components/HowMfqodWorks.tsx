"use client";

import type { ReactNode } from "react";
import { useId } from "react";
import { useTranslations } from "next-intl";

function cn(...parts: (string | undefined | false)[]) {
  return parts.filter(Boolean).join(" ");
}

function HowMfqodWorksStep({
  index,
  title,
  description,
  children,
}: {
  index: number;
  title: string;
  description: string;
  children: ReactNode;
}) {
  const even = index % 2 === 0;
  return (
    <div className="flex flex-col gap-8 md:flex-row md:items-center md:gap-12 lg:gap-16">
      <div
        className={cn(
          "order-1 w-full shrink-0 md:w-1/2",
          even ? "md:order-1" : "md:order-2"
        )}
      >
        <figure
          className={cn(
            "overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-6"
          )}
        >
          <div className="mx-auto w-full max-w-lg [&_svg]:h-auto [&_svg]:w-full">
            {children}
          </div>
        </figure>
      </div>
      <div
        className={cn(
          "order-2 flex w-full flex-col justify-center md:w-1/2",
          even ? "md:order-2" : "md:order-1"
        )}
      >
        <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#3277ae]">
          {index + 1}
        </p>
        <h3 className="text-2xl font-bold tracking-tight text-black sm:text-3xl">
          {title}
        </h3>
        <p className="mt-4 text-base font-medium leading-relaxed text-slate-700 sm:text-lg">
          {description}
        </p>
      </div>
    </div>
  );
}

function Step1RegisterFound({
  clipSuffix,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  clipSuffix: string;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const cid = `howMfqodStep1IllustrationClip-${clipSuffix}`;
  return (
    <svg
      className={className}
      width="800"
      height="400"
      viewBox="0 0 800 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      <defs>
        <clipPath id={cid} clipPathUnits="userSpaceOnUse">
          <rect x="50" y="50" width="700" height="300" />
        </clipPath>
      </defs>
      <rect width="800" height="400" fill="transparent" />
      <g clipPath={`url(#${cid})`}>
        <g transform="translate(225, 200) rotate(-45)">
          <rect
            x="-40"
            y="-40"
            width="80"
            height="80"
            rx="25"
            fill="none"
            stroke="#3277ae"
            strokeWidth={16}
          />
          <path d="M40,0 H140" stroke="#3277ae" strokeWidth={16} strokeLinecap="round" />
          <path
            d="M100,0 V25 M130,0 V25"
            stroke="#3277ae"
            strokeWidth={16}
            strokeLinecap="round"
          />
        </g>
        <g transform="translate(575, 200)">
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            strokeLinecap="round"
            className="text-slate-900"
          >
            <path d="M-85, -35 C-105, -35 -105, -15 -85, -15" />
            <path d="M-85, -5 C-105, -5 -105, 15 -85, 15" />
            <path d="M-85, 25 C-105, 25 -105, 45 -85, 45" />
          </g>
          <rect
            x="-70"
            y="-110"
            width="140"
            height="220"
            rx="20"
            fill="white"
            stroke="currentColor"
            strokeWidth={10}
            className="text-slate-900"
          />
          <line
            x1="-62"
            y1="-80"
            x2="62"
            y2="-80"
            stroke="currentColor"
            strokeWidth={4}
            className="text-slate-900"
          />
          <line
            x1="-62"
            y1="70"
            x2="62"
            y2="70"
            stroke="currentColor"
            strokeWidth={4}
            className="text-slate-900"
          />
          <circle cx="0" cy="90" r="4" fill="currentColor" className="text-slate-900" />
          <g stroke="#e30613" strokeWidth={6} fill="none" strokeLinecap="round">
            <path d="M-45,-55 V-65 H-25" />
            <path d="M25,-65 H45 V-55" />
            <path d="M-45,45 V55 H-25" />
            <path d="M25,55 H45 V45" />
          </g>
          <g transform="translate(0, -5) scale(0.35) rotate(-45)">
            <rect
              x="-40"
              y="-40"
              width="80"
              height="80"
              rx="25"
              fill="none"
              stroke="#3277ae"
              strokeWidth={16}
            />
            <path d="M40,0 H140" stroke="#3277ae" strokeWidth={16} strokeLinecap="round" />
            <path
              d="M100,0 V25 M130,0 V25"
              stroke="#3277ae"
              strokeWidth={16}
              strokeLinecap="round"
            />
          </g>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={10}
            strokeLinecap="round"
            className="text-slate-900"
          >
            <path d="M40, 30 C70, 30 100, 50 110, 80 L80, 115" />
            <path d="M100, 10 C140, 40 145, 120 120, 170" />
          </g>
        </g>
      </g>
      <rect
        x="50"
        y="50"
        width="700"
        height="300"
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-slate-900"
      />
    </svg>
  );
}

function Step2MatchClaim({
  clipSuffix,
  className,
  "aria-hidden": ariaHidden = true,
}: {
  clipSuffix: string;
  className?: string;
  "aria-hidden"?: boolean;
}) {
  const sx = 700 / 780;
  const sy = 300 / 380;
  const cid = `howMfqodStep2ContentClip-${clipSuffix}`;
  return (
    <svg
      className={className}
      width="800"
      height="400"
      viewBox="0 0 800 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      <defs>
        <clipPath id={cid} clipPathUnits="userSpaceOnUse">
          <rect x="50" y="50" width="700" height="300" />
        </clipPath>
      </defs>
      <rect width="800" height="400" fill="transparent" />
      <g clipPath={`url(#${cid})`}>
        <g transform={`translate(50, 50) scale(${sx}, ${sy}) translate(-10, -10)`}>
          <g transform="translate(150, 60)">
            <rect x="0" y="0" width="500" height="310" rx="25" fill="none" stroke="#666" strokeWidth="8" />
            <rect x="25" y="25" width="450" height="250" fill="white" stroke="#ccc" strokeWidth="2" />
            <path
              d="M-50,340 L550,340 L500,310 L0,310 Z"
              fill="none"
              stroke="#666"
              strokeWidth="8"
              strokeLinejoin="round"
            />
          </g>
          <g transform="translate(175, 85)">
            <rect x="25" y="30" width="120" height="35" rx="4" fill="#3277ae" />
            <path
              d="M40,47 L45,52 L55,42"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <rect x="160" y="30" width="120" height="35" rx="4" fill="#f39c12" />
            <path
              d="M175,40 L185,50 M185,40 L175,50"
              fill="none"
              stroke="white"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <rect x="25" y="85" width="400" height="130" fill="#e0e0e0" />
            <rect x="45" y="105" width="150" height="30" fill="#8ab4d6" />
            <rect x="230" y="155" width="170" height="40" fill="white" />
            <g transform="translate(140, 50)">
              <line x1="-10" y1="-5" x2="-20" y2="-10" stroke="black" strokeWidth="3" strokeLinecap="round" />
              <line x1="0" y1="-15" x2="0" y2="-25" stroke="black" strokeWidth="3" strokeLinecap="round" />
              <line x1="10" y1="-5" x2="20" y2="-10" stroke="black" strokeWidth="3" strokeLinecap="round" />
              <path
                d="M0,0 L0,40 L12,28 L30,28 Z"
                fill="white"
                stroke="black"
                strokeWidth="3"
                strokeLinejoin="round"
              />
            </g>
          </g>
        </g>
      </g>
      <rect
        x="50"
        y="50"
        width="700"
        height="300"
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-slate-900"
      />
    </svg>
  );
}

const BRAND = "#3277ae";
const BRAND_WALL = "#e8f4fc";
const BRAND_TRIM = "#cfe8f5";
const BRAND_ROOF = "#3277ae";
const BRAND_DOOR = "#285f8c";
const BRAND_WINDOW = "#7eb8db";
const BRAND_ACCENT = "#b8d9f0";

function PackageIcon({ fill }: { fill: string }) {
  return (
    <g fill={fill}>
      <path d="M422.75,240.289c-2.432-1.57-5.504-1.801-8.149-0.589l-93.867,42.667c-3.046,1.382-5.001,4.412-5.001,7.765v42.667c0,2.901,1.476,5.598,3.917,7.177c1.399,0.896,3.004,1.357,4.617,1.357c1.203,0,2.406-0.247,3.533-0.768l93.867-42.667c3.046-1.382,5.001-4.412,5.001-7.765v-42.667C426.667,244.564,425.19,241.868,422.75,240.289z M409.6,284.645l-76.8,34.91v-23.927l76.8-34.91V284.645z M506.957,111.683L259.49,0.75c-2.219-0.998-4.77-0.998-6.98,0L5.043,111.683C1.971,113.057,0,116.103,0,119.466v51.2c0,3.362,1.971,6.409,5.043,7.782l12.023,5.393v217.225c0,3.379,1.98,6.426,5.069,7.799l230.4,102.4c1.109,0.495,2.278,0.734,3.465,0.734c1.186,0,2.355-0.239,3.465-0.734l230.4-102.4c3.089-1.374,5.069-4.42,5.069-7.799V183.841l12.023-5.393c3.072-1.374,5.043-4.42,5.043-7.782v-51.2C512,116.103,510.029,113.057,506.957,111.683z M247.467,490.333L34.133,395.527V191.487l213.333,95.633V490.333z M247.467,268.423l-230.4-103.279v-32.503l230.4,103.279V268.423z M256,221.046L29.389,119.466L256,17.885l226.611,101.581L256,221.046z M477.867,395.527l-213.333,94.805V287.12l213.333-95.633V395.527z M494.933,165.145l-230.4,103.279V235.92l230.4-103.279V165.145z" />
    </g>
  );
}

function Step3Pickup({
  className,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      className={className}
      width="800"
      height="400"
      viewBox="0 0 800 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      <rect width="800" height="400" fill="transparent" />
      <rect
        x="50"
        y="50"
        width="700"
        height="300"
        fill="white"
        stroke="currentColor"
        strokeWidth={6}
        className="text-slate-900"
      />
      <g transform="translate(248, 218) scale(3.5) translate(-24, -24)">
        <path fill={BRAND_WALL} d="M42 39L6 39 6 23 24 6 42 23z" />
        <path fill={BRAND_TRIM} d="M39 21L34 16 34 9 39 9zM6 39H42V44H6z" />
        <path fill={BRAND_ROOF} d="M24 4.3L4 22.9 6 25.1 24 8.4 42 25.1 44 22.9z" />
        <path fill={BRAND_DOOR} d="M18 28H30V44H18z" />
        <path fill={BRAND_WINDOW} d="M21 17H27V23H21z" />
        <path
          fill={BRAND_ACCENT}
          d="M27.5,35.5c-0.3,0-0.5,0.2-0.5,0.5v2c0,0.3,0.2,0.5,0.5,0.5S28,38.3,28,38v-2C28,35.7,27.8,35.5,27.5,35.5z"
        />
      </g>
      <path
        d="M400,100 C418,130 382,160 400,190 C418,220 382,250 400,280 C418,310 382,340 400,340"
        fill="none"
        stroke={BRAND}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />
      <g transform="translate(552, 218) scale(0.36) translate(-256, -256)">
        <PackageIcon fill={BRAND} />
      </g>
    </svg>
  );
}

function Step4Outcome({
  className,
  "aria-hidden": ariaHidden = true,
}: {
  className?: string;
  "aria-hidden"?: boolean;
}) {
  return (
    <svg
      className={className}
      width="800"
      height="400"
      viewBox="0 0 800 400"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden={ariaHidden}
    >
      <rect width="800" height="400" fill="transparent" />
      <rect
        x="50"
        y="50"
        width="700"
        height="300"
        fill="none"
        stroke="currentColor"
        strokeWidth={6}
        className="text-slate-900"
      />
      <g transform="translate(400, 200)">
        <circle cx="0" cy="0" r="95" fill="none" stroke="#3277ae" strokeWidth={14} />
        <path
          d="M-42 8 L-12 38 L48 -32"
          fill="none"
          stroke="#3277ae"
          strokeWidth={16}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
      <g transform="translate(400, 200)" opacity={0.35}>
        <circle cx="-140" cy="-40" r="12" fill="#3277ae" />
        <circle cx="150" cy="30" r="10" fill="#3277ae" />
        <circle cx="120" cy="-80" r="8" fill="#3277ae" />
        <circle cx="-130" cy="70" r="9" fill="#3277ae" />
      </g>
    </svg>
  );
}

export default function HowMfqodWorks({ className }: { className?: string }) {
  const t = useTranslations("howMfqodWorks");
  const rawId = useId();
  const clipSuffix = rawId.replace(/:/g, "");

  const steps = [
    {
      title: t("step1Title"),
      description: t("step1Description"),
      illustration: <Step1RegisterFound clipSuffix={clipSuffix} />,
    },
    {
      title: t("step2Title"),
      description: t("step2Description"),
      illustration: <Step2MatchClaim clipSuffix={clipSuffix} />,
    },
    {
      title: t("step3Title"),
      description: t("step3Description"),
      illustration: <Step3Pickup />,
    },
    {
      title: t("step4Title"),
      description: t("step4Description"),
      illustration: <Step4Outcome />,
    },
  ] as const;

  return (
    <section
      className={cn(
        "w-full px-4 pb-16 pt-24 sm:px-6 sm:pb-20 sm:pt-32 md:px-[5rem] lg:px-[7rem]",
        className
      )}
      aria-labelledby="how-mfqod-works-heading"
    >
      <div className="mx-auto max-w-6xl">
        <h2
          id="how-mfqod-works-heading"
          className="mb-12 text-center text-3xl font-extrabold tracking-tight text-black sm:mb-16 sm:text-4xl"
        >
          {t("sectionTitle")}
        </h2>
        <div className="flex flex-col gap-16 sm:gap-20 lg:gap-24">
          {steps.map((step, index) => (
            <HowMfqodWorksStep
              key={step.title}
              index={index}
              title={step.title}
              description={step.description}
            >
              {step.illustration}
            </HowMfqodWorksStep>
          ))}
        </div>
      </div>
    </section>
  );
}
