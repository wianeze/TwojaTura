"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { canUseNextImageOptimization } from "@/lib/image-sources";

type GameCoverSize = "shelf" | "preview" | "card" | "mini" | "micro";

type GameCoverProps = {
  title: string;
  coverUrl: string | null;
  size?: GameCoverSize;
  className?: string;
  fitParent?: boolean;
};

const sizeClasses: Record<GameCoverSize, string> = {
  shelf: "aspect-square w-full max-w-24 sm:max-w-28 xl:max-w-30 2xl:max-w-32",
  preview: "aspect-square w-52 sm:w-60 lg:w-64",
  card: "aspect-square w-44 sm:w-52 lg:w-60",
  mini: "aspect-square w-22 sm:w-24",
  micro: "aspect-square w-13",
};

const frameClasses: Record<GameCoverSize, string> = {
  shelf:
    "border-white/14 bg-[#17120f] shadow-[8px_14px_28px_rgba(14,7,4,0.46),inset_0_0_0_1px_rgba(255,255,255,0.05)] ring-1 ring-black/18",
  preview:
    "border-[#d8c2a0]/55 bg-[radial-gradient(circle_at_top,rgba(255,252,247,0.96),rgba(247,239,227,0.98)_62%,rgba(238,226,205,0.98))] shadow-[0_18px_32px_rgba(75,49,27,0.14)]",
  card: "border-[#d8c2a0]/55 bg-[radial-gradient(circle_at_top,rgba(255,252,247,0.96),rgba(247,239,227,0.98)_62%,rgba(238,226,205,0.98))] shadow-[0_18px_32px_rgba(75,49,27,0.14)]",
  mini: "border-[#dbc7a7]/58 bg-[linear-gradient(180deg,rgba(255,252,247,0.98),rgba(244,235,221,0.98))] shadow-[0_10px_22px_rgba(75,49,27,0.12)]",
  micro:
    "border-[#a5825c]/55 bg-[linear-gradient(180deg,rgba(255,250,240,0.98),rgba(238,224,202,0.98))]",
};

const imagePaddingClasses: Record<GameCoverSize, string> = {
  shelf: "p-1",
  preview: "p-3 sm:p-3.5",
  card: "p-2.5 sm:p-3",
  mini: "p-2",
  micro: "p-1",
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

const imageSizes: Record<GameCoverSize, string> = {
  shelf:
    "(max-width: 639px) 96px, (max-width: 1279px) 112px, (max-width: 1535px) 120px, 128px",
  preview: "(max-width: 639px) 208px, (max-width: 1023px) 240px, 256px",
  card: "(max-width: 639px) 176px, (max-width: 1023px) 208px, 240px",
  mini: "(max-width: 639px) 88px, 96px",
  micro: "52px",
};

export function GameCover({
  title,
  coverUrl,
  size = "shelf",
  className = "",
  fitParent = false,
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
  const useOptimizedImage = Boolean(
    coverUrl && canUseNextImageOptimization(coverUrl),
  );

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[0.55rem] border ${frameClasses[size]} ${
        fitParent ? "aspect-square w-full max-w-full" : sizeClasses[size]
      } ${className}`}
    >
      {showImage ? (
        useOptimizedImage ? (
          <Image
            src={coverUrl ?? ""}
            alt={`Okładka gry ${title}`}
            fill
            sizes={imageSizes[size]}
            quality={90}
            loading={size === "preview" ? "eager" : "lazy"}
            className={`object-contain ${imagePaddingClasses[size]}`}
            onError={() => setHasError(true)}
          />
        ) : (
          // Dowolne URL-e użytkownika zostają przy zwykłym img; Next optymalizuje
          // tylko bezpiecznie skonfigurowane źródła lokalne i BGG.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={coverUrl ?? undefined}
            alt={`Okładka gry ${title}`}
            loading={size === "preview" ? "eager" : "lazy"}
            className={`size-full object-contain ${imagePaddingClasses[size]}`}
            onError={() => setHasError(true)}
          />
        )
      ) : size === "micro" ? (
        // Na kafelku 52px etykieta „Półka” i tytuł byłyby nieczytelną plamą —
        // zostaje sam monogram gry.
        <div className="grid size-full place-items-center bg-transparent">
          <span className="font-display text-[0.9rem] leading-none font-semibold text-[#6a4a2d]">
            {initials || "TT"}
          </span>
        </div>
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
