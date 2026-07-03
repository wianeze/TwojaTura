export type MockGame = {
  id: string;
  title: string;
  kicker: string;
  players: string;
  duration: string;
  type: string;
  rating: string;
  description: string;
  gradient: string;
  symbol: "mountain" | "harbor" | "lighthouse" | "compass";
};

export const mockGames: MockGame[] = [
  {
    id: "lesny-szlak",
    title: "Leśny Szlak",
    kicker: "Wyprawa przez dziką puszczę",
    players: "2–4",
    duration: "60–90 min",
    type: "Strategiczna",
    rating: "8,6",
    description:
      "Spokojna strategia o wytyczaniu szlaków, odkrywaniu polan i budowaniu wspólnej mapy lasu.",
    gradient: "from-[#31483a] via-[#52674d] to-[#17231d]",
    symbol: "mountain",
  },
  {
    id: "portowe-opowiesci",
    title: "Portowe Opowieści",
    kicker: "Handel, wiatr i dalekie brzegi",
    players: "2–5",
    duration: "45–75 min",
    type: "Ekonomiczna",
    rating: "8,1",
    description:
      "Lekka gra ekonomiczna o rozwijaniu portu i opowieściach przywożonych z dalekich wypraw.",
    gradient: "from-[#28434b] via-[#3f6870] to-[#172b31]",
    symbol: "harbor",
  },
  {
    id: "ostatnia-latarnia",
    title: "Ostatnia Latarnia",
    kicker: "Światło na końcu fiordu",
    players: "1–4",
    duration: "90–120 min",
    type: "Przygodowa",
    rating: "9,0",
    description:
      "Kooperacyjna wyprawa przez zimne wybrzeże, w której każde światło może wskazać drogę do domu.",
    gradient: "from-[#6c3529] via-[#a85737] to-[#2b1c19]",
    symbol: "lighthouse",
  },
  {
    id: "kroniki-szczytu",
    title: "Kroniki Szczytu",
    kicker: "Kto pierwszy odnajdzie przełęcz?",
    players: "3–6",
    duration: "30–45 min",
    type: "Rodzinna",
    rating: "7,9",
    description:
      "Dynamiczna gra rodzinna o planowaniu górskiej trasy i odrobinie przyjaznego blefu.",
    gradient: "from-[#76552d] via-[#ae8242] to-[#3a2819]",
    symbol: "compass",
  },
];
