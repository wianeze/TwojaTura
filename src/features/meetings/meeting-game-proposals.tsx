"use client";

import { useMemo, useState, useTransition } from "react";
import { GameCover } from "@/components/ui/game-cover";
import { toggleMeetingVoteAction } from "./actions";
import { MeetingVoteToggle } from "./meeting-vote-toggle";
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
      const result = await toggleMeetingVoteAction(meetingId, gameId, true);
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
          Gdy ktoś zagłosuje na grę po raz pierwszy, trafia ona od razu do puli
          kandydatów na ten wieczór.
        </p>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="rounded-full bg-[#7d2f3d] px-3.5 py-2 text-xs font-bold text-[#fff3ec] transition-colors hover:bg-[#8d3747]"
        >
          + Proponuj grę
        </button>
      </div>

      {games.length > 0 ? (
        <div className="space-y-2">
          {games.map((game) => (
            <div
              key={game.gameId}
              className="paper-wash flex items-center gap-3 rounded-[1.15rem] px-3.5 py-3"
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
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-[#f3e6cf] px-2.5 py-1 text-[0.64rem] font-bold text-[#75552e]">
                  {game.votesCount} głosy
                </span>
                <MeetingVoteToggle
                  meetingId={meetingId}
                  gameId={game.gameId}
                  hasOwnVote={game.hasOwnVote}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="paper-wash rounded-[1.15rem] px-4 py-4 text-sm text-[#6f5845]">
          Na razie żadna gra nie ma jeszcze głosu. Dodaj pierwszą propozycję i
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

                  {game.hasOwnVote ? (
                    <span className="bg-moss/12 text-moss rounded-full px-2.5 py-1 text-[0.64rem] font-bold">
                      Twój głos
                    </span>
                  ) : game.alreadyProposed ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handlePropose(game.gameId)}
                      className="cta-glow rounded-full border border-[#7d2f3d]/28 px-3 py-1.5 text-[0.68rem] font-bold text-[#7d2f3d] disabled:opacity-60"
                    >
                      Głosuj
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => handlePropose(game.gameId)}
                      className="cta-glow rounded-full bg-[#7d2f3d] px-3 py-1.5 text-[0.68rem] font-bold text-[#fff3ec] disabled:opacity-60"
                    >
                      {pending ? "Dodaję…" : "Proponuj"}
                    </button>
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
