import {
  Alegreya,
  Alegreya_SC,
  Berkshire_Swash,
  Cardo,
  Cinzel,
  Cormorant_Garamond,
  Cormorant_Infant,
  Cormorant_SC,
  Crimson_Pro,
  Crimson_Text,
  Domine,
  EB_Garamond,
  Grenze_Gotisch,
  Lora,
  Piedra,
  Pirata_One,
  Quintessential,
  Spectral,
  Spectral_SC,
  Vollkorn,
} from "next/font/google";

/*
 * TYMCZASOWE ładowanie fontów dla /lab/typografia — patrz
 * typography-lab-switcher.tsx i typography-lab.css. Nie dotyczy
 * produkcyjnego systemu typografii (--font-sans/--font-display w
 * globals.css) i nie jest z nim w żaden sposób połączone.
 *
 * Każda rodzina/odmiana niżej ma potwierdzony subset "latin-ext" w
 * font-data.json Next.js (to on faktycznie decyduje, co self-hostuje
 * next/font/google) — stąd wybór akurat tych pięciu rodzin zamiast np. IM
 * Fell czy Uncial Antiqua, które w Google Fonts nie mają żadnej odmiany z
 * polskimi ogonkami/kreskami. "latin" samo w sobie pokrywa tylko Ó/ó —
 * dlatego zawsze proszę o oba subsety naraz.
 *
 * Każde wywołanie zostaje przy WYŁĄCZNIE tych wagach/stylach, których
 * realnie używa hierarchia w typography-lab.css — next/font ładuje
 * iloczyn weight×style, więc szersze niż potrzebne listy tu = niepotrzebne
 * pliki fontów w tej jednej, deweloperskiej trasie.
 */

const alegreya = Alegreya({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal"],
  variable: "--font-lab-alegreya",
});

const alegreyaSc = Alegreya_SC({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "700", "800", "900"],
  style: ["normal"],
  variable: "--font-lab-alegreya-sc",
});

const cinzel = Cinzel({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-lab-cinzel",
});

const ebGaramond = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  style: ["normal"],
  variable: "--font-lab-eb-garamond",
});

// Osobne wywołanie na kursywę 400 (secondary/opis) — bez tego next/font
// ładowałby iloczyn 500×{normal,italic} i 400×{normal,italic} naraz, czyli
// dwa pliki nigdy nieużywane w tej hierarchii.
const ebGaramondSecondary = EB_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-eb-garamond-secondary",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["600"],
  style: ["normal"],
  variable: "--font-lab-cormorant-garamond",
});

const cormorantGaramondSecondary = Cormorant_Garamond({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-cormorant-garamond-secondary",
});

const cormorantSc = Cormorant_SC({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  style: ["normal"],
  variable: "--font-lab-cormorant-sc",
});

const cormorantInfant = Cormorant_Infant({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  style: ["normal"],
  variable: "--font-lab-cormorant-infant",
});

const spectral = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["500"],
  style: ["normal"],
  variable: "--font-lab-spectral",
});

const spectralSecondary = Spectral({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-spectral-secondary",
});

const spectralSc = Spectral_SC({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  style: ["normal"],
  variable: "--font-lab-spectral-sc",
});

const lora = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal"],
  variable: "--font-lab-lora",
});

const loraSecondary = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-lora-secondary",
});

/*
 * Druga fala — 5 fantasy/gotyckich wariantów. Cztery z pięciu (Pirata One,
 * Berkshire Swash, Piedra, Quintessential) mają w font-data.json Next.js
 * DOKŁADNIE jedną wagę (400, styl normal) — to prawdziwe, jednowagowe fonty
 * dekoracyjne, nie da się z nich samych zbudować 6-poziomowej hierarchii.
 * Niosą więc WYŁĄCZNIE warstwę display/branding (jedyny <h1> na stronie) —
 * dokładnie tam, gdzie realnie ktoś użyłby takiego kroju (tytuł/logo, nigdy
 * cały system UI) — a pozostałych 5 warstw dostaje osobny, czytelny kompan
 * z latin-ext i realnym zakresem wag. Piąty, Grenze Gotisch, jest
 * wyjątkiem: to wariable font 100–900 z pełnym subsetem, więc sam niesie 4
 * górne warstwy (jak Cinzel wcześniej) — gotycki krój nawet przy lekkiej
 * wadze słabo się czyta w dłuższym tekście, więc body/secondary i tak
 * dostają kompana (Cardo).
 */

const grenzeGotisch = Grenze_Gotisch({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-lab-grenze-gotisch",
});

const cardo = Cardo({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-lab-cardo",
});

const cardoSecondary = Cardo({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-cardo-secondary",
});

const pirataOne = Pirata_One({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-lab-pirata-one",
});

const vollkorn = Vollkorn({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  style: ["normal"],
  variable: "--font-lab-vollkorn",
});

const vollkornSecondary = Vollkorn({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-vollkorn-secondary",
});

const berkshireSwash = Berkshire_Swash({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-lab-berkshire-swash",
});

const crimsonPro = Crimson_Pro({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
  style: ["normal"],
  variable: "--font-lab-crimson-pro",
});

const crimsonProSecondary = Crimson_Pro({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-crimson-pro-secondary",
});

const piedra = Piedra({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-lab-piedra",
});

// Domine nie ma kursywy w ogóle (żadna waga) — secondary różni się od body
// wyłącznie wagą/rozmiarem, nie stylem. Jedno wywołanie starcza, bo bez
// kursywy next/font nie dokłada iloczynu stylów.
const domine = Domine({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-lab-domine",
});

const quintessential = Quintessential({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--font-lab-quintessential",
});

// Crimson Text ma tylko 3 statyczne cięcia (400/600/700, nie wariable) —
// 600/700 na jedno wywołanie (section/card/button), 400 osobno na body i
// osobno na kursywę secondary.
const crimsonText = Crimson_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700"],
  style: ["normal"],
  variable: "--font-lab-crimson-text",
});

const crimsonTextBody = Crimson_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["normal"],
  variable: "--font-lab-crimson-text-body",
});

const crimsonTextSecondary = Crimson_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  style: ["italic"],
  variable: "--font-lab-crimson-text-secondary",
});

/** Jeden string klas `.variable` do nałożenia na wspólny wrapper — każda
 * z nich tylko definiuje zmienną CSS, nie ustawia sama z siebie żadnego
 * font-family (o to dopiero dba typography-lab.css). */
export const typographyLabFontVariables = [
  alegreya.variable,
  alegreyaSc.variable,
  cinzel.variable,
  ebGaramond.variable,
  ebGaramondSecondary.variable,
  cormorantGaramond.variable,
  cormorantGaramondSecondary.variable,
  cormorantSc.variable,
  cormorantInfant.variable,
  spectral.variable,
  spectralSecondary.variable,
  spectralSc.variable,
  lora.variable,
  loraSecondary.variable,
  grenzeGotisch.variable,
  cardo.variable,
  cardoSecondary.variable,
  pirataOne.variable,
  vollkorn.variable,
  vollkornSecondary.variable,
  berkshireSwash.variable,
  crimsonPro.variable,
  crimsonProSecondary.variable,
  piedra.variable,
  domine.variable,
  quintessential.variable,
  crimsonText.variable,
  crimsonTextBody.variable,
  crimsonTextSecondary.variable,
].join(" ");
