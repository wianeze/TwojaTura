import type { DashboardQuest } from "./types";

export type QuestVisualRarity =
  "common" | "uncommon" | "magic" | "epic" | "legendary";

export type QuestVisualVariant = {
  rarity: QuestVisualRarity;
  isMeetingQuest: boolean;
  exclamationAsset: string;
  /** Cała karta questa — ramka 9-slice, patrz .quest-card-frame w globals.css. */
  cardFrameAsset: string;
  /**
   * `border-image-slice` dla cardFrameAsset, w pikselach źródła. Per rarity, bo
   * mastery mają realnie różne rozmiary (1254×1254 i 1536×1024) i różny zasięg
   * motywu narożnika — jedna wspólna wartość przecinałaby część rogów w połowie.
   * Podawane do CSS jako `--quest-frame-slice`.
   */
  cardFrameSlice: number;
  /**
   * Ile pikseli ŹRÓDŁA po lewej stronie assetu jest jeszcze przezroczystych,
   * zanim zacznie się widoczna ramka (mierzone na wysokości środka karty).
   * Krawędź border-boxa to x=0 assetu, ale oko widzi krawędź dopiero za tym
   * marginesem — bez korekty emblemat centrowany na border-boxie wypadał
   * o 0.3–6px w lewo od widocznej ramki. Podawane do CSS jako
   * `--quest-frame-edge` i przeliczane przez slice na piksele karty.
   */
  cardFrameEdgeInset: number;
  /**
   * Ozdobny akcent na środku górnej i dolnej krawędzi ramki (dolny to ten sam
   * plik obrócony przez scaleY(-1)) — patrz .quest-card-accent w globals.css.
   * Overlay dekoracyjny: `position: absolute`, więc nie wpływa na wysokość
   * karty ani nie rozciąga ramki.
   *
   * Wszystkie rarity używają wariantu `*-quest-accent-epic.png` z
   * public/assets/quests/ — różni je wyłącznie barwa, zgodna z rarity.
   */
  accentAsset: string;
  /**
   * Asset dla DWÓCH bocznych, mniejszych akcentów — celowo INNY plik niż
   * accentAsset: wariant `*-quest-accent.png` (bez `-epic`). Środkowy duży
   * akcent nadal używa accentAsset (`-epic`).
   */
  accentAssetSm: string;
  /**
   * O ile pikseli odsunąć akcent na ZEWNĄTRZ karty względem środka pasa ramy
   * (górny w górę, dolny w dół). Per rarity, bo ornamenty mają różną ilość
   * pustego marginesu w pliku i przy wspólnej wartości siadały na ramie
   * nierówno. Podawane do CSS jako `--quest-accent-offset`.
   */
  accentOffset: number;
  /**
   * To samo co accentOffset, ale WYŁĄCZNIE dla dwóch bocznych, mniejszych
   * akcentów (środkowy duży nadal używa accentOffset). Osobne pole, bo
   * czasem trzeba doregulować tylko boczne bez ruszania środkowego — np.
   * przy mniejszym akcencie ta sama wartość offsetu co dla dużego wizualnie
   * sadza go bliżej ramy niż duży. Podawane do CSS jako
   * `--quest-accent-offset-sm`.
   */
  accentOffsetSm: number;
  /**
   * Mnożnik wysokości akcentu względem grubości pasa ramy. Per rarity, bo
   * ornamenty mają różne proporcje płótna — przy wspólnym mnożniku (wysokość
   * jest wspólna, więc o szerokości decyduje aspekt pliku) biały i
   * pomarańczowy wychodziły wizualnie drobniejsze od reszty.
   * Podawane do CSS jako `--quest-accent-scale`.
   */
  accentScale: number;
  /**
   * Plakietka „+X Renomy" — TA SAMA plakietka co ActionButton
   * (public/assets/buttons/*.png, czyli znormalizowane pod 9-slice
   * *-button-new), renderowana identycznym mechanizmem `border-image-slice:
   * 92 fill`, tylko w mniejszej skali. Bez żadnego dedykowanego assetu nagrody.
   */
  badgePlateAsset: string;
  /** Bliższa, mocniejsza warstwa drop-shadow poświaty karty — patrz .quest-glow w globals.css. */
  glowStrongColor: string;
  /** Dalsza, miększa warstwa tej samej poświaty. */
  glowSoftColor: string;
  /** Te same barwy co glowStrongColor, wyższa alfa — używane na hover/focus. */
  glowStrongHoverColor: string;
  /** Te same barwy co glowSoftColor, wyższa alfa — używane na hover/focus. */
  glowSoftHoverColor: string;
  badgeClassName: string;
  dateClassName: string;
  titleClassName: string;
  descriptionClassName: string;
  ctaClassName: string;
  /** Kolor tekstu „+X Renomy” w plakietce — dobrany pod jasność tła badgePlateAsset. */
  rewardTextClassName: string;
};

