import type { DashboardQuest } from "@/features/dashboard/types";
import type { DashboardMission, MissionType } from "./types";

/**
 * Warstwa prezentacji Misji.
 *
 * Reguły (wyzwalacz, TTL, cooldown, nagroda, priorytet) mieszkają w SQL —
 * `private.mission_policy` jest ich jedynym źródłem prawdy. Tutaj żyje
 * WYŁĄCZNIE copy i wygląd, dokładnie tak jak `quests.ts` trzyma copy Zleceń.
 * Nagrody nie liczymy: karta pokazuje `reward_amount` zamrożone przy
 * generowaniu, więc zmiana cennika nie unieważnia obietnicy już pokazanej
 * graczowi.
 */
type MissionCopy = {
  /** Nazwa Misji — pierwsza część tytułu karty. */
  name: string;
  /** Krótki opis wyzwania. Bez technicznych wyzwalaczy i cooldownów. */
  challenge: string;
};

export const MISSION_COPY: Record<MissionType, MissionCopy> = {
  revenge: {
    name: "Rewanż",
    challenge: "Wygraj kolejną partię tej gry.",
  },
  resurrection: {
    name: "Wskrzeszenie",
    challenge: "Wróć do gry, w którą nie grałeś od dawna.",
  },
  first_chapter: {
    name: "Pierwszy Rozdział",
    challenge: "Rozegraj swoją pierwszą partię tej gry.",
  },
  continue_story: {
    name: "Dokończ Historię",
    challenge: "Wróć do odłożonej gry.",
  },
};

/**
 * Kolejność na Stole. Lustro kolumny `priority` z `private.mission_policy` —
 * ta sama hierarchia, w której generator wybiera Misje.
 */
export const MISSION_PRIORITY: Record<MissionType, number> = {
  revenge: 1,
  resurrection: 2,
  first_chapter: 3,
  continue_story: 4,
};

/**
 * Klimatyczny pusty stan. Brak Misji to poprawny stan grupy grającej raz w
 * miesiącu, więc tekst nie popycha do sztucznej aktywności — po prostu mówi,
 * skąd biorą się wyzwania.
 */
export const MISSIONS_EMPTY_STATE =
  "Przy Stole panuje spokój. Kolejne wyzwania przyniosą następne rozgrywki.";

/**
 * Identyfikator karty. Format `mission-<typ>:<gra>` nie jest kosmetyczny —
 * czyta go `questMetadata` w quest-tracking-link.tsx, dopasowując telemetrię
 * do whitelisty kluczy z katalogu analitycznego.
 */
export function getMissionQuestId(mission: DashboardMission) {
  return `mission-${mission.missionType}:${mission.gameId}`;
}

/**
 * Misja w kształcie, którego oczekuje współdzielona `QuestCard`.
 *
 * Świadomie BEZ `renownPoints`: Misje nie płacą Renomą, a karta rysuje nagrodę
 * tylko wtedy, gdy pole istnieje. Tukaty przekazuje osobny prop `tukatyAmounts`
 * przy `kind="misja"`.
 */
export function toMissionQuestCard(mission: DashboardMission): DashboardQuest {
  const copy = MISSION_COPY[mission.missionType];

  return {
    id: getMissionQuestId(mission),
    type: "action",
    tone: "action",
    title: `${copy.name}: ${mission.gameTitle}`,
    description: copy.challenge,
    href: `/gry/${mission.gameId}`,
    ctaLabel: "Zobacz grę",
    priority: MISSION_PRIORITY[mission.missionType],
    expiresAt: mission.expiresAt,
    createdAt: mission.generatedAt,
  };
}

export function sortDashboardMissions(missions: DashboardMission[]) {
  return [...missions].sort((left, right) => {
    const byPriority =
      MISSION_PRIORITY[left.missionType] - MISSION_PRIORITY[right.missionType];
    if (byPriority !== 0) return byPriority;

    return (
      new Date(left.generatedAt).getTime() -
      new Date(right.generatedAt).getTime()
    );
  });
}
