import { Cinzel, EB_Garamond } from "next/font/google";

/*
 * Produkcyjny system typografii — wybrany po porównaniu w /lab/typografia
 * (Cinzel + EB Garamond). Obie rodziny mają potwierdzony subset "latin-ext"
 * (polskie ogonki/kreski: Ą Ć Ę Ł Ń Ś Ź Ż) w font-data.json Next.js.
 *
 * Zakres wag jest szerszy niż docelowa hierarchia (branding 800 / section
 * 700 / card 600 / button 500–600 / body 500) celowo: --font-sans i
 * --font-display trafiają też na sporo istniejącego tekstu z własnymi
 * wagami Tailwind (np. font-bold/font-extrabold na plakietkach statystyk,
 * poza .font-display) — węższy zakres skutkowałby syntetycznym
 * pogrubieniem tam, gdzie nie ma prawdziwego pliku danej wagi.
 *
 * .variable trafia na <html> w layout.tsx; same wartości --font-sans/
 * --font-display (globals.css) wskazują na te zmienne ze starymi stosami
 * jako fallback, nie jako osobny mechanizm.
 */

export const cinzel = Cinzel({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-cinzel",
});

export const ebGaramond = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
  variable: "--font-eb-garamond",
});
