export type LegendariumReward = {
  points: string;
  title: string;
  condition: string;
  limit: string;
};

export const activeRewards = [
  {
    points: "+10",
    title: "Pierwsza gra",
    condition: "Dodaj pierwszy fizyczny egzemplarz do wsp\u00f3lnej P\u00f3\u0142ki.",
    limit: "Raz na gracza.",
  },
  {
    points: "+15",
    title: "5 gier",
    condition: "Osi\u0105gnij pr\u00f3g 5 aktywnych gier jako opiekun egzemplarzy.",
    limit: "Raz na gracza.",
  },
  {
    points: "+20",
    title: "10 gier",
    condition: "Osi\u0105gnij pr\u00f3g 10 aktywnych gier jako opiekun egzemplarzy.",
    limit: "Raz na gracza.",
  },
  {
    points: "+25",
    title: "15 gier",
    condition: "Osi\u0105gnij pr\u00f3g 15 aktywnych gier jako opiekun egzemplarzy.",
    limit: "Raz na gracza.",
  },
  {
    points: "+2",
    title: "Odpowied\u017a",
    condition: "Daj zna\u0107, czy b\u0119dziesz na zaproszonym spotkaniu.",
    limit: "Raz na spotkanie.",
  },
  {
    points: "+1",
    title: "G\u0142os",
    condition: "Oddaj g\u0142os w ankiecie gry dla danego spotkania.",
    limit: "Raz na spotkanie.",
  },
  {
    points: "+3",
    title: "Ocena gry",
    condition: "Dodaj pierwsz\u0105 ocen\u0119 danej gry.",
    limit: "Raz na gr\u0119.",
  },
  {
    points: "+5",
    title: "Udzia\u0142 w partii",
    condition: "We\u017a udzia\u0142 w uko\u0144czonej partii zapisanej w Kronice.",
    limit: "Za uko\u0144czon\u0105 parti\u0119.",
  },
  {
    points: "+5",
    title: "Gospodarz spotkania",
    condition: "Doprowad\u017a zorganizowane przez siebie spotkanie do ko\u0144ca.",
    limit: "Za uko\u0144czone spotkanie.",
  },
] as const satisfies readonly LegendariumReward[];

export const achievementRewardNotice =
  "Osi\u0105gni\u0119cia r\u00f3wnie\u017c dodaj\u0105 Renom\u0119. Ich nagrody s\u0105 opisane przy konkretnych odznakach.";