type QuestVisualCategory =
  "meeting" | "vote" | "chronicle" | "rating" | "shelf";

const rarityStyles: Record<
  QuestVisualRarity,
  Omit<
    QuestVisualVariant,
    | "rarity"
    | "isMeetingQuest"
    | "exclamationAsset"
    | "cardFrameAsset"
    | "cardFrameSlice"
    | "cardFrameEdgeInset"
    | "accentAsset"
    | "accentAssetSm"
    | "accentOffset"
    | "accentOffsetSm"
    | "accentScale"
    | "badgePlateAsset"
  >
> = {
  common: {
    glowStrongColor: "rgba(248,228,194,0.65)",
    glowSoftColor: "rgba(248,228,194,0.32)",
    glowStrongHoverColor: "rgba(248,228,194,0.9)",
    glowSoftHoverColor: "rgba(248,228,194,0.55)",
    badgeClassName:
      "border border-[#d7b68a]/70 bg-white/78 text-[#8b5d31] shadow-[0_10px_24px_rgba(108,70,39,0.14)]",
    dateClassName: "bg-white/78 text-[#7a5438] ring-1 ring-[#d9c0a0]/55",
    titleClassName: "text-[#4b3326]",
    descriptionClassName: "text-[#6f5540]",
    ctaClassName: "text-[#8b5d31]",
    rewardTextClassName: "text-[#5a3a22]",
  },
  uncommon: {
    glowStrongColor: "rgba(141,178,139,0.65)",
    glowSoftColor: "rgba(141,178,139,0.32)",
    glowStrongHoverColor: "rgba(141,178,139,0.9)",
    glowSoftHoverColor: "rgba(141,178,139,0.55)",
    badgeClassName:
      "border border-[#9ebd9a]/72 bg-[#f4fbf2]/84 text-[#557351] shadow-[0_12px_28px_rgba(63,97,56,0.16)]",
    dateClassName: "bg-[#f5fbf2]/80 text-[#5d7559] ring-1 ring-[#abc6a5]/55",
    titleClassName: "text-[#35533a]",
    descriptionClassName: "text-[#557055]",
    ctaClassName: "text-[#49734b]",
    rewardTextClassName: "text-[#ddf0d7]",
  },
  magic: {
    glowStrongColor: "rgba(137,191,232,0.65)",
    glowSoftColor: "rgba(137,191,232,0.32)",
    glowStrongHoverColor: "rgba(137,191,232,0.9)",
    glowSoftHoverColor: "rgba(137,191,232,0.55)",
    badgeClassName:
      "border border-[#8cb8d6]/70 bg-[#eff8ff]/82 text-[#355d7d] shadow-[0_10px_26px_rgba(63,108,145,0.18)]",
    dateClassName: "bg-[#f3fbff]/84 text-[#476886] ring-1 ring-[#9fc4dc]/55",
    titleClassName: "text-[#21435c]",
    descriptionClassName: "text-[#496a86]",
    ctaClassName: "text-[#2e6b99]",
    rewardTextClassName: "text-[#d7eeff]",
  },
  epic: {
    glowStrongColor: "rgba(173,134,210,0.65)",
    glowSoftColor: "rgba(173,134,210,0.32)",
    glowStrongHoverColor: "rgba(173,134,210,0.9)",
    glowSoftHoverColor: "rgba(173,134,210,0.55)",
    badgeClassName:
      "border border-[#b698d5]/72 bg-[#fbf6ff]/84 text-[#76539b] shadow-[0_12px_28px_rgba(86,60,118,0.18)]",
    dateClassName: "bg-[#faf4ff]/84 text-[#6f5891] ring-1 ring-[#c1abdb]/55",
    titleClassName: "text-[#49325e]",
    descriptionClassName: "text-[#6b5687]",
    ctaClassName: "text-[#7c5aa4]",
    rewardTextClassName: "text-[#f0dcff]",
  },
  legendary: {
    glowStrongColor: "rgba(243,185,107,0.65)",
    glowSoftColor: "rgba(243,185,107,0.32)",
    glowStrongHoverColor: "rgba(243,185,107,0.9)",
    glowSoftHoverColor: "rgba(243,185,107,0.55)",
    badgeClassName:
      "border border-[#e1b06e]/72 bg-[#fff7ea]/84 text-[#a46a26] shadow-[0_12px_30px_rgba(133,81,28,0.18)]",
    dateClassName: "bg-[#fff5e6]/84 text-[#8f642f] ring-1 ring-[#e5bd86]/60",
    titleClassName: "text-[#65411c]",
    descriptionClassName: "text-[#7e5a2e]",
    ctaClassName: "text-[#b96f22]",
    rewardTextClassName: "text-[#ffd9a2]",
  },
};

