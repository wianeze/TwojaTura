import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArchiveGameButton } from "@/features/games/archive-game-button";
import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import {
  archiveGameAction,
  saveRatingAction,
  toggleGameExpansionOwnedAction,
} from "@/features/games/actions";
import { GameExpansionsChecklist } from "@/features/games/game-expansions-checklist";
import {
  formatDecimal,
  formatPlayTime,
  formatPlayerRange,
  GAME_STATUS_LABELS,
  getRatingEditorMode,
} from "@/features/games/formatting";
import { getGameDetails } from "@/features/games/queries";
import { RatingForm } from "@/features/games/rating-form";

export const metadata: Metadata = { title: "Karta gry" };

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  if (!value) return null;

  return (
    <div className="paper-wash rounded-xl px-3 py-3">
      <p className="text-muted text-[0.62rem] font-bold tracking-[0.16em] uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#503828]">{value}</p>
    </div>
  );
}

function TagBlock({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <section>
      <p className="text-accent text-[0.62rem] font-bold tracking-[0.16em] uppercase">
        {label}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full bg-[#ead9b9] px-3 py-1.5 text-xs font-semibold text-[#705538]"
          >
            {value}
          </span>
        ))}
      </div>
    </section>
  );
}

export default async function GameDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const game = await getGameDetails(id, memberState.member.id);
  if (!game) notFound();

  const canEdit =
    memberState.member.role === "admin" ||
    game.owner.id === memberState.member.id;
  const ratingMode = getRatingEditorMode(game.ownRating);

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/gry"
          className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
        >
          ← Wróć do Półki
        </Link>
        {canEdit && (
          <Link
            href={`/gry/${game.id}/edytuj`}
            className="bg-brand hover:bg-brand-strong rounded-full px-4 py-2 text-xs font-bold text-white transition-colors"
          >
            Edytuj grę
          </Link>
        )}
      </div>

      {game.archivedAt && (
        <Panel className="paper-wash border border-[#8f3528]/20 p-4 sm:p-5">
          <p className="text-sm font-semibold text-[#8f3528]">
            Ten egzemplarz jest już archiwalny. Zniknął z głównej Półki, ale
            jego oceny i historia pozostały zachowane.
          </p>
        </Panel>
      )}

      <Panel className="paper-wash overflow-hidden p-5 sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[auto_1fr]">
          <GameCover
            title={game.title}
            coverUrl={game.coverUrl}
            size="card"
            className="mx-auto xl:mx-0"
          />

          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
                  Karta gry
                </p>
                <h1 className="font-display mt-2 text-4xl font-semibold text-[#4c3528]">
                  {game.title}
                </h1>
                <p className="text-muted mt-3 max-w-3xl text-sm leading-7">
                  {game.description ??
                    "Ta karta nie ma jeszcze pełnego opisu, ale dane egzemplarza i oceny grupy są już zapisane."}
                </p>
              </div>
              <span className="bg-moss-soft text-moss rounded-full px-4 py-2 text-xs font-bold">
                {GAME_STATUS_LABELS[game.status]}
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <DetailField label="Właściciel" value={game.owner.displayName} />
              <DetailField
                label="Aktualnie u"
                value={game.currentHolder?.displayName ?? "nieustalone"}
              />
              <DetailField
                label="Gracze"
                value={formatPlayerRange(game.minPlayers, game.maxPlayers)}
              />
              <DetailField
                label="Czas gry"
                value={formatPlayTime(game.playTimeMinutes)}
              />
              <DetailField label="Typ gry" value={game.gameType} />
              <DetailField
                label="Rok wydania"
                value={game.releaseYear ? String(game.releaseYear) : null}
              />
              <DetailField
                label="BGG Rank"
                value={game.bggRank ? `#${game.bggRank}` : null}
              />
              <DetailField
                label="Trudność BGG"
                value={
                  game.bggWeight ? `${formatDecimal(game.bggWeight)} / 5` : null
                }
              />
              <DetailField
                label="Minimalny wiek"
                value={game.minAge !== null ? `${game.minAge}+` : null}
              />
              <DetailField label="Projektant" value={game.designer} />
              <DetailField label="Wydawca" value={game.publisher} />
            </div>

            {game.bggUrl && (
              <a
                href={game.bggUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="text-accent mt-5 inline-flex text-sm font-bold underline decoration-[#b37a46]/40 underline-offset-4"
              >
                Otwórz ręcznie zapisany link BGG ↗
              </a>
            )}
          </div>
        </div>

        <div className="mt-7 grid gap-6 border-t border-dashed border-[#b99d72] pt-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <TagBlock label="Mechaniki" values={game.mechanics} />
            <TagBlock label="Kategorie" values={game.categories} />

            <section>
              <p className="text-accent text-[0.62rem] font-bold tracking-[0.16em] uppercase">
                Dodatki
              </p>
              <div className="mt-3">
                <GameExpansionsChecklist
                  expansions={game.expansions}
                  canManage={canEdit}
                  onToggle={toggleGameExpansionOwnedAction.bind(null, game.id)}
                />
              </div>
            </section>
          </div>

          <section className="leather-panel rounded-[1.7rem] p-5 text-[#f7ead5]">
            <p className="text-[0.62rem] font-bold tracking-[0.16em] text-[#e8b870] uppercase">
              Ocena grupy
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-4xl font-bold text-[#f0c47e]">
                  {formatDecimal(game.ratingSummary.averageOverall)}
                </p>
                <p className="text-[0.7rem] text-[#cbb9a7]">
                  średnia z {game.ratingSummary.ratingsCount} ocen
                </p>
              </div>
              <div>
                <p className="text-4xl font-bold text-[#f0c47e]">
                  {game.ratingSummary.wantsToPlayAgainCount}
                </p>
                <p className="text-[0.7rem] text-[#cbb9a7]">
                  osób chce zagrać ponownie
                </p>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 border-t border-white/10 pt-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#bcae9d]">Regrywalność</dt>
                <dd className="font-semibold">
                  {formatDecimal(game.ratingSummary.averageReplayability)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-[#bcae9d]">Klimat</dt>
                <dd className="font-semibold">
                  {formatDecimal(game.ratingSummary.averageTheme)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel className="paper-wash p-5 sm:p-7">
          <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
            {ratingMode === "edit" ? "Twoja ocena" : "Oceń tę grę"}
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-[#4c3528]">
            {ratingMode === "edit"
              ? "Zaktualizuj swoją opinię"
              : "Dodaj pierwszą ocenę tej gry"}
          </h2>
          <p className="text-muted mt-3 text-sm leading-6">
            Jedna osoba może mieć jedną edytowalną ocenę konkretnego
            egzemplarza.
          </p>

          <div className="mt-6">
            <RatingForm
              ownRating={game.ownRating}
              action={saveRatingAction.bind(null, game.id)}
            />
          </div>
        </Panel>

        <Panel className="paper-wash p-5 sm:p-7">
          <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
            Komentarze grupy
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-[#4c3528]">
            Co ekipa myśli o tej grze
          </h2>

          {game.ratingComments.length > 0 ? (
            <div className="mt-6 space-y-4">
              {game.ratingComments.map((comment) => (
                <article
                  key={comment.id}
                  className="material-panel rounded-[1.5rem] p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-[#503828]">
                      {comment.author.displayName}
                    </p>
                    <p className="text-muted text-xs">
                      ogólna {comment.overall}/10 · klimat {comment.theme}/10 ·
                      regrywalność {comment.replayability}/10
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-[#5d4737]">
                    {comment.comment}
                  </p>
                  <p className="text-muted mt-3 text-xs">
                    Chęć zagrania ponownie:{" "}
                    {comment.wantsToPlayAgain ? "tak" : "nie"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted mt-5 text-sm leading-6">
              Nikt nie zostawił jeszcze komentarza do tej gry. Pierwsza opinia
              pojawi się tutaj po zapisaniu oceny z komentarzem.
            </p>
          )}
        </Panel>
      </div>

      {canEdit && !game.archivedAt && (
        <Panel className="paper-wash p-5 sm:p-6">
          <p className="text-accent text-[0.65rem] font-bold tracking-[0.18em] uppercase">
            Zarządzanie egzemplarzem
          </p>
          <h2 className="font-display mt-2 text-3xl font-semibold text-[#4c3528]">
            Archiwizacja
          </h2>
          <p className="text-muted mt-3 max-w-3xl text-sm leading-6">
            Archiwizacja usuwa ten egzemplarz z głównej Półki, ale nie kasuje
            ocen ani historii powiązanej z rekordem.
          </p>

          <div className="mt-5">
            <ArchiveGameButton action={archiveGameAction.bind(null, game.id)} />
          </div>
        </Panel>
      )}
    </div>
  );
}
