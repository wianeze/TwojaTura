export const ACHIEVEMENT_CATALOG_SIZE = 51;
export const CLASS_REQUIREMENTS_COUNT = 5;

export type AchievementRarity =
  "common" | "rare" | "epic" | "legendary" | "secret";

export type AchievementState = "acquired" | "locked" | "secret";

export type AchievementDefinitionSource = {
  achievementKey: string;
  name: string;
  description: string;
  conditionText: string;
  rarity: string;
  points: number;
  iconPath: string | null;
  isSecret: boolean;
  isManual?: boolean;
  sortOrder: number;
};

export type AchievementAwardSource = {
  userId: string;
  achievementKey: string;
  awardedAt: string;
};

export type AchievementView = {
  key: string;
  name: string;
  description: string;
  conditionText: string;
  rarity: AchievementRarity;
  points: number;
  iconPath: string | null;
  isManual: boolean;
  state: AchievementState;
  awardedAt: string | null;
  progress: import("./achievement-progress").AchievementProgress | null;
  sortOrder: number;
};

export type AchievementBadge = Pick<
  AchievementView,
  "key" | "name" | "iconPath" | "rarity" | "awardedAt"
>;

export type ClassDefinitionSource = {
  classKey: string;
  name: string;
  description: string;
  playstyle: string;
  iconPath: string | null;
  sortOrder: number;
};

export type ClassRequirementSource = {
  classKey: string;
  achievementKey: string;
};

export type ClassRequirementView = {
  key: string;
  name: string;
  state: "acquired" | "locked" | "hidden";
};

export type ActiveClassView = {
  key: string;
  name: string;
  description: string;
  playstyle: string;
  iconPath: string | null;
};

export type ProfileActiveClassSource = {
  userId: string;
  activeClassKey: string | null;
};

export type CharacterClassView = {
  key: string;
  name: string;
  description: string;
  playstyle: string;
  iconPath: string | null;
  acquiredRequirements: number;
  totalRequirements: number;
  unlocked: boolean;
  isActive: boolean;
  requirements: ClassRequirementView[];
  sortOrder: number;
};

const rarityPriority: Record<AchievementRarity, number> = {
  legendary: 4,
  epic: 3,
  rare: 2,
  common: 1,
  secret: 0,
};

function normalizeRarity(rarity: string): AchievementRarity {
  if (
    rarity === "common" ||
    rarity === "rare" ||
    rarity === "epic" ||
    rarity === "legendary" ||
    rarity === "secret"
  ) {
    return rarity;
  }

  return "common";
}

