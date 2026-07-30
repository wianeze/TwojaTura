import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { ArchiveGameButton } from "@/features/games/archive-game-button";
import { GameCover } from "@/components/ui/game-cover";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
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
    <div className="flex min-w-0 items-baseline gap-1.5 text-xs">
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
            className="rounded-full bg-[#ead9b9] px-2 py-0.5 text-[0.65rem] font-semibold text-[#705538]"
          >
            {value}
          </span>
        ))}
      </div>
    </section>
  );
}

function GroupRatingBox({
  ratingSummary,
  className = "",
}: {
  ratingSummary: {
    averageOverall: number | null;
    ratingsCount: number;
    wantsToPlayAgainCount: number;
    averageReplayability: number | null;
    averageTheme: number | null;
  };
  className?: string;
}) {
  return (
    <aside
      className={`leather-panel h-fit min-w-0 rounded-[1.25rem] p-2.5 text-[#f7ead5] ${className}`}
    >
      <p className="text-[0.52rem] font-bold tracking-[0.14em] text-[#e8b870] uppercase">
        Ocena grupy
      </p>
      <div className="mt-1.5">
        <p className="text-[1.45rem] leading-none font-bold text-[#f0c47e]">
          {formatDecimal(ratingSummary.averageOverall)}
        </p>
        <p className="mt-1 text-[0.62rem] text-[#cbb9a7]">
          {ratingSummary.ratingsCount} ocen
        </p>
      </div>
      <p className="mt-2 border-t border-white/10 pt-2 text-[0.65rem] text-[#d8c3ae]">
        Zagra ponownie: {ratingSummary.wantsToPlayAgainCount}
      </p>
      <dl className="mt-1.5 grid grid-cols-2 gap-1 text-[0.62rem] text-[#bcae9d]">
        <div>
          <dt>Regryw.</dt>
          <dd className="font-semibold text-[#f6e7d1]">
            {formatDecimal(ratingSummary.averageReplayability)}
          </dd>
        </div>
        <div>
          <dt>Klimat</dt>
          <dd className="font-semibold text-[#f6e7d1]">
            {formatDecimal(ratingSummary.averageTheme)}
          </dd>
        </div>
      </dl>
    </aside>
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
          <ActionLink
            action="neutral"
            size="compact"
            emphasis="secondary"
            href="/gry"
          >
            Wróć do Półki
          </ActionLink>
          {canEdit ? (
            <ActionLink
              action="shelf"
              size="compact"
              emphasis="secondary"
              href={`/gry/${game.id}/edytuj`}
            >
              Edytuj grę
            </ActionLink>
          ) : null}
        </div>

        {canEdit && !game.archivedAt ? (
          <ArchiveGameButton action={archiveGameAction.bind(null, game.id)} />
        ) : null}
      </div>

      {game.archivedAt ? (
        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
          className="anim-rise-in-fast paper-wash border border-[#8f3528]/20 p-4 sm:p-5"
        >
          <p className="text-sm font-semibold text-[#8f3528]">
            Ten egzemplarz jest już archiwalny. Zniknął z głównej Półki, ale
            jego oceny i historia pozostały zachowane.
          </p>
        </Panel>
      ) : null}

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash overflow-hidden p-3 sm:p-3.5"
      >
        <div className="grid gap-3 md:grid-cols-[8.5rem_minmax(0,1fr)] xl:grid-cols-[10.5rem_minmax(0,1fr)_14rem]">
          <div className="space-y-2 md:row-span-2">
            <div className="grid grid-cols-2 items-stretch gap-2.5 md:block">
              <GameCover
                title={game.title}
                coverUrl={game.coverUrl}
                size="card"
                fitParent
                className="mx-auto w-full max-w-none xl:mx-0 xl:w-[9.5rem]"
              />
              <GroupRatingBox
                ratingSummary={game.ratingSummary}
                className="md:hidden"
              />
            </div>

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

          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-start justify-between gap-2.5">
              <div className="min-w-0">
                <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
                  Karta gry
                </p>
                <h1 className="font-display mt-1 text-[1.6rem] leading-tight font-semibold text-[#4c3528] sm:text-[1.85rem]">
                  {game.title}
                </h1>
                <p className="text-muted mt-1 max-w-3xl text-[0.82rem] leading-5 sm:text-sm">
                  {game.description ??
                    "Ta karta nie ma jeszcze pełnego opisu, ale dane egzemplarza i oceny grupy są już zapisane."}
                </p>
              </div>

              <span className="bg-moss-soft text-moss rounded-full px-3 py-1.5 text-[0.65rem] font-bold">
                {GAME_STATUS_LABELS[game.status]}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-3 gap-y-1 border-t border-dashed border-[#b99d72] pt-2 sm:grid-cols-3 xl:grid-cols-3">
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
              <div className="grid gap-2 min-[440px]:grid-cols-2 xl:grid-cols-2">
                <TagBlock label="Mechaniki" values={game.mechanics} />
                <TagBlock label="Kategorie" values={game.categories} />
              </div>
            )}
          </div>

          <GroupRatingBox
            ratingSummary={game.ratingSummary}
            className="hidden md:col-span-2 md:block xl:col-auto"
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(2)}ms` }}
          className="anim-rise-in-fast paper-wash p-3.5 sm:p-4"
        >
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

        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(3)}ms` }}
          className="anim-rise-in-fast paper-wash p-3.5 sm:p-4"
        >
          <p className="text-accent text-[0.56rem] font-bold tracking-[0.18em] uppercase">
            Komentarze grupy
          </p>
          <h2 className="font-display mt-1 text-[1.5rem] font-semibold text-[#4c3528]">
            Opinie o tej grze
          </h2>

          {game.ratingComments.length > 0 ? (
            <div className="mt-3 space-y-2.5">
              {game.ratingComments.map((comment, index) => (
                <article
                  key={comment.id}
                  style={{
                    animationDelay: `${getEntranceStaggerDelayMs(index)}ms`,
                  }}
                  className="anim-rise-in-fast material-panel rounded-[1.15rem] p-3.5"
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

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(4)}ms` }}
        className="anim-rise-in-fast paper-wash p-3.5 sm:p-4"
      >
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
