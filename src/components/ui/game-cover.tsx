import type { MockGame } from "@/features/games/mock-games";

type GameCoverProps = {
  game: MockGame;
  size?: "shelf" | "preview" | "card" | MockGame["coverSize"];
  className?: string;
};

function CoverSymbol({ symbol }: Pick<MockGame, "symbol">) {
  if (symbol === "lighthouse") {
    return (
      <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden="true">
        <path d="M44 68h20L59 28H49L44 68Z" fill="#F8E6BD" />
        <path d="M45 28h18l-4-9H49l-4 9Z" fill="#D99B4B" />
        <path
          d="m62 24 29-10M45 24 12 12"
          stroke="#FFD77D"
          strokeWidth="4"
          opacity=".65"
        />
        <path
          d="M16 68c19-11 48-9 74 0"
          fill="none"
          stroke="#F4C873"
          strokeWidth="3"
        />
      </svg>
    );
  }

  if (symbol === "harbor") {
    return (
      <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden="true">
        <path d="M50 13v43M50 18l27 25H50Z" fill="#F7E4B7" />
        <path d="M50 25 28 47h22Z" fill="#D89452" />
        <path
          d="M18 61c11-5 20 5 31 0s20 5 32 0"
          fill="none"
          stroke="#FFE0A0"
          strokeWidth="4"
        />
      </svg>
    );
  }

  if (symbol === "compass") {
    return (
      <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden="true">
        <circle
          cx="50"
          cy="40"
          r="26"
          fill="none"
          stroke="#F8E2B0"
          strokeWidth="3"
        />
        <path d="m58 26-5 17-14 10 5-17 14-10Z" fill="#F7D07B" />
        <circle cx="50" cy="40" r="4" fill="#FFF1CC" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 100 80" className="h-full w-full" aria-hidden="true">
      <circle cx="72" cy="22" r="10" fill="#F5C86E" opacity=".9" />
      <path d="m8 66 26-35 16 21 12-17 30 31H8Z" fill="#A8B39A" />
      <path d="m34 31 16 21 6-8" fill="none" stroke="#F8E8C8" strokeWidth="4" />
    </svg>
  );
}

const sizeClasses = {
  shelf: "h-48 w-32 sm:h-56 sm:w-36",
  preview: "h-64 w-44",
  card: "h-52 w-36",
  tall: "h-52 w-31 sm:h-62 sm:w-37",
  wide: "h-46 w-35 sm:h-55 sm:w-42",
  classic: "h-49 w-32 sm:h-58 sm:w-38",
  slim: "h-50 w-28 sm:h-60 sm:w-33",
};

export function GameCover({
  game,
  size = "shelf",
  className = "",
}: GameCoverProps) {
  return (
    <div
      className={`relative flex shrink-0 flex-col overflow-hidden rounded-[0.35rem_1rem_1rem_0.35rem] border border-white/20 bg-gradient-to-br ${game.gradient} p-3 text-[#fff4dc] shadow-[8px_12px_24px_rgba(21,12,8,0.28)] ring-1 ring-black/10 ${sizeClasses[size]} ${className}`}
    >
      <span className="absolute inset-y-0 left-0 w-2 border-r border-black/20 bg-black/16" />
      <span className="text-[0.55rem] font-bold tracking-[0.16em] text-[#f6d99b] uppercase">
        Twoja Tura!
      </span>
      <div className="mt-2 min-h-0 flex-1">
        <CoverSymbol symbol={game.symbol} />
      </div>
      <div>
        <p className="font-display text-lg leading-5 font-semibold tracking-tight">
          {game.title}
        </p>
        <p className="mt-1 line-clamp-2 text-[0.58rem] leading-3.5 text-white/70">
          {game.kicker}
        </p>
      </div>
      <span className="bg-gold/80 absolute top-0 right-3 h-7 w-2 shadow-sm" />
    </div>
  );
}