export function mapAchievementCatalog(
  definitions: AchievementDefinitionSource[],
  awards: AchievementAwardSource[],
  currentUserId: string,
  catalogSize = ACHIEVEMENT_CATALOG_SIZE,
  progressByKey: Record<
    string,
    import("./achievement-progress").AchievementProgress
  > = {},
): AchievementView[] {
  const ownAwards = new Map(
    awards
      .filter((award) => award.userId === currentUserId)
      .map((award) => [award.achievementKey, award.awardedAt]),
  );

  const visible = definitions
    .map((definition): AchievementView => {
      const awardedAt = ownAwards.get(definition.achievementKey) ?? null;
      const hidden = definition.isSecret && !awardedAt;

      return {
        key: definition.achievementKey,
        name: hidden ? "Sekretna odznaka" : definition.name,
        description: hidden
          ? "Jej historia pozostaje ukryta."
          : definition.description,
        conditionText: hidden ? "Ukryty warunek" : definition.conditionText,
        rarity: normalizeRarity(definition.rarity),
        points: hidden ? 0 : definition.points,
        iconPath: hidden ? null : definition.iconPath,
        isManual: hidden ? false : Boolean(definition.isManual),
        state: awardedAt ? "acquired" : hidden ? "secret" : "locked",
        awardedAt,
        progress:
          hidden || definition.isManual
            ? null
            : (progressByKey[definition.achievementKey] ?? null),
        sortOrder: definition.sortOrder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const hiddenCount = Math.max(0, catalogSize - definitions.length);
  const hiddenPlaceholders = Array.from(
    { length: hiddenCount },
    (_, index): AchievementView => ({
      key: `hidden-secret-${index + 1}`,
      name: "Sekretna odznaka",
      description: "Jej historia pozostaje ukryta.",
      conditionText: "Ukryty warunek",
      rarity: "secret",
      points: 0,
      iconPath: null,
      isManual: false,
      state: "secret",
      awardedAt: null,
      progress: null,
      sortOrder: Number.MAX_SAFE_INTEGER - hiddenCount + index,
    }),
  );

  return [...visible, ...hiddenPlaceholders];
}

export function mapCharacterClasses(
  classes: ClassDefinitionSource[],
  requirements: ClassRequirementSource[],
  definitions: AchievementDefinitionSource[],
  awards: AchievementAwardSource[],
  currentUserId: string,
  requirementsPerClass = CLASS_REQUIREMENTS_COUNT,
  activeClassKey: string | null = null,
): CharacterClassView[] {
  const definitionNames = new Map(
    definitions.map((definition) => [
      definition.achievementKey,
      definition.name,
    ]),
  );
  const acquired = new Set(
    awards
      .filter((award) => award.userId === currentUserId)
      .map((award) => award.achievementKey),
  );

  return classes
    .map((characterClass): CharacterClassView => {
      const visibleRequirements = requirements
        .filter(
          (requirement) => requirement.classKey === characterClass.classKey,
        )
        .map((requirement): ClassRequirementView => ({
          key: requirement.achievementKey,
          name:
            definitionNames.get(requirement.achievementKey) ?? "Ukryty wymóg",
          state: acquired.has(requirement.achievementKey)
            ? "acquired"
            : "locked",
        }));
      const hiddenCount = Math.max(
        0,
        requirementsPerClass - visibleRequirements.length,
      );
      const hiddenRequirements = Array.from(
        { length: hiddenCount },
        (_, index): ClassRequirementView => ({
          key: `${characterClass.classKey}-hidden-${index + 1}`,
          name: "Ukryty wymóg",
          state: "hidden",
        }),
      );
      const acquiredRequirements = visibleRequirements.filter(
        (requirement) => requirement.state === "acquired",
      ).length;

      return {
        key: characterClass.classKey,
        name: characterClass.name,
        description: characterClass.description,
        playstyle: characterClass.playstyle,
        iconPath: characterClass.iconPath,
        acquiredRequirements,
        totalRequirements: requirementsPerClass,
        unlocked: acquiredRequirements === requirementsPerClass,
        isActive: characterClass.classKey === activeClassKey,
        requirements: [...visibleRequirements, ...hiddenRequirements],
        sortOrder: characterClass.sortOrder,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function mapActiveClassesByUser(
  classes: ClassDefinitionSource[],
  profiles: ProfileActiveClassSource[],
): Record<string, ActiveClassView> {
  const classesByKey = new Map(
    classes.map((characterClass) => [characterClass.classKey, characterClass]),
  );

  return Object.fromEntries(
    profiles.flatMap((profile) => {
      if (!profile.activeClassKey) return [];
      const characterClass = classesByKey.get(profile.activeClassKey);
      if (!characterClass) return [];

      return [
        [
          profile.userId,
          {
            key: characterClass.classKey,
            name: characterClass.name,
            description: characterClass.description,
            playstyle: characterClass.playstyle,
            iconPath: characterClass.iconPath,
          },
        ] as const,
      ];
    }),
  );
}

export function selectTopAchievementBadges(
  definitions: AchievementDefinitionSource[],
  awards: AchievementAwardSource[],
  userId: string,
  limit = 3,
): AchievementBadge[] {
  const definitionsByKey = new Map(
    definitions.map((definition) => [definition.achievementKey, definition]),
  );

  return awards
    .filter((award) => award.userId === userId)
    .map((award) => ({
      award,
      definition: definitionsByKey.get(award.achievementKey),
    }))
    .filter(
      (
        item,
      ): item is {
        award: AchievementAwardSource;
        definition: AchievementDefinitionSource;
      } => Boolean(item.definition && !item.definition.isSecret),
    )
    .sort((a, b) => {
      const rarityDifference =
        rarityPriority[normalizeRarity(b.definition.rarity)] -
        rarityPriority[normalizeRarity(a.definition.rarity)];
      if (rarityDifference !== 0) return rarityDifference;
      return b.award.awardedAt.localeCompare(a.award.awardedAt);
    })
    .slice(0, limit)
    .map(({ award, definition }) => ({
      key: definition.achievementKey,
      name: definition.name,
      iconPath: definition.iconPath,
      rarity: normalizeRarity(definition.rarity),
      awardedAt: award.awardedAt,
    }));
}

export function mapLeaderboardBadges(
  definitions: AchievementDefinitionSource[],
  awards: AchievementAwardSource[],
) {
  const userIds = [...new Set(awards.map((award) => award.userId))];

  return Object.fromEntries(
    userIds.map((userId) => [
      userId,
      selectTopAchievementBadges(definitions, awards, userId),
    ]),
  ) as Record<string, AchievementBadge[]>;
}
