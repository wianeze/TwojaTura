import type { DashboardQuest } from "./types";

export type QuestVisualRarity =
  "common" | "uncommon" | "magic" | "epic" | "legendary";

export type QuestVisualVariant = {
  rarity: QuestVisualRarity;
  isMeetingQuest: boolean;
  exclamationAsset: string;
  cardClassName: string;
  glowClassName: string;
  badgeClassName: string;
  dateClassName: string;
  titleClassName: string;
  descriptionClassName: string;
  ctaClassName: string;
  rewardClassName: string;
};

type QuestVisualCategory =
  "meeting" | "vote" | "chronicle" | "rating" | "shelf";

const rarityStyles: Record<
  QuestVisualRarity,
  Omit<QuestVisualVariant, "rarity" | "isMeetingQuest" | "exclamationAsset">
> = {
  common: {
    cardClassName:
      "bg-[linear-gradient(145deg,rgba(255,252,246,0.98),rgba(244,235,217,0.92))] text-[#4e3528]",
    glowClassName: "bg-[#f8e4c2]/52",
    badgeClassName:
      "border border-[#d7b68a]/70 bg-white/78 text-[#8b5d31] shadow-[0_10px_24px_rgba(108,70,39,0.14)]",
    dateClassName: "bg-white/78 text-[#7a5438] ring-1 ring-[#d9c0a0]/55",
    titleClassName: "text-[#4b3326]",
    descriptionClassName: "text-[#6f5540]",
    ctaClassName: "text-[#8b5d31]",
    rewardClassName: "bg-[#4b3127] text-[#f1d59d]",
  },
  uncommon: {
    cardClassName:
      "bg-[linear-gradient(145deg,rgba(244,251,242,0.98),rgba(219,235,215,0.93))] text-[#35533a]",
    glowClassName: "bg-[#8db28b]/34",
    badgeClassName:
      "border border-[#9ebd9a]/72 bg-[#f4fbf2]/84 text-[#557351] shadow-[0_12px_28px_rgba(63,97,56,0.16)]",
    dateClassName: "bg-[#f5fbf2]/80 text-[#5d7559] ring-1 ring-[#abc6a5]/55",
    titleClassName: "text-[#35533a]",
    descriptionClassName: "text-[#557055]",
    ctaClassName: "text-[#49734b]",
    rewardClassName: "bg-[#314c31] text-[#ddf0d7]",
  },
  magic: {
    cardClassName:
      "bg-[linear-gradient(145deg,rgba(239,248,255,0.98),rgba(211,232,247,0.92))] text-[#203b53]",
    glowClassName: "bg-[#89bfe8]/40",
    badgeClassName:
      "border border-[#8cb8d6]/70 bg-[#eff8ff]/82 text-[#355d7d] shadow-[0_10px_26px_rgba(63,108,145,0.18)]",
    dateClassName: "bg-[#f3fbff]/84 text-[#476886] ring-1 ring-[#9fc4dc]/55",
    titleClassName: "text-[#21435c]",
    descriptionClassName: "text-[#496a86]",
    ctaClassName: "text-[#2e6b99]",
    rewardClassName: "bg-[#23405a] text-[#d7eeff]",
  },
  epic: {
    cardClassName:
      "bg-[linear-gradient(145deg,rgba(251,245,255,0.98),rgba(228,213,241,0.93))] text-[#4a335f]",
    glowClassName: "bg-[#ad86d2]/40",
    badgeClassName:
      "border border-[#b698d5]/72 bg-[#fbf6ff]/84 text-[#76539b] shadow-[0_12px_28px_rgba(86,60,118,0.18)]",
    dateClassName: "bg-[#faf4ff]/84 text-[#6f5891] ring-1 ring-[#c1abdb]/55",
    titleClassName: "text-[#49325e]",
    descriptionClassName: "text-[#6b5687]",
    ctaClassName: "text-[#7c5aa4]",
    rewardClassName: "bg-[#402b52] text-[#f0dcff]",
  },
  legendary: {
    cardClassName:
      "bg-[linear-gradient(145deg,rgba(255,247,236,0.98),rgba(245,214,171,0.93))] text-[#64411d]",
    glowClassName: "bg-[#f3b96b]/42",
    badgeClassName:
      "border border-[#e1b06e]/72 bg-[#fff7ea]/84 text-[#a46a26] shadow-[0_12px_30px_rgba(133,81,28,0.18)]",
    dateClassName: "bg-[#fff5e6]/84 text-[#8f642f] ring-1 ring-[#e5bd86]/60",
    titleClassName: "text-[#65411c]",
    descriptionClassName: "text-[#7e5a2e]",
    ctaClassName: "text-[#b96f22]",
    rewardClassName: "bg-[#5f3922] text-[#ffd9a2]",
  },
};

const rarityExclamationAssets: Record<QuestVisualRarity, string> = {
  common: "/brand/Exclamation-common.png",
  uncommon: "/brand/Exclamation-uncommon.png",
  magic: "/brand/Exclamation-magic.png",
  epic: "/brand/Exclamation-epic.png",
  legendary: "/brand/Exclamation-legendary.png",
};

export function getQuestPreviewPoints(quest: Pick<DashboardQuest, "reward">) {
  return (
    quest.reward.totalPreviewPoints ??
    quest.reward.immediatePoints + (quest.reward.followUpPoints ?? 0)
  );
}

export function getQuestRarityFromPoints(points: number): QuestVisualRarity {
  if (points >= 40) return "legendary";
  if (points >= 30) return "epic";
  if (points >= 25) return "magic";
  if (points >= 20) return "uncommon";
  return "common";
}

export function getQuestVisualCategory(
  quest: Pick<DashboardQuest, "id" | "href">,
): QuestVisualCategory {
  if (quest.id.startsWith("missing-rsvp:") || quest.id === "schedule-meeting") {
    return "meeting";
  }

  if (quest.id.startsWith("missing-vote:")) {
    return "vote";
  }

  if (quest.id.startsWith("missing-play:")) {
    return "chronicle";
  }

  if (quest.id.startsWith("rate-game:")) {
    return "rating";
  }

  return "shelf";
}

export function getQuestVisualRarity(
  quest: Pick<DashboardQuest, "id" | "href">,
): QuestVisualRarity {
  const category = getQuestVisualCategory(quest);

  if (category === "meeting") return "legendary";
  if (category === "vote") return "magic";
  if (category === "chronicle") return "epic";
  if (category === "rating") return "uncommon";
  return "common";
}

export function getQuestIconAsset(quest: Pick<DashboardQuest, "id" | "href">) {
  const rarity = getQuestVisualRarity(quest);
  return rarityExclamationAssets[rarity];
}

export function getQuestVisualVariant(
  quest: Pick<DashboardQuest, "id" | "href">,
): QuestVisualVariant {
  const rarity = getQuestVisualRarity(quest);

  const isMeetingQuest =
    quest.id.startsWith("missing-rsvp:") ||
    quest.id.startsWith("missing-vote:") ||
    quest.id.startsWith("missing-play:") ||
    quest.id === "schedule-meeting" ||
    quest.href.startsWith("/kalendarium");

  return {
    rarity,
    isMeetingQuest,
    exclamationAsset: getQuestIconAsset(quest),
    ...rarityStyles[rarity],
  };
}
