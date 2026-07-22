import Image from "next/image";
import type { AchievementRarity } from "./achievement-view-model";

type AuraStyle = {
  glowClass: string;
  raysClass?: string;
};

/** Maps badge rarity to its decorative, non-interactive aura. */
export function getAchievementAuraStyle(
  rarity: AchievementRarity | string | null | undefined,
): AuraStyle {
  switch (rarity) {
    case "rare":
    case "magic":
      return {
        glowClass:
          "bg-[radial-gradient(circle,rgba(173,224,255,0.78)_0%,rgba(83,165,224,0.38)_48%,transparent_72%)]",
      };
    case "epic":
      return {
        glowClass:
          "bg-[radial-gradient(circle,rgba(224,182,255,0.8)_0%,rgba(155,85,205,0.4)_48%,transparent_72%)]",
      };
    case "legendary":
      return {
        glowClass:
          "bg-[radial-gradient(circle,rgba(255,238,166,0.88)_0%,rgba(235,160,50,0.48)_48%,transparent_72%)]",
        raysClass:
          "bg-[repeating-conic-gradient(from_0deg,rgba(255,222,119,0.24)_0deg_8deg,transparent_8deg_24deg)]",
      };
    case "common":
    default:
      return {
        glowClass:
          "bg-[radial-gradient(circle,rgba(255,255,255,0.72)_0%,rgba(201,207,216,0.36)_50%,transparent_72%)]",
      };
  }
}

export function MiniAchievementBadge({
  iconPath,
  name,
  rarity,
  sizeClass,
}: {
  iconPath: string | null;
  name: string;
  rarity?: AchievementRarity | string | null;
  sizeClass: string;
}) {
  const aura = getAchievementAuraStyle(rarity);

  return (
    <span
      className={`relative isolate grid shrink-0 place-items-center ${sizeClass}`}
      title={name}
    >
      {aura.raysClass ? (
        <span
          aria-hidden="true"
          className={`absolute -inset-[14%] -z-10 rounded-full opacity-60 ${aura.raysClass}`}
        />
      ) : null}
      <span
        aria-hidden="true"
        className={`absolute -inset-[12%] -z-10 rounded-full ${aura.glowClass}`}
      />
      {iconPath ? (
        <Image
          src={iconPath}
          alt=""
          fill
          sizes="(min-width: 1536px) 96px, (min-width: 640px) 48px, 40px"
          className="object-contain drop-shadow-[0_3px_6px_rgba(37,18,9,0.48)]"
        />
      ) : (
        <span className="relative z-10 text-[#fff4dc]">◆</span>
      )}
    </span>
  );
}
