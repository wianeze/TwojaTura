import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
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
      <SectionHeading
        eyebrow="Edycja egzemplarza"
        title={game.title}
        description="Zmieniasz dane fizycznego egzemplarza we wspólnej Półce. Uprawnienia właściciela i administratora nadal pilnuje baza danych."
        action={
          <Link
            href={`/gry/${id}`}
            className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
          >
            Wróć do karty gry
          </Link>
        }
      />

      <Panel className="paper-wash p-5 sm:p-7">
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
