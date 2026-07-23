import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { SectionHeading } from "@/components/ui/section-heading";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createGameAction } from "@/features/games/actions";
import { GameForm } from "@/features/games/game-form";
import { getGameFormValues } from "@/features/games/formatting";
import { listActiveMembers } from "@/features/games/queries";

export const metadata: Metadata = { title: "Dodaj grę" };

export default async function NewGamePage() {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const members = await listActiveMembers();
  const initialValues = {
    ...getGameFormValues(),
    ownerId: memberState.member.id,
    currentHolderId: memberState.member.id,
    status: "available" as const,
  };

  return (
    <div className="space-y-7">
      <div
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <SectionHeading
          eyebrow="Nowy egzemplarz"
          title="Dodaj grę do Półki"
          description="Tworzysz własny fizyczny egzemplarz w kolekcji grupy. Właściciel zapisuje się po stronie serwera na podstawie Twojej sesji."
          action={
            <Link
              href="/gry"
              className="paper-wash rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
            >
              Wróć do Półki
            </Link>
          }
        />
      </div>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-5 sm:p-7"
      >
        <GameForm
          action={createGameAction}
          initialValues={initialValues}
          members={members}
          actor={memberState.member}
          submitLabel="Dodaj egzemplarz"
          pendingLabel="Dodajemy grę…"
          canTransferOwner={false}
        />
      </Panel>
    </div>
  );
}
