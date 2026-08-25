import type { Enums } from "@/types/database.generated";

/**
 * Misje to NOWY system, rozłączny ze Zleceniami.
 *
 * Zlecenie (`DashboardQuest` w module dashboard) to przypomnienie operacyjne
 * płacone Renomą i liczone w całości po stronie TypeScriptu. Misja to wyzwanie
 * gameplayowe wynikające z historii gracza: żyje w bazie jako trwała instancja
 * i płaci Tukatami. Nie mieszamy obu pojęć — kartę współdzielą wyłącznie
 * wizualnie, przez `QuestCard kind="misja"`.
 */
export type MissionType = Enums<"mission_type">;

export type MissionStatus = Enums<"mission_status">;

/** Aktywna Misja gotowa do pokazania na Stole. */
export type DashboardMission = {
  id: string;
  missionType: MissionType;
  gameId: string;
  gameTitle: string;
  generatedAt: string;
  expiresAt: string;
  /** Nagroda zamrożona w chwili wygenerowania, nie odczytana z cennika. */
  rewardTukats: number;
};
