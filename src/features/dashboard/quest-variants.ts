import type { DashboardQuest } from "./types";

export type QuestVisualRarity =
  "common" | "uncommon" | "magic" | "epic" | "legendary";

/**
 * Rodzaj karty questa: Zlecenie (nagroda w Renomie, jedyny rodzaj generowany
 * dziś przez `buildDashboardQuests`) albo Misja (nagroda w Tukatach). Misja
 * jest na razie wyłącznie wizualnym wariantem `QuestCard` — quests.ts nie zna
 * tego rozróżnienia i nie przyznaje Tukatów, więc żadna prawdziwa karta go
 * dziś nie używa. Gotowe do podpięcia, gdy powstanie realna logika Misji.
 */
export type QuestCardKind = "zlecenie" | "misja";

export type QuestVisualVariant = {
  rarity: QuestVisualRarity;
  isMeetingQuest: boolean;
  exclamationAsset: string;
  glowStrongColor: string;
  glowSoftColor: string;
  glowStrongHoverColor: string;
  glowSoftHoverColor: string;
  labelClassName: string;
  titleClassName: string;
  descriptionClassName: string;
  ctaClassName: string;
  /** Kolor tekstu nagrody ("+X Renomy"/"+X Tukatów") — ten sam atrament co tytuł. */
  rewardTextClassName: string;
};

type QuestVisualCategory =
  "meeting" | "vote" | "chronicle" | "rating" | "shelf";

/**
 * Tło karty (pergamin) — WSPÓLNE dla wszystkich rarity w danym rodzaju karty
 * (Zlecenie/Misja). Rzadkość różni już tylko poświata (.quest-glow) i kolory
 * tekstu niżej, nie sam asset ramy — inaczej niż w poprzednim systemie
 * ramek fantasy, gdzie każda rarity miała własny plik ramki.
 *
 * ŹRÓDŁO: public/assets/zlecenie-bacground.png (nazwa pliku ma literówkę w
 * samym assecie — "bacground", nie "background") i
 * public/assets/misja-card-background.png — pochodna dostarczonego
 * misja-background.png, przycięta do faktycznie namalowanej treści (2172×720
 * zamiast 2172×1578: dolne ~60% oryginalnego płótna jest w pełni
 * przezroczyste, więc nieprzycięty 9-slice renderowałby przezroczysty dół
 * karty).
 */
export const QUEST_CARD_BACKGROUND: Record<QuestCardKind, string> = {
  zlecenie: "/assets/zlecenie-bacground.png",
  misja: "/assets/misja-card-background.png",
};

/**
 * `border-image-slice` (piksele źródła, ta sama wartość dla wszystkich 4
 * stron). Musi objąć zarówno rowek ozdobnej linii (~85–105px od krawędzi),
 * jak i klejnot na jej końcu (~165–180px od lewej/prawej) — 200px daje
 * bezpieczny zapas przy obu assetach, a środek jest jednolitym pergaminem,
 * więc hojny slice niczego nie psuje (brak powtarzalnego wzoru do rozjechania).
 */
export const QUEST_CARD_SLICE = 200;

/**
 * Ile pikseli źródła od lewej krawędzi jest jeszcze przezroczystych, zanim
 * zacznie się widoczny pergamin (mierzone na wysokości środka karty) — patrz
 * analogiczny komentarz przy emblematem w action-card.tsx. Różne dla obu
 * assetów, bo mają inny margines przycięcia.
 */
export const QUEST_CARD_EDGE_INSET: Record<QuestCardKind, number> = {
  zlecenie: 17,
  misja: 43,
};

const rarityStyles: Record<
  QuestVisualRarity,
  Omit<QuestVisualVariant, "rarity" | "isMeetingQuest" | "exclamationAsset">
> = {
  common: {
    glowStrongColor: "rgba(248,228,194,0.65)",
    glowSoftColor: "rgba(248,228,194,0.32)",
    glowStrongHoverColor: "rgba(248,228,194,0.9)",
    glowSoftHoverColor: "rgba(248,228,194,0.55)",
    labelClassName: "text-[#8b5d31]",
    titleClassName: "text-[#4b3326]",
    descriptionClassName: "text-[#6f5540]",
    ctaClassName: "text-[#8b5d31]",
    rewardTextClassName: "text-[#4b3326]",
  },
  uncommon: {
    glowStrongColor: "rgba(141,178,139,0.65)",
    glowSoftColor: "rgba(141,178,139,0.32)",
    glowStrongHoverColor: "rgba(141,178,139,0.9)",
    glowSoftHoverColor: "rgba(141,178,139,0.55)",
    labelClassName: "text-[#557351]",
    titleClassName: "text-[#35533a]",
    descriptionClassName: "text-[#557055]",
    ctaClassName: "text-[#49734b]",
    rewardTextClassName: "text-[#35533a]",
  },
  magic: {
    glowStrongColor: "rgba(137,191,232,0.65)",
    glowSoftColor: "rgba(137,191,232,0.32)",
    glowStrongHoverColor: "rgba(137,191,232,0.9)",
    glowSoftHoverColor: "rgba(137,191,232,0.55)",
    labelClassName: "text-[#355d7d]",
    titleClassName: "text-[#21435c]",
    descriptionClassName: "text-[#496a86]",
    ctaClassName: "text-[#2e6b99]",
    rewardTextClassName: "text-[#21435c]",
  },
  epic: {
    glowStrongColor: "rgba(173,134,210,0.65)",
    glowSoftColor: "rgba(173,134,210,0.32)",
    glowStrongHoverColor: "rgba(173,134,210,0.9)",
    glowSoftHoverColor: "rgba(173,134,210,0.55)",
    labelClassName: "text-[#76539b]",
    titleClassName: "text-[#49325e]",
    descriptionClassName: "text-[#6b5687]",
    ctaClassName: "text-[#7c5aa4]",
    rewardTextClassName: "text-[#49325e]",
  },
  legendary: {
    glowStrongColor: "rgba(243,185,107,0.65)",
    glowSoftColor: "rgba(243,185,107,0.32)",
    glowStrongHoverColor: "rgba(243,185,107,0.9)",
    glowSoftHoverColor: "rgba(243,185,107,0.55)",
    labelClassName: "text-[#a46a26]",
    titleClassName: "text-[#65411c]",
    descriptionClassName: "text-[#7e5a2e]",
    ctaClassName: "text-[#b96f22]",
    rewardTextClassName: "text-[#65411c]",
  },
};

const rarityExclamationAssets: Record<QuestVisualRarity, string> = {
  common: "/brand/Exclamation-common.png",
  uncommon: "/brand/Exclamation-uncommon.png",
  magic: "/brand/Exclamation-magic.png",
  epic: "/brand/Exclamation-epic.png",
  legendary: "/brand/Exclamation-legendary.png",
};

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
