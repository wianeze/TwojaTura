export type PlayerTitleRarity = "common" | "rare" | "epic" | "legendary";

export type PlayerTitle = {
  id: string;
  name: string;
  rarity: PlayerTitleRarity;
};

export type PlayerDisplayNameProps = {
  displayName: string;
  title?: PlayerTitle | null;
  variant?: "compact" | "standard" | "hero";
  className?: string;
};

const rarityClasses: Record<PlayerTitleRarity, string> = {
  common: "text-[#9b876d]",
  rare: "text-[#5793c3]",
  epic: "text-[#9a67c7]",
  legendary: "text-[#d79a32] drop-shadow-[0_0_7px_rgba(223,164,57,0.42)]",
};

export function formatCompactPlayerDisplayName({
  displayName,
  title,
}: Pick<PlayerDisplayNameProps, "displayName" | "title">) {
  return title ? `${displayName}\n${title.name}` : displayName;
}

/** Jedyna prezentacja kosmetycznej nazwy gracza poza surowymi selectami/logami. */
export function PlayerDisplayName({
  displayName,
  title,
  variant = "standard",
  className = "",
}: PlayerDisplayNameProps) {
  const titleClass = title ? rarityClasses[title.rarity] : "";

  if (variant === "compact") {
    return (
      <span
        className={`block min-w-0 ${className}`}
        title={formatCompactPlayerDisplayName({ displayName, title })}
      >
        <span className="block truncate">{displayName}</span>
        {title ? (
          <span
            className={`block truncate text-[0.72em] leading-tight font-semibold tracking-[0.04em] ${titleClass}`}
          >
            {title.name}
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <span className={`block min-w-0 ${className}`}>
      <span className="block truncate">{displayName}</span>
      {title ? (
        <span
          className={`block text-[0.58em] leading-tight font-semibold tracking-[0.04em] ${titleClass} ${variant === "hero" ? "font-class-title mt-1 line-clamp-2 max-w-[24rem] text-[0.34em] leading-[1.18] tracking-[0.06em] sm:text-[0.38em]" : "truncate"}`}
          title={title.name}
        >
          ✦ {title.name} ✦
        </span>
      ) : null}
    </span>
  );
}
