export type BggExpansionSuggestion = {
  id: string;
  name: string;
};

export type BggGameDetails = {
  title: string;
  gameType: string | null;
  coverUrl: string | null;
  bggRank: number | null;
  minPlayers: number | null;
  maxPlayers: number | null;
  playTimeMinutes: number | null;
  releaseYear: number | null;
  mechanics: string[];
  categories: string[];
  bggWeight: number | null;
  minAge: number | null;
  designer: string | null;
  publisher: string | null;
  description: string | null;
  expansionSuggestions: BggExpansionSuggestion[];
};

export type BggAutofillValues = {
  title: string;
  gameType: string;
  coverUrl: string;
  bggRank: string;
  minPlayers: string;
  maxPlayers: string;
  playTimeMinutes: string;
  releaseYear: string;
  mechanics: string;
  categories: string;
  bggWeight: string;
  minAge: string;
  designer: string;
  publisher: string;
  description: string;
};

export const BGG_AUTOFILL_FIELD_NAMES = [
  "title",
  "gameType",
  "coverUrl",
  "bggRank",
  "minPlayers",
  "maxPlayers",
  "playTimeMinutes",
  "releaseYear",
  "mechanics",
  "categories",
  "bggWeight",
  "minAge",
  "designer",
  "publisher",
  "description",
] as const satisfies readonly (keyof BggAutofillValues)[];

const ALLOWED_BGG_HOSTS = new Set([
  "boardgamegeek.com",
  "www.boardgamegeek.com",
  "api.geekdo.com",
]);

function decodeEntities(value: string) {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
    nbsp: " ",
    mdash: "—",
    ndash: "–",
    hellip: "…",
  };

  return value.replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (entity, code: string) => {
      if (code.startsWith("#x")) {
        return String.fromCodePoint(Number.parseInt(code.slice(2), 16));
      }

      if (code.startsWith("#")) {
        return String.fromCodePoint(Number.parseInt(code.slice(1), 10));
      }

      return namedEntities[code.toLowerCase()] ?? entity;
    },
  );
}

