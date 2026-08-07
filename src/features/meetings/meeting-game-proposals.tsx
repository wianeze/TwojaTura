"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import { GameCover } from "@/components/ui/game-cover";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { proposeMeetingGameAction } from "./actions";
import { formatMeetingGameResponseCounts } from "./formatting";
import { MeetingGameResponseToggle } from "./meeting-game-response-toggle";
import type { MeetingGameCandidateOption, MeetingGameVoteItem } from "./types";

type MeetingGameProposalsProps = {
  meetingId: string;
  games: MeetingGameVoteItem[];
  availableGames: MeetingGameCandidateOption[];
};

export function MeetingGameProposals({
  meetingId,
  games,
  availableGames,
}: MeetingGameProposalsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const filteredGames = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
    if (!normalizedQuery) return availableGames;

    return availableGames.filter((game) =>
      game.title.toLocaleLowerCase("pl-PL").includes(normalizedQuery),
    );
  }, [availableGames, query]);

  const handlePropose = (gameId: string) => {
    startTransition(async () => {
      const result = await proposeMeetingGameAction(meetingId, gameId);
      setMessage(result.status === "error" ? (result.message ?? null) : null);

      if (result.status === "success") {
        setIsOpen(false);
        setQuery("");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#a3703f] uppercase">
              Wieczór przy stole
            </p>
            <h2 className="font-display mt-1 text-[1.35rem] font-semibold text-[#4a3018] sm:text-[1.5rem]">
              Propozycje gier
            </h2>
          </div>

          <ActionButton
            type="button"
            action="vote"
            size="compact"
            onClick={() => setIsOpen(true)}
          >
            Proponuj grę
          </ActionButton>
        </div>
        <span
          aria-hidden="true"
          className="block h-px bg-[#8b6743]/30 shadow-[0_1px_0_rgba(255,255,255,0.5)]"
        />
      </div>

      {games.length > 0 ? (
        <div className="space-y-0">
          {games.map((game, index) => (
            <div
              key={game.gameId}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
              }}
              className="anim-rise-in-fast flex items-center gap-3 border-b border-[#c9aa7f]/25 py-2.5 last:border-b-0"
            >
              <MeetingGameResponseToggle
                meetingId={meetingId}
                gameId={game.gameId}
                ownResponse={game.ownResponse}
              />

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[#4e3528]">
                  {game.title}
                </p>
                <p className="text-muted mt-0.5 text-[0.66rem]">
                  Właściciel: {game.owner.displayName}
                </p>
                <p className="mt-0.5 text-[0.62rem] font-semibold text-[#75552e]">
                  {formatMeetingGameResponseCounts(game.yesCount, game.noCount)}
                </p>
              </div>

              {/*
                GameCover "micro" jest 52px wszędzie indziej w aplikacji
                (m.in. karta wpisu Kroniki) — tu okładka ma być wyraźnie
                większa TYLKO w tej liście. Sterujemy wymiarem z zewnątrz
                przez fitParent + wrapper, bez zmiany wspólnej tabeli
                rozmiarów w GameCover (size="micro" zostaje — steruje tylko
                stylem ramki i fallbackiem, nie rozmiarem).

                Wartości NIE są rozmiarem samego <img> — GameCover rysuje
                border (1px, box-sizing: border-box) na swoim wewnętrznym
                divie, więc realny <img> (size-full) wychodzi 2px węższy niż
                ten wrapper. Zmierzone na żywym renderze:
                  - 4.625rem (74px) wrapper → <img> 72px @ <375px,
                  - 5.125rem (82px) wrapper → <img> 80px @ ≥375px.
              */}
              <div className="w-[4.625rem] shrink-0 min-[375px]:w-[5.125rem]">
                <GameCover
                  title={game.title}
                  coverUrl={game.coverUrl}
                  size="micro"
                  fitParent
                  className="w-full"
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[1rem] border border-dashed border-[#c9aa7f]/45 px-4 py-4 text-sm text-[#6f5845]">
          Na razie nikt nie zgłosił żadnej gry. Dodaj pierwszą propozycję i
          zacznij ranking spotkania.
        </div>
      )}

      {message ? (
        <p className="text-xs font-semibold text-[#8f3528]">{message}</p>
      ) : null}

      {isOpen
        ? createPortal(
            // Portal prosto do <body>: .meeting-form-sheet (rodzic tego
            // komponentu na stronie szczegółów spotkania) ma
            // `filter: drop-shadow(...)`, a filter — dokładnie jak transform
            // — tworzy nowy containing block dla position:fixed potomków.
            // Bez portalu "fixed inset-0" nie pokrywało realnego viewportu,
            // tylko skrzynkę .meeting-form-sheet: na wąskim ekranie modal
            // wychodził węższy i niżej niż cała strona, a rząd gry (okładka +
            // przycisk, oba shrink-0) zostawiał kolumnie z tytułem 0px i
            // tytuł znikał. Ten sam wzorzec już istnieje w tej bazie kodu
            // (MobileRewardsSheet) z identycznego powodu.
            <div className="fixed inset-0 z-50 flex items-end bg-[rgba(20,10,7,0.52)] p-3 sm:items-center sm:justify-center">
              {/*
            Rama = tło półki (shelf-popup-frame), widoczne jako gutter na
            wszystkich 4 bokach (p-2/p-3) I za listą poniżej — lista NIE ma
            już własnego nieprzezroczystego tła, dzięki czemu motyw "wybierz
            grę z półki" faktycznie prześwituje między/za kartami gier.

            Nagłówek jest teraz w 100% transparentny (bez paper-wash) — samo
            drewno widać też za tytułem. Skoro tłem jest zdjęciowa, ciemna
            faktura drewna zamiast jasnego pergaminu, tekst musi przejść na tę
            samą jasną/kremową paletę, której GameCover używa już gdzie
            indziej dla wariantu "shelf" (tekst na drewnie, bez okładki) —
            to nie nowy język wizualny, tylko podpięcie się pod istniejący.
            Do tego twardy, ciemny text-shadow: sam jasny kolor nie
            wystarczy na jaśniejszych słojach zdjęcia, cień domyka kontrast
            niezależnie od tego, które miejsce faktury wypadnie pod tekstem.
          */}
              <div className="shelf-popup-frame premium-edge w-full max-w-2xl overflow-hidden rounded-[1.6rem] p-2 shadow-[0_24px_48px_rgba(16,6,4,0.34)] sm:p-3">
                <div className="relative z-10 px-4 pt-4 pb-3 sm:px-5 sm:pt-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="[text-shadow:0_1px_3px_rgba(10,5,2,0.9)] text-[0.62rem] font-bold tracking-[0.16em] text-[#e8c383] uppercase">
                        Półka spotkania
                      </p>
                      <h3 className="font-display [text-shadow:0_2px_5px_rgba(10,5,2,0.92)] mt-1 text-2xl leading-tight font-bold text-[#fbeed9] sm:text-[1.85rem]">
                        Wybierz grę do propozycji
                      </h3>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsOpen(false)}
                      className="shrink-0 rounded-full bg-black/32 px-3 py-1 text-[0.68rem] font-semibold text-[#fdeee2] shadow-[0_2px_6px_rgba(10,5,2,0.35)] transition hover:bg-black/45"
                    >
                      Zamknij
                    </button>
                  </div>

                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Szukaj gry na półce…"
                    className="paper-wash focus:border-gold focus:ring-gold/20 mt-4 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] shadow-[0_3px_10px_rgba(10,5,2,0.3)] transition outline-none focus:ring-4"
                  />
                </div>

                <div className="max-h-[52vh] space-y-2 overflow-y-auto p-4 sm:p-5">
                  {filteredGames.map((game) => (
                    // Bardzo lekka "mgiełka" zamiast karty: 12% bieli +
                    // backdrop-blur łagodzi słoje drewna pod spodem (bez
                    // blura sam tak niski opacity nie dałby żadnego
                    // wyrównania jasności), a tekst jest jasny + z
                    // text-shadow z tego samego powodu co w nagłówku.
                    <div
                      key={game.gameId}
                      className="flex items-center gap-3 rounded-[1rem] border border-white/22 bg-white/12 px-3 py-2.5 shadow-[0_3px_10px_rgba(10,5,2,0.3)] backdrop-blur-[3px]"
                    >
                      {/*
                        Na 320px sam koszt kolumny okładki (mini, 88px) +
                        kolumny akcji był tak duży, że tytułowi (min-w-0
                        flex-1) zostawało dosłownie kilka pikseli. Obie
                        kolumny dostają węższy wariant bazowy i wracają do
                        pełnego rozmiaru dopiero od 375px, żeby na 320px
                        tytuł miał realną, czytelną przestrzeń.
                      */}
                      <div className="w-16 shrink-0 min-[375px]:w-22">
                        <GameCover
                          title={game.title}
                          coverUrl={game.coverUrl}
                          size="mini"
                          fitParent
                          className="w-full"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="[text-shadow:0_1px_3px_rgba(10,5,2,0.85)] truncate text-sm font-semibold text-[#fbeed9]">
                          {game.title}
                        </p>
                        <p className="[text-shadow:0_1px_3px_rgba(10,5,2,0.85)] mt-0.5 text-[0.68rem] text-[#e6cfa8]">
                          Właściciel: {game.owner.displayName}
                        </p>
                      </div>

                      {/*
                        Stała, wąska kolumna zamiast pozwolić przyciskowi
                        rosnąć swobodnie — bez tego ActionButton (flex-basis:
                        auto = jego naturalna, nieowinięta szerokość) potrafił
                        zjeść niemal całą dostępną szerokość rzędu i zepchnąć
                        min-w-0 flex-1 z tytułem do kilkunastu pikseli,
                        praktycznie usuwając nazwę gry z widoku na mobile.
                      */}
                      <div className="w-20 shrink-0 min-[375px]:w-[6.5rem]">
                        {game.alreadyProposed ? (
                          <span className="block rounded-full bg-[#f3e6cf] px-2 py-1 text-center text-[0.64rem] font-bold text-[#75552e]">
                            Już zgłoszona
                          </span>
                        ) : (
                          <ActionButton
                            type="button"
                            action="vote"
                            size="compact"
                            fullWidth
                            disabled={pending}
                            loading={pending}
                            loadingLabel="Zgłaszam…"
                            onClick={() => handlePropose(game.gameId)}
                          >
                            Zgłoś na wieczór
                          </ActionButton>
                        )}
                      </div>
                    </div>
                  ))}

                  {filteredGames.length === 0 ? (
                    <div className="[text-shadow:0_1px_3px_rgba(10,5,2,0.85)] rounded-[1rem] border border-dashed border-white/30 bg-white/12 px-4 py-5 text-sm text-[#fbeed9] backdrop-blur-[3px]">
                      Nic nie pasuje do wyszukiwania. Spróbuj wpisać krótszy
                      tytuł.
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
