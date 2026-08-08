import { ActionLink } from "@/components/ui/action-button";
import { GameCover } from "@/components/ui/game-cover";
import type { MeetingContinuablePlay } from "./types";

type MeetingContinuationSummaryProps = {
  play: MeetingContinuablePlay;
};

/*
  Wariant sekcji „gry na wieczór” dla spotkania, które kontynuuje rozpoczętą
  partię. Zajmuje DOKŁADNIE to samo miejsce co MeetingGameProposals i powtarza
  jego szkielet nagłówka (eyebrow + tytuł + włos separatora), bo z perspektywy
  kartki spotkania to wciąż ta sama sekcja — zmienia się tylko jej treść.

  Świadomie NIE ma tu głosowania ani „Proponuj grę”: gra na ten wieczór jest już
  ustalona. Wcześniejsze propozycje zostają nietknięte w bazie — po zdjęciu
  kontynuacji w edycji spotkania standardowa sekcja wraca razem z nimi.

  Brak własnego panelu/karty pod spodem: treść leży wprost na pergaminie
  (.meeting-form-sheet), a jedynym mocnym elementem jest okładka. Dlatego
  size="card" — ta sama ramka co przy okładkach eksponowanych na Stole i w
  szczegółach partii, wyraźnie większa niż „micro” z listy propozycji.
*/
export function MeetingContinuationSummary({
  play,
}: MeetingContinuationSummaryProps) {
  const stateNote = play.stateNote?.trim();

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <div>
          <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#a3703f] uppercase">
            Wieczór przy stole
          </p>
          <h2 className="font-display mt-1 text-[1.35rem] font-semibold text-[#4a3018] sm:text-[1.5rem]">
            Kontynuujemy partię
          </h2>
        </div>
        <span
          aria-hidden="true"
          className="block h-px bg-[#8b6743]/70 shadow-[0_1px_0_rgba(255,255,255,0.5)]"
        />
      </div>

      {/* items-start, nie items-center: przy dłuższej notatce o stanie gry
          kolumna tekstu rośnie w dół i okładka ma zostać przy górnej krawędzi,
          a nie odjechać na środek. */}
      <div className="flex items-start gap-4 sm:gap-5">
        <div className="w-[clamp(6.5rem,32%,10rem)] shrink-0">
          <GameCover
            title={play.gameTitle}
            coverUrl={play.coverUrl}
            size="card"
            fitParent
            className="w-full"
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-display text-[1.15rem] leading-tight font-semibold text-[#43291a] sm:text-[1.35rem]">
            {play.gameTitle}
          </p>

          <p className="mt-1.5 text-[0.85rem] text-[#6c5644]">
            Dokańczamy rozpoczętą partię.
          </p>

          {stateNote ? (
            <p className="mt-2 text-[0.8rem] leading-5 text-[#7a6048] italic">
              {stateNote}
            </p>
          ) : null}

          <div className="mt-3.5">
            <ActionLink
              action="chronicle"
              size="compact"
              href={`/kronika/${play.playId}`}
            >
              Wróć do partii
            </ActionLink>
          </div>
        </div>
      </div>
    </div>
  );
}
