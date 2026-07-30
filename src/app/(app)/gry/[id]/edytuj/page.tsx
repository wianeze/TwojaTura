import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { updateGameAction } from "@/features/games/actions";
import { GameForm } from "@/features/games/game-form";
import { getGameFormValues } from "@/features/games/formatting";
import { getGameRecordById, listActiveMembers } from "@/features/games/queries";

export const metadata: Metadata = { title: "Edytuj grę" };

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const game = await getGameRecordById(id);
  if (!game) notFound();

  const canEdit =
    memberState.member.role === "admin" ||
    game.owner_id === memberState.member.id;
  if (!canEdit) {
    redirect(`/gry/${id}`);
  }

  const members = await listActiveMembers();

  return (
    <div className="space-y-7">
      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <SectionHeading
          eyebrow="Edycja egzemplarza"
          title={game.title}
          description="Zmieniasz dane fizycznego egzemplarza we wspólnej Półce. Uprawnienia właściciela i administratora nadal pilnuje baza danych."
          action={
            <ActionLink
              action="neutral"
              size="compact"
              emphasis="secondary"
              href={`/gry/${id}`}
            >
              Wróć do karty gry
            </ActionLink>
          }
        />
      </div>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-5 sm:p-7"
      >
        <GameForm
          action={updateGameAction.bind(null, game.id)}
          initialValues={getGameFormValues(game)}
          members={members}
          actor={memberState.member}
          submitLabel="Zapisz zmiany gry"
          pendingLabel="Zapisujemy grę…"
          canTransferOwner={memberState.member.role === "admin"}
        />
      </Panel>
    </div>
  );
}
