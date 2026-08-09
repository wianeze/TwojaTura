import type { CSSProperties } from "react";

/*
 * Wspólny system kolorów dla przełączników "tak/nie" w Kalendarium — RSVP
 * (Będę / Nie mogę) i głosowanie na grę (Chcę grać / Nie chcę grać) mówią
 * tym samym językiem: positive = zielony, negative = czerwony, zawsze z
 * lekkim tintem nawet w stanie nieaktywnym, żeby opcja była czytelna, zanim
 * ktokolwiek ją wybierze. Jeden punkt prawdy zamiast duplikowania tych
 * samych klas w dwóch komponentach.
 *
 * Kolor obramowania idzie przez inline `style`, nie przez Tailwindową klasę
 * `border-[...]`: globalna, NIELAYEROWANA reguła `* { border-color: var(--border) }`
 * (globals.css) bije każdą warstwowaną utility Tailwinda niezależnie od
 * specyficzności, więc `border-[#5c6d59]` renderowałby się jako neutralny
 * `--border` i zielono/czerwony tint nigdy nie byłby widoczny na obramowaniu.
 * Inline style ma najwyższy priorytet i tę regułę bezwarunkowo bije.
 */
export type SegmentedTone = "positive" | "negative";

const BORDER_COLORS = {
  positive: {
    active: "#5c6d59",
    inactive: "rgba(143, 176, 140, 0.55)",
  },
  negative: {
    active: "#8f3528",
    inactive: "rgba(208, 154, 144, 0.55)",
  },
} as const satisfies Record<
  SegmentedTone,
  { active: string; inactive: string }
>;

export function segmentedOptionClasses(tone: SegmentedTone, active: boolean) {
  if (tone === "positive") {
    return active
      ? "bg-moss text-white"
      : "bg-[#e3efe0] text-[#3d6340] hover:bg-[#d7e8d2]";
  }

  return active
    ? "bg-[#8f3528] text-white"
    : "bg-[#f7e2df] text-[#8f3528] hover:bg-[#f1d2cc]";
}

export function segmentedOptionStyle(
  tone: SegmentedTone,
  active: boolean,
): CSSProperties {
  return {
    borderColor: BORDER_COLORS[tone][active ? "active" : "inactive"],
  };
}
