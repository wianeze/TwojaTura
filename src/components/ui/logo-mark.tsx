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
  const gradientId = useId().replaceAll(":", "");
  const glowId = `${gradientId}-glow`;

  return (
    <svg
      viewBox="0 0 120 136"
      role="img"
      aria-label={title}
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="18" y1="8" x2="102" y2="128">
          <stop stopColor="#754A35" />
          <stop offset="1" stopColor="#2F1E19" />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="55%" r="48%">
          <stop stopColor="#F4C66C" stopOpacity=".82" />
          <stop offset="1" stopColor="#DF6A35" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path
        d="M60 4 108 21v39c0 31-18 55-48 71C30 115 12 91 12 60V21L60 4Z"
        fill={`url(#${gradientId})`}
        stroke="#E6BA66"
        strokeWidth="3"
      />
      <path
        d="M60 12 99 26v34c0 26-14 46-39 60-25-14-39-34-39-60V26L60 12Z"
        fill="none"
        stroke="#FFF2D2"
        strokeOpacity=".24"
      />
      <circle cx="60" cy="69" r="38" fill={`url(#${glowId})`} />

      <path d="m25 59 20-22 14 17 9-11 27 31H25Z" fill="#9AA88F" />
      <path
        d="m45 37 14 17 4-5 8 9"
        fill="none"
        stroke="#F7EBD4"
        strokeWidth="3"
      />
      <path
        d="M24 73h72"
        stroke="#E7B15B"
        strokeWidth="3"
        strokeLinecap="round"
      />

      <path
        d="M28 78h64l-4 11H32l-4-11Z"
        fill="#B87345"
        stroke="#F1C276"
        strokeWidth="2"
      />
      <path
        d="m38 89-5 18M82 89l5 18"
        stroke="#DDA35B"
        strokeWidth="4"
        strokeLinecap="round"
      />

      <circle cx="60" cy="72" r="5" fill="#FFE4A0" />
      <path
        d="M53 81c0-5 3-7 7-7s7 2 7 7l5 8-7 2-1 11h-8l-1-11-7-2 5-8Z"
        fill="#F0A24B"
        stroke="#FFF0C8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M60 109c-5-4-7-8-5-12 1 3 3 4 5 5 0-5 3-8 6-11 2 7 1 13-6 18Z"
        fill="#E96935"
      />
      <path d="M60 106c-2-2-2-4 0-7 2 2 3 4 0 7Z" fill="#FFD06F" />
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
        <span className={hero ? "leading-none" : "leading-none"}>
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
