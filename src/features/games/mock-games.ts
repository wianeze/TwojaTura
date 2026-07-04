export type MockGameBggData = {
  rank: number;
  rating: number;
  weight: number;
  minAge: number;
  mechanics: string[];
  categories: string[];
  designer: string;
  publisher: string;
  url: string;
};

export type MockGameCommunityData = {
  averageRating: number;
  ratingsCount: number;
  lastPlayedAt: string | null;
  playsCount: number;
  currentUserWantsToPlayAgain: boolean | null;
};

export type MockGame = {
  id: string;
  title: string;
  kicker: string;
  players: string;
  duration: string;
  type: string;
  releaseYear: number;
  description: string;
  coverSrc: string;
  coverRatio: "square" | "portrait";
  coverSize: "tall" | "wide" | "classic" | "slim";
  owner: string;
  currentHolder: string;
  expansions: string[];
  bgg: MockGameBggData;
  community: MockGameCommunityData;
};

export const mockGames: MockGame[] = [
  {
    id: "chaos-w-starym-swiecie",
    title: "Chaos w Starym Świecie",
    kicker: "Bogowie Chaosu walczą o dominację",
    players: "3–4",
    duration: "120 min",
    type: "Strategiczna",
    releaseYear: 2009,
    description:
      "Asymetryczna walka potęg Chaosu o wpływy, spaczenie i panowanie nad Starym Światem.",
    coverSrc: "/games/chaos-old-world.webp",
    coverRatio: "square",
    coverSize: "tall",
    owner: "Przemek",
    currentHolder: "Przemek",
    expansions: ["Szczur Rogaty"],
    bgg: {
      rank: 168,
      rating: 7.7,
      weight: 3.7,
      minAge: 14,
      mechanics: ["Kontrola obszarów", "Asymetria", "Zarządzanie kartami"],
      categories: ["Fantasy", "Strategia", "Wojna"],
      designer: "Eric M. Lang",
      publisher: "Fantasy Flight Games",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 8.6,
      ratingsCount: 4,
      lastPlayedAt: "28 czerwca 2026",
      playsCount: 7,
      currentUserWantsToPlayAgain: true,
    },
  },
  {
    id: "posiadlosc-szalenstwa",
    title: "Posiadłość Szaleństwa",
    kicker: "Śledztwo w cieniu pradawnego zła",
    players: "1–5",
    duration: "120–180 min",
    type: "Przygodowa",
    releaseYear: 2016,
    description:
      "Kooperacyjne śledztwo pełne zagadek, eksploracji i historii rodem z opowieści Lovecrafta.",
    coverSrc: "/games/mansion.webp",
    coverRatio: "square",
    coverSize: "classic",
    owner: "Marta",
    currentHolder: "Michał",
    expansions: ["Ulice Arkham", "Ścieżka Węża"],
    bgg: {
      rank: 87,
      rating: 7.9,
      weight: 2.7,
      minAge: 14,
      mechanics: ["Kooperacja", "Eksploracja", "Rozwiązywanie zagadek"],
      categories: ["Horror", "Przygodowa", "Śledztwo"],
      designer: "Nikki Valens",
      publisher: "Fantasy Flight Games",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 8.2,
      ratingsCount: 5,
      lastPlayedAt: "14 czerwca 2026",
      playsCount: 9,
      currentUserWantsToPlayAgain: true,
    },
  },
  {
    id: "nemesis",
    title: "Nemesis",
    kicker: "Nikt nie usłyszy twojego krzyku",
    players: "1–5",
    duration: "90–180 min",
    type: "Półkooperacyjna",
    releaseYear: 2018,
    description:
      "Napięta wyprawa na pokład uszkodzonego statku, gdzie przetrwanie nie zawsze oznacza współpracę.",
    coverSrc: "/games/nemezis.webp",
    coverRatio: "square",
    coverSize: "wide",
    owner: "Michał",
    currentHolder: "Michał",
    expansions: ["Carnomorphs"],
    bgg: {
      rank: 20,
      rating: 8.3,
      weight: 3.5,
      minAge: 12,
      mechanics: ["Ukryte cele", "Eksploracja", "Rzuty kośćmi"],
      categories: ["Science fiction", "Horror", "Przygodowa"],
      designer: "Adam Kwapiński",
      publisher: "Awaken Realms",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 9,
      ratingsCount: 6,
      lastPlayedAt: "14 czerwca 2026",
      playsCount: 12,
      currentUserWantsToPlayAgain: true,
    },
  },
  {
    id: "this-war-of-mine",
    title: "This War of Mine",
    kicker: "Przetrwanie ma swoją cenę",
    players: "1–6",
    duration: "120 min",
    type: "Narracyjna",
    releaseYear: 2017,
    description:
      "Dojrzała opowieść o grupie cywilów próbujących przetrwać w mieście ogarniętym wojną.",
    coverSrc: "/games/twom.webp",
    coverRatio: "square",
    coverSize: "slim",
    owner: "Ania",
    currentHolder: "Przemek",
    expansions: [],
    bgg: {
      rank: 184,
      rating: 7.8,
      weight: 3.3,
      minAge: 18,
      mechanics: ["Narracja", "Zarządzanie zasobami", "Kooperacja"],
      categories: ["Wojna", "Eksploracja", "Dojrzała tematyka"],
      designer: "Michał Oracz, Jakub Wiśniewski",
      publisher: "Awaken Realms",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 8.1,
      ratingsCount: 3,
      lastPlayedAt: "17 maja 2026",
      playsCount: 4,
      currentUserWantsToPlayAgain: false,
    },
  },
  {
    id: "xcom",
    title: "XCOM",
    kicker: "Globalna obrona w czasie rzeczywistym",
    players: "1–4",
    duration: "60–90 min",
    type: "Kooperacyjna",
    releaseYear: 2015,
    description:
      "Drużynowa obrona Ziemi, w której presja czasu zmusza każdego dowódcę do szybkich decyzji.",
    coverSrc: "/games/xcom.webp",
    coverRatio: "square",
    coverSize: "classic",
    owner: "Przemek",
    currentHolder: "Ania",
    expansions: ["Evolution"],
    bgg: {
      rank: 463,
      rating: 7.1,
      weight: 2.9,
      minAge: 14,
      mechanics: ["Czas rzeczywisty", "Kooperacja", "Rzuty kośćmi"],
      categories: ["Science fiction", "Walka", "Elektronika"],
      designer: "Eric M. Lang",
      publisher: "Fantasy Flight Games",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 7.8,
      ratingsCount: 4,
      lastPlayedAt: "3 maja 2026",
      playsCount: 6,
      currentUserWantsToPlayAgain: true,
    },
  },
  {
    id: "roll-player",
    title: "Roll Player",
    kicker: "Zbuduj bohatera przed pierwszą przygodą",
    players: "1–4",
    duration: "60–90 min",
    type: "Logiczna",
    releaseYear: 2016,
    description:
      "Układanie kości, rozwijanie cech i wyposażanie bohatera zanim właściwa przygoda w ogóle się zacznie.",
    coverSrc: "/games/Rollplayer.webp",
    coverRatio: "portrait",
    coverSize: "tall",
    owner: "Marta",
    currentHolder: "Marta",
    expansions: ["Potwory i Sługusy"],
    bgg: {
      rank: 295,
      rating: 7.5,
      weight: 2.4,
      minAge: 10,
      mechanics: ["Draft kości", "Układanie wzorów", "Zarządzanie kartami"],
      categories: ["Fantasy", "Kości", "Łamigłówka"],
      designer: "Keith Matejka",
      publisher: "Thunderworks Games",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 7.9,
      ratingsCount: 5,
      lastPlayedAt: "7 czerwca 2026",
      playsCount: 10,
      currentUserWantsToPlayAgain: true,
    },
  },
  {
    id: "darkest-dungeon",
    title: "Darkest Dungeon",
    kicker: "Wyprawa na granicy obłędu",
    players: "1–4",
    duration: "120 min",
    type: "Dungeon crawler",
    releaseYear: 2022,
    description:
      "Mroczna kampania o wyprawach w głąb posiadłości, stresie bohaterów i kosztownych zwycięstwach.",
    coverSrc: "/games/darkest.webp",
    coverRatio: "square",
    coverSize: "wide",
    owner: "Michał",
    currentHolder: "Michał",
    expansions: [],
    bgg: {
      rank: 1450,
      rating: 7.9,
      weight: 3.4,
      minAge: 14,
      mechanics: ["Kampania", "Rozwój postaci", "Walka taktyczna"],
      categories: ["Fantasy", "Horror", "Eksploracja"],
      designer: "Zespół Mythic Games",
      publisher: "Mythic Games",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 8,
      ratingsCount: 2,
      lastPlayedAt: null,
      playsCount: 0,
      currentUserWantsToPlayAgain: null,
    },
  },
  {
    id: "frostpunk",
    title: "Frostpunk",
    kicker: "Ostatnie miasto musi przetrwać",
    players: "1–4",
    duration: "120–150 min",
    type: "Strategiczna",
    releaseYear: 2022,
    description:
      "Ciężka gra o zarządzaniu ostatnim miastem ludzkości i decyzjach, które nie mają dobrych odpowiedzi.",
    coverSrc: "/games/frostpunk.webp",
    coverRatio: "square",
    coverSize: "tall",
    owner: "Ania",
    currentHolder: "Ania",
    expansions: ["Lodowe Kry"],
    bgg: {
      rank: 310,
      rating: 8.1,
      weight: 4.2,
      minAge: 16,
      mechanics: ["Zarządzanie zasobami", "Budowanie miasta", "Wydarzenia"],
      categories: ["Postapokalipsa", "Strategia", "Ekonomia"],
      designer: "Adam Kwapiński",
      publisher: "Glass Cannon Unplugged",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 8.7,
      ratingsCount: 5,
      lastPlayedAt: "28 czerwca 2026",
      playsCount: 8,
      currentUserWantsToPlayAgain: true,
    },
  },
  {
    id: "wyspa-skarbow",
    title: "Wyspa Skarbów",
    kicker: "Mapa, blef i zakopany skarb",
    players: "2–5",
    duration: "45 min",
    type: "Dedukcyjna",
    releaseYear: 2018,
    description:
      "Jeden gracz zna położenie skarbu, pozostali kreślą na mapie i próbują przejrzeć jego blef.",
    coverSrc: "/games/treasure-island.webp",
    coverRatio: "square",
    coverSize: "slim",
    owner: "Marta",
    currentHolder: "Przemek",
    expansions: [],
    bgg: {
      rank: 522,
      rating: 7.2,
      weight: 2.1,
      minAge: 10,
      mechanics: ["Dedukcja", "Blef", "Rysowanie na mapie"],
      categories: ["Piraci", "Przygodowa", "Dedukcja"],
      designer: "Marc Paquien",
      publisher: "Matagot",
      url: "https://boardgamegeek.com/",
    },
    community: {
      averageRating: 7.6,
      ratingsCount: 4,
      lastPlayedAt: "31 maja 2026",
      playsCount: 11,
      currentUserWantsToPlayAgain: true,
    },
  },
];