/**
 * Plakietka Renomy = plakietka ActionButtona. public/assets/buttons/*.png to
 * znormalizowane pod 9-slice wersje *-button-new (patrz komentarz przy
 * .action-btn w globals.css) — te same pliki, których używają wszystkie
 * przyciski w aplikacji, więc zero dedykowanych assetów nagrody.
 */
const rarityBadgePlateAssets: Record<QuestVisualRarity, string> = {
  common: "/assets/buttons/white.png",
  uncommon: "/assets/buttons/green.png",
  magic: "/assets/buttons/blue.png",
  epic: "/assets/buttons/purple.png",
  legendary: "/assets/buttons/orange.png",
};

/**
 * Pochodna dostarczonych masterów public/assets/quests/*-quest-poprawione.png,
 * generowana jednym skryptem: spłaszczone 4 pasy krawędzi + usunięte tło spoza
 * ramy. Rogi nietknięte. Szczegóły — patrz komentarz przy .quest-card-frame
 * w globals.css.
 */
const rarityCardFrameAssets: Record<QuestVisualRarity, string> = {
  common: "/assets/quests/white-quest-frame.png",
  uncommon: "/assets/quests/green-quest-frame.png",
  magic: "/assets/quests/blue-quest-frame.png",
  epic: "/assets/quests/purple-quest-frame.png",
  legendary: "/assets/quests/orange-quest-frame.png",
};

/**
 * Zmierzony zasięg motywu narożnika + zapas, per master (patrz cardFrameSlice).
 * Blue i Orange to pliki 1536×1024, reszta 1254×1254 — stąd realnie różne
 * wartości.
 */
const rarityCardFrameSlices: Record<QuestVisualRarity, number> = {
  // 300, nie 330 — ta sama poprawka co przy zielonym: biały master ma cieńszy
  // pas ramy niż fioletowy, więc przy wspólnym slice renderował się o ~30%
  // cieniej. Mniejszy slice skaluje ramę w górę: 35.2 * 88/300 = 10.3px wobec
  // 35.2 * 102/325 = 11.1px fioletowego.
  //
  // Nie schodzić do 270. Zmierzony zasięg rogu to dokładnie 270, ale slice
  // równy zasięgowi zostawia zero zapasu: zwężenie wspornika dochodzi wtedy
  // do samej granicy bloku rogu, a 90-pikselowy crossfade tuż za nią wciąż
  // niesie oryginalną grafikę — która w pasie krawędzi jest rozciągana
  // poziomo ~4x mocniej niż blok rogu. Róg czyta się wtedy jako rozjechany.
  // 30px zapasu to załatwia (zielony ma analogicznie 265 przy zasięgu 255).
  common: 300,
  // 265, nie 325: zielony master ma cieńszy ciemny pas niż fioletowy, więc
  // przy wspólnym slice renderował się niemal o połowę cieniej. Mniejszy
  // slice skaluje ramę w górę: 35.2 * 56/265 = 7.4px wobec 35.2 * 65/325
  // = 7.0px fioletowego.
  //
  // 265 to DOLNA granica — motyw rogu sięga 255px i slice musi go zmieścić
  // w CAŁOŚCI. Przy 235 jego ogon wypadał już w pasie krawędzi, który jest
  // rozciągany poziomo do szerokości karty, przez co róg wychodził
  // rozjechany. Skrypt ostrzega, gdy slice < zasięg rogu.
  //
  // Dodatkowo `crop = 15` w scripts/build-quest-frames.ps1 — bez niego flood
  // fill usuwający czarne tło zjadał zewnętrzną złotą listwę tego assetu.
  uncommon: 265,
  // 270, nie 355 — ta sama poprawka co przy zielonym i białym: niebieski
  // master ma cienki pas ramy (63 wiersze), więc przy dużym slice renderował
  // się na 53% grubości fioletowego. 35.2 * 63/270 = 8.2px wobec 11.1px.
  //
  // Tu potrzebna była DODATKOWA zmiana: złoty zawijas rogu ciągnie się wzdłuż
  // górnej krawędzi aż do ~345px, więc sam slice nie mógł zejść poniżej 355
  // bez wypchnięcia go w rozciągany poziomo pas. Rozwiązanie to `fade = 8`
  // w scripts/build-quest-frames.ps1: wąski crossfade wycina zawijas czysto
  // na granicy bloku rogu, zamiast przenosić go do pasa i rozciągać.
  magic: 270,
  epic: 325,
  legendary: 275,
};

