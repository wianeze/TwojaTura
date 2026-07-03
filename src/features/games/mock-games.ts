export type MockGame = {
  id: string;
  title: string;
  kicker: string;
  players: string;
  duration: string;
  type: string;
  rating: string;
  description: string;
  coverSrc: string;
  coverRatio: "square" | "portrait";
  coverSize: "tall" | "wide" | "classic" | "slim";
};

export const mockGames: MockGame[] = [
  {
    id: "chaos-w-starym-swiecie",
    title: "Chaos w Starym Świecie",
    kicker: "Bogowie Chaosu walczą o dominację",
    players: "3–4",
    duration: "120 min",
    type: "Strategiczna",
    rating: "8,2",
    description:
      "Asymetryczna walka potęg Chaosu o wpływy, spaczenie i panowanie nad Starym Światem.",
    coverSrc: "/games/chaos-old-world.webp",
    coverRatio: "square",
    coverSize: "tall",
  },
  {
    id: "posiadlosc-szalenstwa",
    title: "Posiadłość Szaleństwa",
    kicker: "Śledztwo w cieniu pradawnego zła",
    players: "1–5",
    duration: "120–180 min",
    type: "Przygodowa",
    rating: "8,0",
    description:
      "Kooperacyjne śledztwo pełne zagadek, eksploracji i historii rodem z opowieści Lovecrafta.",
    coverSrc: "/games/mansion.webp",
    coverRatio: "square",
    coverSize: "classic",
  },
  {
    id: "nemesis",
    title: "Nemesis",
    kicker: "Nikt nie usłyszy twojego krzyku",
    players: "1–5",
    duration: "90–180 min",
    type: "Półkooperacyjna",
    rating: "8,4",
    description:
      "Napięta wyprawa na pokład uszkodzonego statku, gdzie przetrwanie nie zawsze oznacza współpracę.",
    coverSrc: "/games/nemezis.webp",
    coverRatio: "square",
    coverSize: "wide",
  },
  {
    id: "this-war-of-mine",
    title: "This War of Mine",
    kicker: "Przetrwanie ma swoją cenę",
    players: "1–6",
    duration: "120 min",
    type: "Narracyjna",
    rating: "8,1",
    description:
      "Dojrzała opowieść o grupie cywilów próbujących przetrwać w mieście ogarniętym wojną.",
    coverSrc: "/games/twom.webp",
    coverRatio: "square",
    coverSize: "slim",
  },
  {
    id: "xcom",
    title: "XCOM",
    kicker: "Globalna obrona w czasie rzeczywistym",
    players: "1–4",
    duration: "60–90 min",
    type: "Kooperacyjna",
    rating: "7,8",
    description:
      "Drużynowa obrona Ziemi, w której presja czasu zmusza każdego dowódcę do szybkich decyzji.",
    coverSrc: "/games/xcom.webp",
    coverRatio: "square",
    coverSize: "classic",
  },
  {
    id: "roll-player",
    title: "Roll Player",
    kicker: "Zbuduj bohatera przed pierwszą przygodą",
    players: "1–4",
    duration: "60–90 min",
    type: "Logiczna",
    rating: "7,7",
    description:
      "Układanie kości, rozwijanie cech i wyposażanie bohatera zanim właściwa przygoda w ogóle się zacznie.",
    coverSrc: "/games/Rollplayer.webp",
    coverRatio: "portrait",
    coverSize: "tall",
  },
  {
    id: "darkest-dungeon",
    title: "Darkest Dungeon",
    kicker: "Wyprawa na granicy obłędu",
    players: "1–4",
    duration: "120 min",
    type: "Dungeon crawler",
    rating: "7,9",
    description:
      "Mroczna kampania o wyprawach w głąb posiadłości, stresie bohaterów i kosztownych zwycięstwach.",
    coverSrc: "/games/darkest.webp",
    coverRatio: "square",
    coverSize: "wide",
  },
  {
    id: "frostpunk",
    title: "Frostpunk",
    kicker: "Ostatnie miasto musi przetrwać",
    players: "1–4",
    duration: "120–150 min",
    type: "Strategiczna",
    rating: "8,3",
    description:
      "Ciężka gra o zarządzaniu ostatnim miastem ludzkości i decyzjach, które nie mają dobrych odpowiedzi.",
    coverSrc: "/games/frostpunk.webp",
    coverRatio: "square",
    coverSize: "tall",
  },
  {
    id: "wyspa-skarbow",
    title: "Wyspa Skarbów",
    kicker: "Mapa, blef i zakopany skarb",
    players: "2–5",
    duration: "45 min",
    type: "Dedukcyjna",
    rating: "7,6",
    description:
      "Jeden gracz zna położenie skarbu, pozostali kreślą na mapie i próbują przejrzeć jego blef.",
    coverSrc: "/games/treasure-island.webp",
    coverRatio: "square",
    coverSize: "slim",
  },
];
