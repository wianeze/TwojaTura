/**
 * Współdzielona logika opóźnienia stagger dla animacji wejścia
 * (`.anim-rise-in-fast` w globals.css) — używana przez Półkę i
 * Legendarium (ranking, "Jak zdobywać łupy", odznaki, klasy), żeby
 * nie kopiować tej samej stałej/formuły w każdym komponencie osobno.
 */
export const ENTRANCE_STAGGER_STEP_MS = 80;
export const ENTRANCE_STAGGER_MAX_COUNT = 18;

/**
 * Elementy do indeksu ENTRANCE_STAGGER_MAX_COUNT-1 dostają rosnące
 * opóźnienie co ENTRANCE_STAGGER_STEP_MS. Elementy powyżej limitu
 * dostają opóźnienie RÓWNE maksymalnemu (nie 0ms) — inaczej wchodziłyby
 * przed elementami z końca sekwencji staggera, odwracając kolejność
 * wizualną.
 */
export function getEntranceStaggerDelayMs(index: number) {
  const cappedIndex = Math.min(index, ENTRANCE_STAGGER_MAX_COUNT - 1);
  return cappedIndex * ENTRANCE_STAGGER_STEP_MS;
}
