import Image from "next/image";

export type BadgePreview = {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  earned?: boolean;
  fallbackSymbol?: string;
};

type BadgePreviewCardProps = {
  badge: BadgePreview;
};

export function BadgePreviewCard({ badge }: BadgePreviewCardProps) {
  const earned = badge.earned ?? false;

  return (
    <article
      className={`relative rounded-[1.25rem] px-3 py-4 text-center transition-[filter,opacity] ${
        earned
          ? "paper-wash shadow-[0_12px_26px_rgba(68,40,24,0.14)]"
          : "bg-[#e5d8c3]/72 opacity-65 shadow-inner grayscale-[0.75]"
      }`}
      aria-label={`${badge.name}: ${earned ? "zdobyta" : "niezdobyta"}`}
    >
      <div
        className={`relative mx-auto grid size-19 place-items-center rounded-full border-2 shadow-[0_12px_22px_rgba(65,37,22,0.22)] ${
          earned
            ? "border-[#d6a357] bg-[radial-gradient(circle_at_35%_25%,#fff0be,#b8753f_55%,#613523)]"
            : "border-[#ad9d88] bg-[#b9ad9b]"
        }`}
      >
        {badge.imageUrl ? (
          <Image
            src={badge.imageUrl}
            alt=""
            fill
            sizes="76px"
            className="object-contain p-1.5"
          />
        ) : (
          <span className="font-display text-3xl font-semibold text-[#fff1c9] drop-shadow-md">
            {badge.fallbackSymbol ?? "◇"}
          </span>
        )}
      </div>

      {!earned && (
        <span className="absolute top-3 right-3 rounded-full bg-[#51463d]/82 px-2 py-1 text-[0.52rem] font-bold tracking-wider text-[#f2e7d8] uppercase">
          Niezdobyta
        </span>
      )}
      <h3 className="font-display mt-3 text-sm font-semibold">{badge.name}</h3>
      <p className="text-muted mt-1 text-[0.58rem] leading-4">
        {badge.description}
      </p>
    </article>
  );
}
