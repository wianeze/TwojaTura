"use client";

import { useMemo, useState } from "react";

type GameCoverSize = "shelf" | "preview" | "card" | "mini";

type GameCoverProps = {
  title: string;
  coverUrl: string | null;
  size?: GameCoverSize;
  className?: string;
};

const sizeClasses: Record<GameCoverSize, string> = {
  shelf: "aspect-square w-full max-w-24 sm:max-w-28 xl:max-w-30 2xl:max-w-32",
  preview: "aspect-square w-52 sm:w-60 lg:w-64",
  card: "aspect-square w-44 sm:w-52 lg:w-60",
  mini: "aspect-square w-22 sm:w-24",
};

const frameClasses: Record<GameCoverSize, string> = {
  shelf:
    "border-white/14 bg-[#17120f] shadow-[8px_14px_28px_rgba(14,7,4,0.46),inset_0_0_0_1px_rgba(255,255,255,0.05)] ring-1 ring-black/18",
  preview:
    "border-[#d8c2a0]/55 bg-[radial-gradient(circle_at_top,rgba(255,252,247,0.96),rgba(247,239,227,0.98)_62%,rgba(238,226,205,0.98))] shadow-[0_18px_32px_rgba(75,49,27,0.14)]",
  card: "border-[#d8c2a0]/55 bg-[radial-gradient(circle_at_top,rgba(255,252,247,0.96),rgba(247,239,227,0.98)_62%,rgba(238,226,205,0.98))] shadow-[0_18px_32px_rgba(75,49,27,0.14)]",
  mini: "border-[#dbc7a7]/58 bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(244,235,221,0.98))] shadow-[0_10px_22px_rgba(75,49,27,0.12)]",
};

const imagePaddingClasses: Record<GameCoverSize, string> = {
  shelf: "p-1",
  preview: "p-3 sm:p-3.5",
  card: "p-2.5 sm:p-3",
  mini: "p-2",
};

const overlayClasses: Partial<Record<GameCoverSize, string>> = {
  shelf: "bg-gradient-to-br from-white/10 via-transparent to-black/14",
  preview:
    "bg-gradient-to-br from-white/38 via-transparent to-[rgba(172,132,82,0.08)]",
  card: "bg-gradient-to-br from-white/30 via-transparent to-[rgba(172,132,82,0.08)]",
  mini: "bg-gradient-to-br from-white/24 via-transparent to-[rgba(172,132,82,0.06)]",
};

const accentClasses: Partial<Record<GameCoverSize, string>> = {
  shelf:
    "absolute inset-y-0 left-0 w-1 bg-gradient-to-r from-black/32 to-transparent",
};

export function GameCover({
  title,
  coverUrl,
  size = "shelf",
  className = "",
}: GameCoverProps) {
  const [hasError, setHasError] = useState(false);

  const showImage = Boolean(coverUrl) && !hasError;
  const initials = useMemo(
    () =>
      title
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toLocaleUpperCase("pl-PL"))
        .join(""),
    [title],
  );

  const isShelfVariant = size === "shelf";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[0.55rem] border ${frameClasses[size]} ${sizeClasses[size]} ${className}`}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- cover_url can be external or local public asset
        <img
          src={coverUrl ?? undefined}
          alt={`Okładka gry ${title}`}
          loading={size === "preview" ? "eager" : "lazy"}
          className={`size-full object-contain ${imagePaddingClasses[size]}`}
          onError={() => setHasError(true)}
        />
      ) : (
        <div
          className={`flex size-full flex-col justify-between p-3 ${
            isShelfVariant
              ? "wood-grain text-cream"
              : "bg-transparent text-[#5c422d]"
          }`}
        >
          <span
            className={`text-[0.58rem] font-bold tracking-[0.22em] uppercase ${
              isShelfVariant ? "text-[#ddb677]" : "text-[#b28653]"
            }`}
          >
            Półka
          </span>
          <span
            className={`font-display text-center text-xl font-semibold ${
              isShelfVariant ? "text-[#f6e5cf]" : "text-[#6a4a2d]"
            }`}
          >
            {initials || "TT"}
          </span>
          <span
            className={`line-clamp-3 text-center text-[0.65rem] leading-4 ${
              isShelfVariant ? "text-[#d9c7b4]" : "text-[#85644a]"
            }`}
          >
            {title}
          </span>
        </div>
      )}

      {accentClasses[size] && (
        <span
          className={`pointer-events-none ${accentClasses[size]}`}
          aria-hidden="true"
        />
      )}

      {overlayClasses[size] && (
        <span
          className={`pointer-events-none absolute inset-0 ${overlayClasses[size]}`}
          aria-hidden="true"
        />
      )}
    </div>
  );
}
