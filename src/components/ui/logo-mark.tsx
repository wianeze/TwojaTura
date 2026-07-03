import Link from "next/link";
import { useId } from "react";

type LogoMarkProps = {
  compact?: boolean;
  variant?: "wordmark" | "hero";
  tone?: "dark" | "light";
};

type LogoEmblemProps = {
  className?: string;
  title?: string;
};

export function LogoEmblem({
  className = "size-12",
  title = "Emblemat Twoja Tura!",
}: LogoEmblemProps) {
  const id = useId().replaceAll(":", "");
  const woodId = `${id}-wood`;
  const copperId = `${id}-copper`;
  const faceId = `${id}-face`;

  return (
    <svg
      viewBox="0 0 120 136"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={woodId} x1="20" y1="10" x2="100" y2="125">
          <stop stopColor="#503027" />
          <stop offset="1" stopColor="#211511" />
        </linearGradient>
        <linearGradient id={copperId} x1="18" y1="8" x2="102" y2="124">
          <stop stopColor="#F0BD68" />
          <stop offset=".48" stopColor="#B76032" />
          <stop offset="1" stopColor="#6C2F22" />
        </linearGradient>
        <linearGradient id={faceId} x1="38" y1="34" x2="82" y2="92">
          <stop stopColor="#FFE3A0" />
          <stop offset="1" stopColor="#C87835" />
        </linearGradient>
      </defs>

      <path
        d="M60 4 108 21v39c0 31-18 55-48 71C30 115 12 91 12 60V21L60 4Z"
        fill={`url(#${copperId})`}
        stroke="#F4CC7B"
        strokeWidth="3"
      />
      <path
        d="M60 12 99 26v34c0 25-14 45-39 59-25-14-39-34-39-59V26L60 12Z"
        fill={`url(#${woodId})`}
        stroke="#7E472E"
        strokeWidth="2"
      />

      <path
        d="M28 76c5-20 12-33 24-43"
        fill="none"
        stroke="#4F8B77"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M92 76C87 56 80 43 68 33"
        fill="none"
        stroke="#8E5B78"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="m35 61-7-4M40 49l-6-7M85 61l7-4M80 49l6-7"
        stroke="#D8A85D"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="m60 31 24 16v29L60 94 36 76V47l24-16Z"
        fill={`url(#${faceId})`}
        stroke="#FFE2A0"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="m60 31 1 29 23-13M61 60 36 47M61 60l-1 34M61 60l23 16M61 60 36 76"
        fill="none"
        stroke="#8C421F"
        strokeWidth="1.5"
        opacity=".82"
      />
      <path
        d="m60 31-24 16 25 13 23-13-24-16Z"
        fill="#FFD98C"
        fillOpacity=".58"
      />
      <path d="m36 47 25 13-1 34-24-18V47Z" fill="#E19A48" fillOpacity=".55" />
      <text
        x="61"
        y="70"
        textAnchor="middle"
        fill="#442319"
        fontFamily="Georgia, serif"
        fontSize="18"
        fontWeight="700"
      >
        12
      </text>

      <circle
        cx="60"
        cy="108"
        r="13"
        fill="#36201B"
        stroke="#E5A94C"
        strokeWidth="3"
      />
      <path
        d="m60 97 3.5 7.5L72 108l-8.5 3.5L60 120l-3.5-8.5L48 108l8.5-3.5L60 97Z"
        fill="#F2B653"
      />
      <circle cx="31" cy="31" r="2" fill="#F7D584" />
      <circle cx="89" cy="31" r="2" fill="#F7D584" />
    </svg>
  );
}

export function LogoMark({
  compact = false,
  variant = "wordmark",
  tone = "dark",
}: LogoMarkProps) {
  const hero = variant === "hero";
  const light = tone === "light";

  return (
    <Link
      href="/"
      className={`group focus-visible:outline-gold inline-flex rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 ${
        hero ? "flex-col items-center gap-4 text-center" : "items-center gap-3"
      }`}
      aria-label="Twoja Tura! — strona główna"
    >
      <LogoEmblem
        className={`${hero ? "h-36 w-32 sm:h-44 sm:w-40" : "h-12 w-11"} drop-shadow-[0_12px_24px_rgba(30,15,9,0.25)] transition-transform duration-300 group-hover:-translate-y-0.5`}
      />

      {!compact && (
        <span className="leading-none">
          <span
            className={`font-display block font-semibold tracking-tight ${
              hero ? "text-4xl sm:text-5xl" : "text-xl"
            } ${light ? "text-cream" : "text-foreground"}`}
          >
            Twoja Tura!
          </span>
          <span
            className={`mt-1.5 block text-[0.62rem] font-bold tracking-[0.2em] uppercase ${
              light ? "text-[#d8b979]" : "text-muted"
            }`}
          >
            klub planszówkowy
          </span>
        </span>
      )}
    </Link>
  );
}
