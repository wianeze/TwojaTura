/*
 * Dane prototypu Button Labu. Świadomie tymczasowe — to nie jest projekt
 * docelowego API ActionButton, tylko materiał do porównania kierunków.
 */

export type LabDirection =
  | "a"
  | "b"
  | "c"
  | "d"
  | "b1"
  | "b2"
  | "b3"
  | "c1"
  | "c2"
  | "c3"
  | "bc3"
  | "bc3m";

// Jasna rodzina wywodząca się z kierunku B — dostaje dodatkową klasę
// .lab-light, która ustawia ciemny tekst i kolorową ikonę.
const lightDirections: LabDirection[] = ["b1", "b2", "b3", "c1", "c2", "c3"];

export type LabAction =
  "meeting" | "vote" | "chronicle" | "rating" | "shelf" | "neutral" | "danger";

export type LabSize = "compact" | "default" | "large" | "hero";

export type LabForcedState = "none" | "hover" | "active" | "focus" | "disabled";

type LabDirectionInfo = {
  id: LabDirection;
  name: string;
  mechanism: string;
  description: string;
};

// Bieżąca ścieżka: wybrany kierunek B — najpierw hybryda z oprawą C3,
// potem jasne odsłony.
export const labDirections: LabDirectionInfo[] = [
  {
    id: "bc3",
    name: "B×C3 — Pieczęć z poświatą",
    mechanism: "Ciemna baza B w oprawie C3",
    description:
      "Pierwotna ciemna baza i radialne światło z kierunku B, ubrane w oprawę gildyjnej pieczęci: podwójna ramka z barwą kategorii na zewnątrz i złotym włosem wewnątrz, dwa heraldyczne ćwieki i skośny złoty połysk przez lico.",
  },
  {
    id: "b1",
    name: "B1 — Jasny metal",
    mechanism: "Barwa w cienkiej ramce",
    description:
      "Kremowo-pergaminowa baza bez własnego koloru. Barwa kategorii istnieje wyłącznie w jednopikselowej metalowej ramce, w ikonie i w poświacie, która budzi się na hover.",
  },
  {
    id: "b2",
    name: "B2 — Miękka emalia",
    mechanism: "Barwa w fazie i połysku",
    description:
      "Ciepła, lekko zabarwiona baza z kolorową fazą u dołu i miękkim połyskiem u góry. Najbardziej „przedmiotowy” z jasnej trójki, wciśnięcie wciska całą emalię do środka.",
  },
  {
    id: "b3",
    name: "B3 — Jasny kamień",
    mechanism: "Barwa w obrysie i mgle",
    description:
      "Prawie biała, matowa powierzchnia. Barwa pojawia się w grubszym obrysie, ikonie i ledwie widocznej mgle u góry. Najspokojniejszy i najbardziej wyciszony.",
  },
  {
    id: "c1",
    name: "C1 — Runiczna oprawa",
    mechanism: "Barwa w metalowej ramce z runami",
    description:
      "Pergaminowy rdzeń oprawiony w kolorową metalową ramkę, a w środku drugi, przerywany pierścień czytający się jak rząd run. Blask rośnie na hover jak przy aktywowanym przedmiocie.",
  },
  {
    id: "c2",
    name: "C2 — Zaklęty kamień",
    mechanism: "Barwa w krysztale i aurze",
    description:
      "Kostna, lekko wklęsła powierzchnia — jakby wyszlifowana. Przy ikonie siedzi mały kolorowy kryształ z własnym blaskiem, a cały przycisk otacza subtelna aura artefaktu.",
  },
  {
    id: "c3",
    name: "C3 — Gildyjna pieczęć",
    mechanism: "Barwa w ozdobnej ramce",
    description:
      "Jasna emaliowana plakietka w podwójnej ramce: kolor kategorii na zewnątrz, złoty włos wewnątrz. Po bokach dwa heraldyczne ćwieki, przez lico przechodzi delikatny złoty połysk.",
  },
];

