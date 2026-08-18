import { redirect } from "next/navigation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { QuestCard } from "@/features/dashboard/action-card";
import type { DashboardQuest } from "@/features/dashboard/types";

// TYMCZASOWA strona deweloperska do podglądu kart Zlecenia/Misja — tylko
// development, brak wpływu na produkcyjną logikę/dane. Nie commitować.

const QUESTS: { label: string; quest: DashboardQuest }[] = [
  {
    label: "common, bez nagrody",
    quest: {
      id: "add-first-game",
      type: "action",
      title: "Dodaj pierwszą grę",
      description: "Zacznij budować Półkę.",
      href: "/gry/nowa",
      ctaLabel: "Dodaj grę",
      priority: 3,
    },
  },
  {
    label: "uncommon, z Renomą",
    quest: {
      id: "rate-game:play-1:game-1",
      type: "question",
      title: "Oceń ostatnio rozegraną grę",
      description: "Nemesis",
      href: "/gry/game-1",
      ctaLabel: "Dodaj opinię",
      renownPoints: 3,
      priority: 3,
    },
  },
  {
    label: "magic, z Renomą",
    quest: {
      id: "missing-vote:m1",
      type: "question",
      title: "W co chcesz zagrać?",
      description: "Wieczór planszówkowy · 12.08.2026 · 19:00",
      href: "/kalendarium/m1",
      ctaLabel: "Odpowiedz",
      renownPoints: 1,
      priority: 2,
    },
  },
  {
    label: "epic, z Renomą",
    quest: {
      id: "missing-play:m1",
      type: "action",
      title: "Uzupełnij wynik spotkania",
      description: "Wieczór planszówkowy",
      href: "/kronika/nowa?meeting=m1",
      ctaLabel: "Zapisz wynik gry",
      renownPoints: 5,
      priority: 1,
    },
  },
  {
    label: "legendary, bez nagrody (jak w referencji)",
    quest: {
      id: "schedule-meeting",
      type: "action",
      title: "Zaproponuj spotkanie",
      description: "Zwołaj ekipę na kolejny wieczór.",
      href: "/kalendarium/nowe",
      ctaLabel: "Zorganizuj spotkanie",
      priority: 3,
    },
  },
  {
    label: "legendary, z Renomą",
    quest: {
      id: "missing-rsvp:m1",
      type: "question",
      title: "Będziesz na spotkaniu?",
      description: "Wieczór planszówkowy · 12.08.2026 · 19:00",
      href: "/kalendarium/m1",
      ctaLabel: "Odpowiedz",
      renownPoints: 2,
      priority: 2,
    },
  },
];

export default async function QuestLabPage() {
  const memberState = await getCurrentMember();

  if (
    memberState.status !== "active-member" ||
    memberState.member.role !== "admin"
  ) {
    redirect("/");
  }

  return (
    <div className="space-y-6 p-4">
      <header>
        <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          Dokumentacja · tylko administrator · tylko development
        </p>
        <h1 className="font-display text-cream mt-2 text-2xl font-semibold">
          Quest lab
        </h1>
        <p className="mt-2 max-w-2xl text-[0.8rem] text-[#d8c7b1]">
          Podgląd aktualnego <code>QuestCard</code> (
          <code>src/features/dashboard/action-card.tsx</code>) z aktualnymi
          assetami — bez kopii komponentu, bez wpływu na dane. Trasa nie ma
          odnośnika w nawigacji.
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="font-display text-cream text-lg font-semibold">
          Zlecenie — rarity × nagroda
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          {QUESTS.map(({ label, quest }) => (
            <div key={quest.id} className="space-y-1">
              <p className="text-xs text-white/70">{label}</p>
              <QuestCard
                quest={quest}
                isPrimary={quest.id === "schedule-meeting"}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-display text-cream text-lg font-semibold">
          Misja (wariant wizualny, Tukaty)
        </h2>
        <div className="grid gap-2 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-xs text-white/70">
              misja, epic, jedna nagroda (linia nad i pod)
            </p>
            <QuestCard
              quest={QUESTS[3].quest}
              kind="misja"
              tukatyAmounts={[50]}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-white/70">
              misja, common, jedna nagroda (linia nad i pod)
            </p>
            <QuestCard
              quest={QUESTS[0].quest}
              kind="misja"
              tukatyAmounts={[20]}
            />
          </div>
          <div className="space-y-1">
            <p className="text-xs text-white/70">
              misja, magic, dwie nagrody (tylko linia między nimi)
            </p>
            <QuestCard
              quest={QUESTS[2].quest}
              kind="misja"
              tukatyAmounts={[50, 20]}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
