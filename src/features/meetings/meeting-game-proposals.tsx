"use client";

import { useMemo, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { ActionButton } from "@/components/ui/action-button";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
import { GameCover } from "@/components/ui/game-cover";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import {
  proposeMeetingContinuationAction,
  proposeMeetingGameAction,
} from "./actions";
import {
  formatMeetingContinuationSubtitle,
  formatMeetingGameResponseCounts,
} from "./formatting";
import { getMeetingRecommendationLabel } from "./game-recommendations";
import { MeetingGameResponseToggle } from "./meeting-game-response-toggle";
import type {
  MeetingGameCandidateOption,
  MeetingContinuationVoteItem,
  MeetingContinuablePlay,
  MeetingGameRecommendation,
  MeetingGameVoteItem,
} from "./types";

type MeetingGameProposalsProps = {
  meetingId: string;
  games: MeetingGameVoteItem[];
  continuationVotes: MeetingContinuationVoteItem[];
  selectedContinuation: MeetingContinuablePlay | null;
  availableGames: MeetingGameCandidateOption[];
  recommendedGames: MeetingGameRecommendation[];
  continuablePlays: MeetingContinuablePlay[];
};

export function MeetingGameProposals({
  meetingId,
  games,
  continuationVotes,
  selectedContinuation,
  availableGames,
  recommendedGames,
  continuablePlays,
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
  const filteredContinuablePlays = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pl-PL");
    if (!normalizedQuery) return continuablePlays;

    return continuablePlays.filter((play) =>
      play.gameTitle.toLocaleLowerCase("pl-PL").includes(normalizedQuery),
    );
  }, [continuablePlays, query]);

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

  const handleProposeContinuation = (playId: string) => {
    startTransition(async () => {
      const result = await proposeMeetingContinuationAction(meetingId, playId);
      setMessage(result.status === "error" ? (result.message ?? null) : null);

      if (result.status === "success") {
        setIsOpen(false);
        setQuery("");
      }
    });
  };

  const proposedContinuationIds = useMemo(
    () => new Set(continuationVotes.map((proposal) => proposal.playId)),
    [continuationVotes],
  );
  const selectedContinuationIsProposed = selectedContinuation
    ? proposedContinuationIds.has(selectedContinuation.playId)
    : false;

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#a3703f] uppercase">
              Wieczór przy stole
            </p>
            <h2 className="font-display mt-1 text-[1.35rem] font-semibold text-[#4a3018] sm:text-[1.5rem]">
              Plan wieczoru
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
          className="block h-px bg-[#8b6743]/70 shadow-[0_1px_0_rgba(255,255,255,0.5)]"
        />
      </div>

      {games.length > 0 ||
      continuationVotes.length > 0 ||
      selectedContinuation ? (
        <div className="space-y-0">
          {selectedContinuation && !selectedContinuationIsProposed ? (
            <div
              style={{ borderBottomColor: "rgba(139, 103, 67, 0.65)" }}
              className="anim-rise-in-fast flex items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded-full bg-[#8b5b27]/16 px-1.5 py-0.5 text-[0.52rem] font-extrabold tracking-[0.08em] text-[#70431d] uppercase">
                    Wybrana kontynuacja
                  </span>
                  <p className="truncate text-sm font-semibold text-[#4e3528]">
                    {selectedContinuation.gameTitle}
                  </p>
                </div>
                <p className="text-muted mt-0.5 line-clamp-2 text-[0.66rem]">
                  {formatMeetingContinuationSubtitle(selectedContinuation)}
                </p>
              </div>

              <div className="w-[4.625rem] shrink-0 min-[375px]:w-[5.125rem]">
                <GameCover
                  title={selectedContinuation.gameTitle}
                  coverUrl={selectedContinuation.coverUrl}
                  size="micro"
                  fitParent
                  className="w-full"
                />
              </div>
            </div>
          ) : null}

          {continuationVotes.map((proposal, index) => (
            <div
              key={`continuation:${proposal.playId}`}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
                borderBottomColor: "rgba(139, 103, 67, 0.65)",
              }}
              className="anim-rise-in-fast flex items-center gap-3 border-b py-2.5 last:border-b-0"
            >
              <MeetingGameResponseToggle
                meetingId={meetingId}
                gameId={proposal.gameId}
                continuedPlayId={proposal.playId}
                ownResponse={proposal.ownResponse}
              />

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 rounded-full bg-[#6f7d45]/14 px-1.5 py-0.5 text-[0.52rem] font-extrabold tracking-[0.08em] text-[#53612f] uppercase">
                    {selectedContinuation?.playId === proposal.playId
                      ? "Wybrana kontynuacja"
                      : "Odłożona partia"}
                  </span>
                  <p className="truncate text-sm font-semibold text-[#4e3528]">
                    {proposal.title}
                  </p>
                </div>
                <p className="text-muted mt-0.5 line-clamp-2 text-[0.66rem]">
                  {formatMeetingContinuationSubtitle(proposal)}
                </p>
                <p className="mt-0.5 text-[0.62rem] font-semibold text-[#75552e]">
                  {formatMeetingGameResponseCounts(
                    proposal.yesCount,
                    proposal.noCount,
                  )}
                </p>
              </div>

              <div className="w-[4.625rem] shrink-0 min-[375px]:w-[5.125rem]">
                <GameCover
                  title={proposal.title}
                  coverUrl={proposal.coverUrl}
                  size="micro"
                  fitParent
                  className="w-full"
                />
              </div>
            </div>
          ))}

          {games.map((game, index) => (
            <div
              key={game.gameId}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(
                  continuationVotes.length + index,
                )}ms`,
                // Kolor musi iść przez inline style — patrz komentarz przy
                // SEPARATOR_LINE_COLOR w page.tsx: nielayerowana reguła
                // `* { border-color: var(--border) }` bije Tailwindowe
                // `border-[...]` niezależnie od specyficzności.
                borderBottomColor: "rgba(139, 103, 67, 0.65)",
              }}
              className="anim-rise-in-fast flex items-center gap-3 border-b py-2.5 last:border-b-0"
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
                  Właściciel: <PlayerDisplayName variant="compact" displayName={game.owner.displayName} title={game.owner.equippedTitle} className="inline-block max-w-[12rem] align-bottom" />
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
                      <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#e8c383] uppercase [text-shadow:0_1px_3px_rgba(10,5,2,0.9)]">
                        Półka spotkania
                      </p>
                      <h3 className="font-display mt-1 text-2xl leading-tight font-bold text-[#fbeed9] [text-shadow:0_2px_5px_rgba(10,5,2,0.92)] sm:text-[1.85rem]">
                        Zaproponuj plan wieczoru
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
                  {filteredContinuablePlays.length > 0 ? (
                    <section className="mb-4 rounded-[1rem] border border-[#9ab36f]/50 bg-[linear-gradient(135deg,rgba(39,65,34,0.88),rgba(22,39,22,0.84))] p-3 shadow-[0_0_18px_rgba(114,150,76,0.2)]">
                      <div className="mb-2.5">
                        <p className="text-[0.67rem] font-extrabold tracking-[0.14em] text-[#d8eba9] uppercase">
                          Odłożone partie
                        </p>
                        <p className="mt-0.5 text-[0.7rem] text-[#d5dfc0]">
                          Zaproponuj powrót do konkretnej rozpoczętej partii.
                        </p>
                      </div>

                      <div className="space-y-2">
                        {filteredContinuablePlays.map((play) => {
                          const isAlreadyProposed =
                            proposedContinuationIds.has(play.playId);

                          return (
                            <div
                              key={play.playId}
                              className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/18 bg-black/22 p-2"
                            >
                              <div className="w-11 shrink-0 sm:w-12">
                                <GameCover
                                  title={play.gameTitle}
                                  coverUrl={play.coverUrl}
                                  size="micro"
                                  fitParent
                                  className="w-full"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-[#f5f0dc]">
                                  {play.gameTitle}
                                </p>
                                <p className="mt-0.5 line-clamp-2 text-[0.6rem] leading-tight text-[#cbd7b5]">
                                  {formatMeetingContinuationSubtitle(play)}
                                </p>
                                {play.assignedMeeting ? (
                                  <p className="mt-0.5 truncate text-[0.58rem] font-semibold text-[#e5c978]">
                                    Przypisana: {play.assignedMeeting.title}
                                  </p>
                                ) : play.isRunning ? (
                                  <p className="mt-0.5 text-[0.58rem] font-semibold text-[#e5c978]">
                                    Trwa teraz przy Stole
                                  </p>
                                ) : null}
                              </div>
                              <div className="w-[7rem] shrink-0">
                                <ActionButton
                                  type="button"
                                  action="chronicle"
                                  size="compact"
                                  withIcon={false}
                                  fullWidth
                                  disabled={pending}
                                  loading={pending}
                                  loadingLabel="Zgłaszam…"
                                  onClick={() =>
                                    handleProposeContinuation(play.playId)
                                  }
                                >
                                  {isAlreadyProposed
                                    ? "Chcę grać"
                                    : "Zaproponuj dokończenie"}
                                </ActionButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {recommendedGames.length > 0 && query.trim() === "" ? (
                    <section className="mb-4 rounded-[1rem] border border-[#efbd65]/45 bg-[linear-gradient(135deg,rgba(94,47,18,0.84),rgba(42,20,12,0.78))] p-3 shadow-[0_0_18px_rgba(218,142,48,0.2)]">
                      <div className="mb-2.5 flex items-end justify-between gap-3">
                        <div>
                          <p className="text-[0.67rem] font-extrabold tracking-[0.14em] text-[#ffd88a] uppercase">
                            ✨ Dla tej drużyny
                          </p>
                          <p className="mt-0.5 text-[0.7rem] text-[#ead6b5]">
                            Gry, które najlepiej pasują do tej ekipy
                          </p>
                        </div>
                      </div>

                      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        {recommendedGames.map((game) => {
                          const average = game.averageRating.toLocaleString(
                            "pl-PL",
                            {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            },
                          );
                          const explanation = [
                            `Średnia ${average} z ${game.ratingCount} ocen uczestników.`,
                            `${game.wantsAgainCount} osób chce zagrać ponownie.`,
                            game.historicalPositiveCount > 0
                              ? `${game.historicalPositiveCount} osób wcześniej głosowało na tę grę.`
                              : "Brak wcześniejszych pozytywnych głosów tej ekipy.",
                          ].join(" ");

                          return (
                            <button
                              key={game.gameId}
                              type="button"
                              disabled={pending}
                              onClick={() => handlePropose(game.gameId)}
                              className="group relative flex w-[12.5rem] shrink-0 items-center gap-2.5 overflow-hidden rounded-xl border border-[#e8bb70]/35 bg-black/24 p-2 text-left shadow-[0_3px_10px_rgba(10,5,2,0.28)] transition hover:-translate-y-0.5 hover:border-[#ffd17c]/70 hover:bg-[#6c371d]/70 focus-visible:ring-2 focus-visible:ring-[#ffd17c] focus-visible:outline-none disabled:cursor-wait disabled:opacity-70 sm:w-[14rem]"
                              aria-label={`Zgłoś ${game.title}. ${explanation}`}
                              title={explanation}
                            >
                              <div className="w-12 shrink-0 sm:w-14">
                                <GameCover
                                  title={game.title}
                                  coverUrl={game.coverUrl}
                                  size="micro"
                                  fitParent
                                  className="w-full"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="text-[0.58rem] leading-tight font-extrabold text-[#ffd88a]">
                                  {getMeetingRecommendationLabel(game.label)}
                                </p>
                                <p className="mt-1 line-clamp-2 text-xs leading-tight font-bold text-[#fff1d8]">
                                  {game.title}
                                </p>
                                <p className="mt-1 text-[0.58rem] leading-tight text-[#e9cfaa]">
                                  {game.likedCount}/{game.participantCount}{" "}
                                  graczy lubi tę grę
                                </p>
                                <span className="mt-1 inline-block text-[0.56rem] font-bold text-[#f3bd62] underline decoration-[#f3bd62]/45 underline-offset-2">
                                  Dlaczego?
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

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
                        <p className="truncate text-sm font-semibold text-[#fbeed9] [text-shadow:0_1px_3px_rgba(10,5,2,0.85)]">
                          {game.title}
                        </p>
                        <p className="mt-0.5 text-[0.68rem] text-[#e6cfa8] [text-shadow:0_1px_3px_rgba(10,5,2,0.85)]">
                          Właściciel: <PlayerDisplayName variant="compact" displayName={game.owner.displayName} title={game.owner.equippedTitle} className="inline-block max-w-[12rem] align-bottom" />
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

                  {filteredGames.length === 0 &&
                  filteredContinuablePlays.length === 0 ? (
                    <div className="rounded-[1rem] border border-dashed border-white/30 bg-white/12 px-4 py-5 text-sm text-[#fbeed9] backdrop-blur-[3px] [text-shadow:0_1px_3px_rgba(10,5,2,0.85)]">
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
