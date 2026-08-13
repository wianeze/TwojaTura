import { GatheringSessionPanel } from "./table-session-gathering-panel";
import { PlayingSessionPanel } from "./table-session-playing-panel";
import { SummarySessionPanel } from "./table-session-summary-panel";
import type { DashboardTableSession } from "./types";

/*
 * Sekcja spotkania na Stole w stanie „wieczór trwa”. To nie jest osobny moduł
 * ani nowa strona — to ten sam kafel spotkania, tyle że po nadejściu godziny
 * przechodzi kolejno przez: drużyna przy stole → GRAMY! → podsumowanie partii.
 * Przed godziną rozpoczęcia panel w ogóle się nie pojawia i Stół wygląda
 * dokładnie tak, jak dotąd.
 *
 * Każdy z trzech stanów ma teraz WŁASNY plik (GatheringSessionPanel,
 * PlayingSessionPanel, SummarySessionPanel) — ten plik jest już wyłącznie
 * dispatcherem, żeby restylizacja jednego stanu nie mogła przypadkiem
 * dotknąć pozostałych. „GRAMY!” i „podsumowanie” dzielą ten sam system
 * wizualny (tło z okładki + poświata zależna od wybranego spotkania,
 * patrz .playing-module w globals.css) — to świadome, bo podsumowanie ma
 * wyglądać jak kolejny stan TEGO SAMEGO modułu, nie jak osobny ekran.
 */
export function TableSessionPanel({
  session,
  autoOpenGamePicker = false,
  sessionAccent = "blue",
}: {
  session: DashboardTableSession;
  /** Ustawiane po „Zmień grę”, żeby picker był od razu otwarty. */
  autoOpenGamePicker?: boolean;
  /**
   * Lewe spotkanie z przełącznika (TableSessionSwitcher) = niebieski,
   * prawe = pomarańczowy — patrz PlayingSessionPanel/SummarySessionPanel.
   * Dotyczy stanów „playing” i „summary”; domyślny „blue” pokrywa też
   * zwykły przypadek jednego spotkania (przełącznik w ogóle się nie
   * pokazuje) — dashboard-showcase.tsx przekazuje w tym przypadku
   * "orange", patrz komentarz tam.
   */
  sessionAccent?: "blue" | "orange";
}) {
  if (session.state === "gathering") {
    return <GatheringSessionPanel session={session} />;
  }

  if (session.state === "playing") {
    return <PlayingSessionPanel session={session} accent={sessionAccent} />;
  }

  return (
    <SummarySessionPanel
      session={session}
      accent={sessionAccent}
      autoOpenGamePicker={autoOpenGamePicker}
    />
  );
}
