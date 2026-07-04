import Image from "next/image";
import type { MockGame } from "@/features/games/mock-games";

type GameCoverSize =
  "shelf" | "preview" | "card" | "mini" | MockGame["coverSize"];

type GameCoverProps = {
  game: MockGame;
  size?: GameCoverSize;
  className?: string;
};

const squareSizeClasses: Record<GameCoverSize, string> = {
  shelf: "size-22 sm:size-28 xl:size-30 2xl:size-32",
  preview: "size-56 sm:size-64",
  card: "size-36",
  mini: "size-24 sm:size-26",
  tall: "size-40 sm:size-48",
  wide: "size-34 sm:size-42",
  classic: "size-36 sm:size-44",
  slim: "size-32 sm:size-40",
};

const portraitSizeClasses: Record<GameCoverSize, string> = {
  shelf: "size-22 sm:size-28 xl:size-30 2xl:size-32",
  preview: "h-72 w-50",
  card: "h-52 w-36",
  mini: "h-36 w-24 sm:h-39 sm:w-26",
  tall: "h-56 w-39 sm:h-64 sm:w-44",
  wide: "h-48 w-34 sm:h-56 sm:w-39",
  classic: "h-52 w-36 sm:h-60 sm:w-42",
  slim: "h-48 w-33 sm:h-56 sm:w-39",
};

export function GameCover({
  game,
  size = "shelf",
  className = "",
}: GameCoverProps) {
  const sizeClass =
    game.coverRatio === "portrait"
      ? portraitSizeClasses[size]
      : squareSizeClasses[size];

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-[0.45rem] border border-white/18 bg-[#17120f] shadow-[8px_14px_28px_rgba(14,7,4,0.46),inset_0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-black/25 ${sizeClass} ${className}`}
    >
      <Image
        src={game.coverSrc}
        alt={`Okładka gry ${game.title}`}
        fill
        sizes="(max-width: 640px) 144px, 192px"
        className={size === "shelf" ? "object-contain" : "object-cover"}
      />
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-black/38 to-transparent" />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/16" />
    </div>
  );
}
