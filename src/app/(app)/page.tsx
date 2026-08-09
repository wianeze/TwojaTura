import { DashboardShowcase } from "@/features/dashboard/dashboard-showcase";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ gra?: string; meeting?: string }>;
}) {
  // `?gra=wybor` ustawia „Zmień grę”: partia została właśnie zamknięta, więc
  // sekcja ma od razu pokazać wybór kolejnej gry. Intencja jedzie w adresie, a
  // nie w stanie komponentu, bo po zamknięciu partii serwer przerysowuje całą
  // sekcję — lokalny stan by tego nie przeżył, a odświeżenie strony przeżywa.
  //
  // `?meeting=<id>` to wybór z przełącznika równoległych wieczorów. Przekazujemy
  // go dalej BEZ WERYFIKACJI tutaj — waliduje go getTableSession, dopasowując
  // do listy spotkań, w których widz faktycznie uczestniczy. Obcy identyfikator
  // nie ma tam czego trafić i po cichu wraca domyślny wybór.
  const { gra, meeting } = await searchParams;

  return (
    <DashboardShowcase
      autoOpenGamePicker={gra === "wybor"}
      preferredMeetingId={meeting ?? null}
    />
  );
}
