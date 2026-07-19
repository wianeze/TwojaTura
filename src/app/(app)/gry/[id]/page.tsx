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
import { listRecentGamePlays } from "@/features/plays/queries";
import { GameRecentPlaysList } from "@/features/plays/recent-plays-list";

export const metadata: Metadata = { title: "Karta gry" };

function MetaItem({
  label,
  value,
  subtle = false,
}: {
  label: string;
  value: string | null;
  subtle?: boolean;
}) {
  if (!value) return null;

  return (
    <div className="flex items-baseline gap-2 text-sm">
      <span
        className={`shrink-0 text-[0.6rem] font-bold tracking-[0.14em] uppercase ${
          subtle ? "text-[#9a7c61]" : "text-[#a56c42]"
        }`}
      >
        {label}
      </span>
      <span
        className={`min-w-0 font-semibold ${
          subtle ? "text-[#6a5442]" : "text-[#4d3528]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function TagBlock({ label, values }: { label: string; values: string[] }) {
  if (values.length === 0) return null;

  return (
    <section className="space-y-1.5">
      <p className="text-accent text-[0.56rem] font-bold tracking-[0.16em] uppercase">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <span
            key={value}
            className="rounded-full bg-[#ead9b9] px-2.5 py-1 text-[0.68rem] font-semibold text-[#705538]"
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
  const recentPlays = await listRecentGamePlays(game.id);

  const canEdit =
    memberState.member.role === "admin" ||
    game.owner.id === memberState.member.id;
  const ratingMode = getRatingEditorMode(game.ownRating);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href="/gry"
            className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
          >
            ← Wróć do Półki
          </Link>
          {canEdit ? (
            <Link
              href={`/gry/${game.id}/edytuj`}
              className="bg-brand hover:bg-brand-strong rounded-full px-4 py-2 text-xs font-bold text-white transition-colors"
            >
              Edytuj grę
            </Link>
          ) : null}
        </div>

        {canEdit && !game.archivedAt ? (
          <ArchiveGameButton action={archiveGameAction.bind(null, game.id)} />
        ) : null}
      </div>

      {game.archivedAt ? (
        <Panel className="paper-wash border border-[#8f3528]/20 p-4 sm:p-5">
          <p className="text-sm font-semibold text-[#8f3528]">
            Ten egzemplarz jest już archiwalny. Zniknął z głównej Półki, ale
            jego oceny i historia pozostały zachowane.
          </p>
        </Panel>
      ) : null}

      <Panel className="paper-wash overflow-hidden p-3.5 sm:p-4">
        <div className="grid gap-3 xl:grid-cols-[10.5rem_minmax(0,1fr)_14rem]">
          <div className="space-y-2.5">
            <GameCover
              title={game.title}
              coverUrl={game.coverUrl}
              size="card"
              className="mx-auto w-[7.75rem] sm:w-[8.5rem] lg:w-[9.5rem] xl:mx-0"
            />

            <section className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-accent text-[0.56rem] font-bold tracking-[0.16em] uppercase">
                  Dodatki ({game.expansions.length})
                </p>
                {game.bggUrl ? (
                  <a
                    href={game.bggUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-accent inline-flex text-[0.72rem] font-bold underline decoration-[#b37a46]/40 underline-offset-4"
                  >
                    Link BGG ↗
                  </a>
                ) : null}
              </div>

              <GameExpansionsChecklist
                expansions={game.expansions}
                gameTitle={game.title}
                canManage={canEdit}
                onToggle={toggleGameExpansionOwnedAction.bind(null, game.id)}
              />
            </section>
          </div>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
                  Karta gry
                </p>
                <h1 className="font-display mt-1 text-[1.75rem] leading-tight font-semibold text-[#4c3528] sm:text-[2.05rem]">
                  {game.title}
                </h1>
                <p className="text-muted mt-1.5 max-w-3xl text-sm leading-5.5">
                  {game.description ??
                    "Ta karta nie ma jeszcze pełnego opisu, ale dane egzemplarza i oceny grupy są już zapisane."}
                </p>
              </div>

              <span className="bg-moss-soft text-moss rounded-full px-3 py-1.5 text-[0.65rem] font-bold">
                {GAME_STATUS_LABELS[game.status]}
              </span>
            </div>

            <div className="grid gap-x-4 gap-y-1.5 border-t border-dashed border-[#b99d72] pt-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <MetaItem label="Właściciel" value={game.owner.displayName} />
              <MetaItem
                label="Aktualnie u"
                value={game.currentHolder?.displayName ?? "nieustalone"}
              />
              <MetaItem
                label="Gracze"
                value={formatPlayerRange(game.minPlayers, game.maxPlayers)}
              />
              <MetaItem
                label="Czas gry"
                value={formatPlayTime(game.playTimeMinutes)}
              />
              <MetaItem label="Typ" value={game.gameType} />
              <MetaItem
                label="Rok"
                value={game.releaseYear ? String(game.releaseYear) : null}
              />
              <MetaItem
                label="BGG #"
                value={game.bggRank ? `#${game.bggRank}` : null}
              />
              <MetaItem
                label="Waga"
                value={
                  game.bggWeight ? `${formatDecimal(game.bggWeight)} / 5` : null
                }
              />
              <MetaItem
                label="Wiek"
                value={game.minAge !== null ? `${game.minAge}+` : null}
                subtle
              />
              <MetaItem label="Projektant" value={game.designer} subtle />
              <MetaItem label="Wydawca" value={game.publisher} subtle />
            </div>

            {(game.mechanics.length > 0 || game.categories.length > 0) && (
              <div className="grid gap-2.5 xl:grid-cols-2">
                <TagBlock label="Mechaniki" values={game.mechanics} />
                <TagBlock label="Kategorie" values={game.categories} />
              </div>
            )}
          </div>

          <aside className="leather-panel h-fit rounded-[1.25rem] p-3.5 text-[#f7ead5]">
            <p className="text-[0.56rem] font-bold tracking-[0.16em] text-[#e8b870] uppercase">
              Ocena grupy
            </p>
            <div className="mt-2.5 space-y-2.5">
              <div>
                <p className="text-[1.75rem] leading-none font-bold text-[#f0c47e]">
                  {formatDecimal(game.ratingSummary.averageOverall)}
                </p>
                <p className="mt-1 text-[0.68rem] text-[#cbb9a7]">
                  średnia z {game.ratingSummary.ratingsCount} ocen
                </p>
              </div>

              <div className="rounded-xl bg-white/6 px-3 py-2">
                <p className="text-[0.58rem] font-bold tracking-[0.14em] text-[#d8c3ae] uppercase">
                  Chce zagrać ponownie
                </p>
                <p className="mt-1 text-sm font-semibold text-[#f6e7d1]">
                  {game.ratingSummary.wantsToPlayAgainCount} osób
                </p>
              </div>

              <dl className="space-y-1.5 border-t border-white/10 pt-2.5 text-sm">
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
            </div>
          </aside>
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel className="paper-wash p-3.5 sm:p-4">
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            {ratingMode === "edit" ? "Twoja ocena" : "Oceń tę grę"}
          </p>
          <h2 className="font-display mt-1 text-[1.5rem] font-semibold text-[#4c3528]">
            {ratingMode === "edit" ? "Zaktualizuj opinię" : "Dodaj ocenę"}
          </h2>

          <div className="mt-3">
            <RatingForm
              ownRating={game.ownRating}
              action={saveRatingAction.bind(null, game.id)}
            />
          </div>
        </Panel>

        <Panel className="paper-wash p-3.5 sm:p-4">
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            Komentarze grupy
          </p>
          <h2 className="font-display mt-1 text-[1.5rem] font-semibold text-[#4c3528]">
            Opinie o tej grze
          </h2>

          {game.ratingComments.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {game.ratingComments.map((comment) => (
                <article
                  key={comment.id}
                  className="material-panel rounded-[1.15rem] p-3.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2.5">
                    <p className="font-semibold text-[#503828]">
                      {comment.author.displayName}
                    </p>
                    <p className="text-muted text-xs">
                      ogólna {comment.overall}/10 · klimat {comment.theme}/10 ·
                      regrywalność {comment.replayability}/10
                    </p>
                  </div>
                  <p className="mt-2 text-sm leading-5.5 text-[#5d4737]">
                    {comment.comment}
                  </p>
                  <p className="text-muted mt-2 text-xs">
                    Chęć zagrania ponownie:{" "}
                    {comment.wantsToPlayAgain ? "tak" : "nie"}
                  </p>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-muted mt-3 text-sm leading-5.5">
              Nikt nie zostawił jeszcze komentarza do tej gry.
            </p>
          )}
        </Panel>
      </div>

      <Panel className="paper-wash p-3.5 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div>
            <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
              Kronika
            </p>
            <h2 className="font-display mt-1 text-[1.4rem] font-semibold text-[#4c3528]">
              Ostatnie partie
            </h2>
          </div>
          <Link
            href="/kronika"
            className="text-accent text-xs font-bold underline decoration-[#b37a46]/40 underline-offset-4"
          >
            Pełna Kronika
          </Link>
        </div>

        <div className="mt-3">
          <GameRecentPlaysList items={recentPlays} />
        </div>
      </Panel>
    </div>
  );
}