function readAttribute(tag: string, attribute: string) {
  const match = tag.match(
    new RegExp(`\\b${attribute}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"),
  );
  return match ? decodeEntities(match[1] ?? match[2] ?? "") : null;
}

function findOpeningTags(xml: string, tagName: string) {
  return xml.match(new RegExp(`<${tagName}\\b[^>]*>`, "gi")) ?? [];
}

function findElementText(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i"),
  );
  return match?.[1]?.trim() ?? null;
}

function findValueNumber(xml: string, tagName: string) {
  const tag = findOpeningTags(xml, tagName)[0];
  const value = tag ? readAttribute(tag, "value") : null;
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function findLinkValues(xml: string, type: string) {
  return findOpeningTags(xml, "link")
    .filter((tag) => readAttribute(tag, "type") === type)
    .map((tag) => readAttribute(tag, "value")?.trim() ?? "")
    .filter(Boolean);
}

function unique(values: string[]) {
  return [...new Set(values)];
}

function normalizeExpansionName(name: string) {
  return name.trim().toLocaleLowerCase("pl-PL");
}

export function cleanBggExpansionName(
  expansionName: string,
  baseGameTitle: string,
) {
  const originalName = expansionName.trim();
  const normalizedBaseTitle = baseGameTitle.trim();
  let cleanedName = originalName;

  if (
    normalizedBaseTitle &&
    cleanedName
      .toLocaleLowerCase("pl-PL")
      .startsWith(normalizedBaseTitle.toLocaleLowerCase("pl-PL"))
  ) {
    cleanedName = cleanedName.slice(normalizedBaseTitle.length);
    cleanedName = cleanedName.replace(/^\s*(?:\u2013|\u2014|:|-)\s*/, "");
  }

  cleanedName = cleanedName
    .replace(/\s*\(Expansion\)\s*$/i, "")
    .replace(/\s+Expansion\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleanedName || originalName;
}

export function getBggExpansionPreview(
  expansionNames: string[],
  baseGameTitle: string,
  limit = 4,
) {
  const names = [
    ...new Map(
      expansionNames.map((name) => {
        const cleanedName = cleanBggExpansionName(name, baseGameTitle);
        return [normalizeExpansionName(cleanedName), cleanedName] as const;
      }),
    ).values(),
  ];

  return {
    names: names.slice(0, limit),
    remainingCount: Math.max(names.length - limit, 0),
  };
}

export function deduplicateBggExpansionSuggestions(
  suggestions: BggExpansionSuggestion[],
) {
  const seen = new Set<string>();

  return suggestions.filter((suggestion) => {
    const normalizedName = normalizeExpansionName(suggestion.name);
    if (!suggestion.id || !normalizedName || seen.has(normalizedName)) {
      return false;
    }

    seen.add(normalizedName);
    return true;
  });
}

export function createBggExpansionDrafts(
  existingNames: string[],
  suggestions: BggExpansionSuggestion[],
) {
  const names = new Set(existingNames.map(normalizeExpansionName));

  return deduplicateBggExpansionSuggestions(suggestions)
    .filter((suggestion) => !names.has(normalizeExpansionName(suggestion.name)))
    .map((suggestion) => ({ name: suggestion.name, isOwned: false }));
}

export function deriveGameTypeFromBggData(
  mechanics: string[],
  categories: string[],
) {
  const hasValue = (values: string[], value: string) =>
    values.some((item) => item.trim().toLowerCase() === value.toLowerCase());

  if (hasValue(mechanics, "Semi-Cooperative Game")) {
    return "Semi-kooperacyjna";
  }

  if (hasValue(mechanics, "Cooperative Game")) {
    return "Kooperacyjna";
  }

  if (hasValue(categories, "Party Game")) {
    return "Imprezowa";
  }

  if (hasValue(mechanics, "Card Game") || hasValue(categories, "Card Game")) {
    return "Karciana";
  }

  if (hasValue(mechanics, "Solo / Solitaire Game")) {
    return "Solo";
  }

  return null;
}

function parsePositiveInteger(value: string | null) {
  if (!value || !/^\d+$/.test(value)) return null;
  const parsed = Number.parseInt(value, 10);
  return parsed > 0 ? parsed : null;
}

function cleanDescription(rawDescription: string | null) {
  if (!rawDescription) return null;

  const withoutHtml = decodeEntities(rawDescription)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const cleaned = decodeEntities(withoutHtml)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

  return cleaned || null;
}

export function extractBggGameId(value: string) {
  let url: URL;

  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }

  if (
    !["http:", "https:"].includes(url.protocol) ||
    !ALLOWED_BGG_HOSTS.has(url.hostname.toLowerCase())
  ) {
    return null;
  }

  const queryId = url.searchParams.get("id");
  if (queryId && /^\d+$/.test(queryId)) return queryId;

  return (
    url.pathname.match(
      /\/(?:boardgame|boardgameexpansion|thing)\/(\d+)(?:\/|$)/i,
    )?.[1] ?? null
  );
}

export function parseBggThingXml(xml: string): BggGameDetails {
  const primaryNameTag = findOpeningTags(xml, "name").find(
    (tag) => readAttribute(tag, "type") === "primary",
  );
  const title = primaryNameTag
    ? readAttribute(primaryNameTag, "value")?.trim()
    : null;

  if (!title) {
    throw new Error("BGG nie zwróciło danych gry dla podanego linku.");
  }

  const rankTag = findOpeningTags(xml, "rank").find(
    (tag) => readAttribute(tag, "name") === "boardgame",
  );
  const image = findElementText(xml, "image");
  const thumbnail = findElementText(xml, "thumbnail");
  const designerNames = unique(findLinkValues(xml, "boardgamedesigner"));
  const publisherNames = unique(findLinkValues(xml, "boardgamepublisher"));

  const expansionSuggestions = deduplicateBggExpansionSuggestions(
    findOpeningTags(xml, "link")
      .filter((tag) => readAttribute(tag, "type") === "boardgameexpansion")
      .map((tag) => ({
        id: readAttribute(tag, "id") ?? "",
        name: cleanBggExpansionName(
          readAttribute(tag, "value")?.trim() ?? "",
          title,
        ),
      }))
      .filter((item) => item.id && item.name),
  );

  const mechanics = unique(findLinkValues(xml, "boardgamemechanic"));
  const categories = unique(findLinkValues(xml, "boardgamecategory"));

  return {
    title,
    gameType: deriveGameTypeFromBggData(mechanics, categories),
    coverUrl: image
      ? decodeEntities(image)
      : thumbnail
        ? decodeEntities(thumbnail)
        : null,
    bggRank: parsePositiveInteger(
      rankTag ? readAttribute(rankTag, "value") : null,
    ),
    minPlayers: findValueNumber(xml, "minplayers"),
    maxPlayers: findValueNumber(xml, "maxplayers"),
    playTimeMinutes: findValueNumber(xml, "playingtime"),
    releaseYear: findValueNumber(xml, "yearpublished"),
    mechanics,
    categories,
    bggWeight: findValueNumber(xml, "averageweight"),
    minAge: findValueNumber(xml, "minage"),
    designer: designerNames.length > 0 ? designerNames.join(", ") : null,
    publisher: publisherNames.length > 0 ? publisherNames.join(", ") : null,
    description: cleanDescription(findElementText(xml, "description")),
    expansionSuggestions,
  };
}

export function toBggAutofillValues(
  details: BggGameDetails,
): BggAutofillValues {
  const numberValue = (value: number | null) => value?.toString() ?? "";

  return {
    title: details.title,
    gameType: details.gameType ?? "",
    coverUrl: details.coverUrl ?? "",
    bggRank: numberValue(details.bggRank),
    minPlayers: numberValue(details.minPlayers),
    maxPlayers: numberValue(details.maxPlayers),
    playTimeMinutes: numberValue(details.playTimeMinutes),
    releaseYear: numberValue(details.releaseYear),
    mechanics: details.mechanics.join(", "),
    categories: details.categories.join(", "),
    bggWeight: numberValue(details.bggWeight),
    minAge: numberValue(details.minAge),
    designer: details.designer ?? "",
    publisher: details.publisher ?? "",
    description: details.description ?? "",
  };
}

export function mergeBggAutofillValues(
  current: BggAutofillValues,
  details: BggGameDetails,
  overwrite = false,
) {
  const incoming = toBggAutofillValues(details);
  const merged = { ...current };

  for (const field of BGG_AUTOFILL_FIELD_NAMES) {
    if (overwrite || !current[field].trim()) {
      merged[field] = incoming[field];
    }
  }

  return merged;
}