/**
 * Patrz cardFrameEdgeInset. Zmierzone na wysokości środka karty w każdym
 * wygenerowanym assecie: ile pikseli źródła po lewej jest jeszcze
 * przezroczystych, zanim zacznie się widoczna ramka. Wartości realnie się
 * różnią (2–46px), bo mastery mają różne marginesy i różny `crop`.
 */
const rarityCardFrameEdgeInsets: Record<QuestVisualRarity, number> = {
  common: 33,
  uncommon: 46,
  magic: 2,
  epic: 34,
  legendary: 10,
};

/**
 * Patrz accentAsset. WSZYSTKIE rarity używają wariantu `-epic` — różni je
 * wyłącznie barwa, zgodna z rarity. W katalogu leżą też skromniejsze
 * `*-quest-accent.png`, ale nie są używane.
 */
const rarityAccentAssets: Record<QuestVisualRarity, string> = {
  common: "/assets/quests/white-quest-accent-epic.png",
  uncommon: "/assets/quests/green-quest-accent-epic.png",
  magic: "/assets/quests/blue-quest-accent-epic.png",
  epic: "/assets/quests/purple-quest-accent-epic.png",
  legendary: "/assets/quests/orange-quest-accent-epic.png",
};

/**
 * Patrz accentAssetSm — wariant BEZ `-epic`, wyłącznie dla dwóch bocznych
 * akcentów. Środkowy duży nadal bierze `-epic` z rarityAccentAssets wyżej.
 */
const rarityAccentAssetsSm: Record<QuestVisualRarity, string> = {
  common: "/assets/quests/white-quest-accent.png",
  uncommon: "/assets/quests/green-quest-accent.png",
  magic: "/assets/quests/blue-quest-accent.png",
  epic: "/assets/quests/purple-quest-accent.png",
  legendary: "/assets/quests/orange-quest-accent.png",
};

/**
 * Patrz accentOffset. Wartości dobrane wizualnie per ornament — pliki mają
 * różną ilość pustego marginesu i różne proporcje, więc przy wspólnej wartości
 * siadały na ramie nierówno. Biały (powiększony do 1.45) potrzebuje
 * największego odsunięcia, niebieski nieco większego niż reszta.
 */
const rarityAccentOffsets: Record<QuestVisualRarity, number> = {
  common: 6,
  uncommon: 3,
  magic: 8,
  epic: 3,
  legendary: 6,
};

/**
 * Patrz accentOffsetSm. Boczne akcenty białego/niebieskiego/fioletowego/
 * pomarańczowego dostały +2px względem swojego accentOffset (dalej od ramy
 * niż duży); zielony zostaje przy tej samej wartości co duży.
 */
const rarityAccentOffsetsSm: Record<QuestVisualRarity, number> = {
  common: 8,
  uncommon: 3,
  magic: 10,
  epic: 5,
  legendary: 8,
};

/**
 * Patrz accentScale. Biały i pomarańczowy dostają większy mnożnik — ich pliki
 * są proporcjonalnie niższe/węższe, więc przy wspólnym 1.15 ornament czytał
 * się drobniej niż w pozostałych rarity.
 */
const rarityAccentScales: Record<QuestVisualRarity, number> = {
  common: 1.45,
  uncommon: 1.15,
  magic: 1.15,
  epic: 1.15,
  legendary: 1.45,
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
    cardFrameAsset: rarityCardFrameAssets[rarity],
    cardFrameSlice: rarityCardFrameSlices[rarity],
    cardFrameEdgeInset: rarityCardFrameEdgeInsets[rarity],
    accentAsset: rarityAccentAssets[rarity],
    accentAssetSm: rarityAccentAssetsSm[rarity],
    accentOffset: rarityAccentOffsets[rarity],
    accentOffsetSm: rarityAccentOffsetsSm[rarity],
    accentScale: rarityAccentScales[rarity],
    badgePlateAsset: rarityBadgePlateAssets[rarity],
    ...rarityStyles[rarity],
  };
}
