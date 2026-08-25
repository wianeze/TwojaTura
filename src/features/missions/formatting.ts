import type { DashboardMission } from "./types";

const DAY_MS = 86_400_000;

/**
 * Termin ważności Misji.
 *
 * Świadomie INNY język niż `formatQuestExpiryLabel` dla Zleceń („Przepada
 * za…”). Zlecenie faktycznie przepada — razem z nagrodą za czynność, której
 * nikt już nie wykona na czas. Wygaśnięcie Misji nie jest porażką i niczego nie
 * zabiera, więc etykieta mówi o oknie możliwości, a nie o stracie.
 *
 * Zwraca `null` po terminie: taka karta i tak nie powinna trafić do renderu,
 * bo odczyt Stołu filtruje Misje po `expires_at`.
 */
export function formatMissionExpiryLabel(expiresAt: string, now = new Date()) {
  const remainingMs = new Date(expiresAt).getTime() - now.getTime();
  if (!Number.isFinite(remainingMs) || remainingMs <= 0) return null;

  if (remainingMs < DAY_MS) return "Ostatni dzień";
  if (remainingMs < 2 * DAY_MS) return "Ważna jeszcze 1 dzień";

  return `Ważna jeszcze ${Math.floor(remainingMs / DAY_MS)} dni`;
}

export function isMissionActive(
  mission: Pick<DashboardMission, "expiresAt">,
  now = new Date(),
) {
  return new Date(mission.expiresAt).getTime() > now.getTime();
}
