export type QaScenario = {
  email: string;
  password: string;
  label: string;
  expected: string[];
};

export const QA_PASSWORD = "QaAchievements123!";

export const QA_SCENARIOS: QaScenario[] = [
  {
    email: "qa-achievements-near@twojatura.local",
    password: QA_PASSWORD,
    label: "Progi tuż przed odblokowaniem",
    expected: [
      "bag_of_holding 49/50",
      "party_bard 9/10",
      "fanboy 4/5",
      "one_more_turn 19/20",
      "guidance 9/10",
      "coast_chronicler 24/25",
      "camp_host 4/5",
      "dark_urge 2/3",
    ],
  },
  {
    email: "qa-achievements-coop@twojatura.local",
    password: QA_PASSWORD,
    label: "Trzy kooperacyjne zwycięstwa 1/1/1",
    expected: ["natural_one 0/3", "dark_urge 3/3 i odznaka zdobyta"],
  },
  {
    email: "qa-achievements-loot-near@twojatura.local",
    password: QA_PASSWORD,
    label: "Próg kolekcji tuż przed odblokowaniem",
    expected: ["loot_goblin 24/25"],
  },
  {
    email: "qa-achievements-ready@twojatura.local",
    password: QA_PASSWORD,
    label: "Odblokowane progi i automatyczne odznaki",
    expected: [
      "loot_goblin 25/25",
      "bag_of_holding 50/50",
      "party_bard 10/10",
      "fanboy 5/5",
      "one_more_turn 20/20",
      "guidance 10/10",
      "coast_chronicler 25/25",
      "natural_one 3/3",
      "dark_urge 3/3",
      "camp_host 5/5",
      "critical_roll, full_party, lone_wolf, side_quest",
    ],
  },
  {
    email: "qa-achievements-last-one@twojatura.local",
    password: QA_PASSWORD,
    label: "Naturalna Jedynka: pierwszy ostatni wynik",
    expected: ["natural_one 1/3"],
  },
  {
    email: "qa-achievements-last-two@twojatura.local",
    password: QA_PASSWORD,
    label: "Naturalna Jedynka: drugi ostatni wynik",
    expected: ["natural_one 2/3"],
  },
  {
    email: "qa-achievements-streak-broken@twojatura.local",
    password: QA_PASSWORD,
    label: "Mroczna Żądza: przerwana seria",
    expected: ["dark_urge bez odznaki (seria nie jest ciągła)"],
  },
  {
    email: "qa-achievements-class-locked@twojatura.local",
    password: QA_PASSWORD,
    label: "Klasa z czterema z pięciu wymagań",
    expected: ["Bard Stołu 4/5"],
  },
  {
    email: "qa-achievements-class-ready@twojatura.local",
    password: QA_PASSWORD,
    label: "Odblokowana i aktywna klasa",
    expected: ["Bard Stołu 5/5", "Bard Stołu jako aktywna klasa"],
  },
];

export function assertQaEnvironment(
  environment: NodeJS.ProcessEnv = process.env,
  url?: string,
) {
  if (environment.NODE_ENV === "production") {
    throw new Error("QA odznak jest zablokowane w środowisku produkcyjnym.");
  }

  if (url) {
    const hostname = new URL(url).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      throw new Error(
        "QA odznak może łączyć się wyłącznie z lokalnym Supabase.",
      );
    }
  }
}