// Odrzucone i porównawcze — zostawione, domyślnie schowane.
export const labArchivedDirections: LabDirectionInfo[] = [
  {
    id: "bc3m",
    name: "B×C3 — Pieczęć na jaśniejszej bazie",
    mechanism: "Ta sama oprawa, podniesiona baza",
    description:
      "Wariant kontrolny: dokładnie ta sama oprawa, ale baza podniesiona z niemal czarnej na ciepłe ciemne drewno. Wybrana została wersja na oryginalnej ciemnej bazie.",
  },
  {
    id: "b",
    name: "B — Magiczna poświata (baza, za ciemna)",
    mechanism: "Barwa w obramowaniu i świetle",
    description:
      "Punkt wyjścia dla jasnej rodziny B1–B3 i C1–C3: ta sama mechanika (kolor w ramce i poświacie), ale na ciemnej bazie, która okazała się zbyt ciężka.",
  },
  {
    id: "a",
    name: "A — Rzeźbione fantasy",
    mechanism: "Barwa w tłoczeniu i fazie",
    description:
      "Grube obramowanie w jaśniejszym odcieniu barwy, światło od góry i ciemna faza u dołu. Przycisk wygląda na fizycznie osadzony w drewnie.",
  },
  {
    id: "c",
    name: "C — Emaliowane kafle",
    mechanism: "Barwa w powierzchni",
    description:
      "Nasycone wypełnienie z ostrym podziałem połysku w połowie wysokości, twardy ciemny rant i biały włos wewnątrz.",
  },
  {
    id: "d",
    name: "D — Pergamin i złocenie",
    mechanism: "Barwa w akcencie i tekście",
    description:
      "Jedna jasna powierzchnia dla wszystkich wariantów, barwa tylko w dolnym akcencie, obramowaniu, ikonie i kolorze tekstu.",
  },
];

export const labActions: {
  id: LabAction;
  label: string;
  colorName: string;
  symbol: string;
  heroLabel?: string;
  heroShortLabel?: string;
}[] = [
  {
    id: "meeting",
    label: "Dodaj spotkanie",
    colorName: "pomarańczowy",
    symbol: "kalendarz z plusem",
    heroLabel: "Zorganizuj spotkanie",
    heroShortLabel: "Spotkanie",
  },
  {
    id: "vote",
    label: "Zagłosuj na grę",
    colorName: "niebieski",
    symbol: "głos w urnie",
  },
  {
    id: "chronicle",
    label: "Zapisz wynik",
    colorName: "fioletowy",
    symbol: "otwarta księga",
    heroLabel: "Zapisz wynik gry",
    heroShortLabel: "Kronika",
  },
  {
    id: "rating",
    label: "Oceń rozegraną grę",
    colorName: "zielony",
    symbol: "gwiazdka",
  },
  {
    id: "shelf",
    label: "Dodaj grę do Półki",
    colorName: "biały / kość słoniowa",
    symbol: "plus",
    heroLabel: "Dodaj grę do Półki",
    heroShortLabel: "Półka",
  },
  {
    id: "neutral",
    label: "Wróć",
    colorName: "przygaszony taupe",
    symbol: "strzałka w lewo",
  },
  {
    id: "danger",
    label: "Usuń partię",
    colorName: "rdzawa czerwień",
    symbol: "kosz",
  },
];

export const labSizes: { id: LabSize; label: string; note: string }[] = [
  { id: "compact", label: "compact", note: "40 px mobile / 36 px desktop" },
  { id: "default", label: "default", note: "44 px mobile / 42 px desktop" },
  { id: "large", label: "large", note: "50 px mobile / 46 px desktop" },
  { id: "hero", label: "hero", note: "42 px, kafel Stołu 3 kolumny" },
];

export const labForcedStates: { id: LabForcedState; label: string }[] = [
  { id: "none", label: "default" },
  { id: "hover", label: "hover" },
  { id: "active", label: "active" },
  { id: "focus", label: "focus-visible" },
  { id: "disabled", label: "disabled" },
];

export function labButtonClassName(opts: {
  direction: LabDirection;
  action: LabAction;
  size: LabSize;
  className?: string;
}) {
  const { direction, action, size, className = "" } = opts;
  const light = lightDirections.includes(direction) ? " lab-light" : "";
  return `lab-btn lab-dir-${direction} lab-act-${action} lab-size-${size}${light} ${className}`.trim();
}
