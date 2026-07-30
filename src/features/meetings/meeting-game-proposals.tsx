"use client";

import { useMemo, useState, useTransition } from "react";
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[#6f5845]">
          Zgłoś grę na ten wieczór, a potem powiedz, w co chcesz zagrać.
          Zgłoszona gra zostaje na liście, nawet gdy nikt jeszcze nie
          odpowiedział.
        </p>

        {/*
          Po zawinięciu na wąskim ekranie justify-between ustawiłoby przycisk
          przy lewej krawędzi — ml-auto trzyma go po prawej w obu układach.
        */}
        <ActionButton
          type="button"
          action="vote"
          size="compact"
          className="ml-auto"
          onClick={() => setIsOpen(true)}
        >
          Proponuj grę
        </ActionButton>
      </div>

      {games.length > 0 ? (
        <div className="space-y-2">
          {games.map((game, index) => (
            <div
              key={game.gameId}
              style={{
                animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
              }}
              className={`anim-rise-in-fast flex flex-col gap-3 rounded-[1.15rem] px-3.5 py-3 sm:flex-row sm:items-center ${
                game.ownResponse === true
                  ? "bg-[#eaf2f8] ring-1 ring-[#9cc2dd]/55"
                  : "paper-wash"
              }`}
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <GameCover
                  title={game.title}
                  coverUrl={game.coverUrl}
                  size="mini"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#4e3528]">
                    {game.title}
                  </p>
                  <p className="text-muted mt-0.5 text-[0.68rem]">
                    Właściciel: {game.owner.displayName}
                  </p>
                  <p className="mt-1 text-[0.66rem] font-semibold text-[#75552e]">
                    {formatMeetingGameResponseCounts(
                      game.yesCount,
                      game.noCount,
                    )}
                  </p>
                </div>
              </div>
              <MeetingGameResponseToggle
                meetingId={meetingId}
                gameId={game.gameId}
                ownResponse={game.ownResponse}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="paper-wash rounded-[1.15rem] px-4 py-4 text-sm text-[#6f5845]">
          Na razie nikt nie zgłosił żadnej gry. Dodaj pierwszą propozycję i
          zacznij ranking spotkania.
        </div>
      )}

      {message ? (
        <p className="text-xs font-semibold text-[#8f3528]">{message}</p>
      ) : null}

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[rgba(20,10,7,0.52)] p-3 sm:items-center sm:justify-center">
          <div className="paper-wash premium-edge w-full max-w-2xl rounded-[1.6rem] p-4 shadow-[0_24px_48px_rgba(16,6,4,0.34)] sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#a36b43] uppercase">
                  Półka spotkania
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold text-[#4e3528]">
                  Wybierz grę do propozycji
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-full border border-[#c7a781]/45 px-3 py-1.5 text-xs font-bold text-[#6b4f39]"
              >
                Zamknij
              </button>
            </div>

            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Szukaj gry na półce…"
              className="paper-wash focus:border-gold focus:ring-gold/20 mt-4 h-11 w-full rounded-xl border border-[#9a7657]/35 px-3.5 text-sm text-[#503828] transition outline-none focus:ring-4"
            />

            <div className="mt-4 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
              {filteredGames.map((game) => (
                <div
                  key={game.gameId}
                  className="flex items-center gap-3 rounded-[1rem] border border-white/55 bg-white/65 px-3 py-2.5"
                >
                  <GameCover
                    title={game.title}
                    coverUrl={game.coverUrl}
                    size="mini"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#4e3528]">
                      {game.title}
                    </p>
                    <p className="text-muted mt-0.5 text-[0.68rem]">
                      Właściciel: {game.owner.displayName}
                    </p>
                  </div>

                  {game.alreadyProposed ? (
                    <span className="rounded-full bg-[#f3e6cf] px-2.5 py-1 text-[0.64rem] font-bold text-[#75552e]">
                      Już zgłoszona
                    </span>
                  ) : (
                    <ActionButton
                      type="button"
                      action="vote"
                      size="compact"
                      disabled={pending}
                      loading={pending}
                      loadingLabel="Zgłaszam…"
                      onClick={() => handlePropose(game.gameId)}
                    >
                      Zgłoś na wieczór
                    </ActionButton>
                  )}
                </div>
              ))}

              {filteredGames.length === 0 ? (
                <div className="rounded-[1rem] border border-dashed border-[#c9aa7f]/45 px-4 py-5 text-sm text-[#6f5845]">
                  Nic nie pasuje do wyszukiwania. Spróbuj wpisać krótszy tytuł.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
