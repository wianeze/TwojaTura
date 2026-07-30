import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { createPlayAction } from "@/features/plays/actions";
import { PlayForm } from "@/features/plays/play-form";
import { getPlayCreateFormData } from "@/features/plays/queries";

export const metadata: Metadata = { title: "Nowa partia" };

export default async function NewPlayPage({
  searchParams,
}: {
  searchParams: Promise<{ meeting?: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { meeting } = await searchParams;
  const formData = await getPlayCreateFormData(meeting);

  return (
    <div className="space-y-4">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          Kronika
        </p>
        <h1 className="font-display text-cream mt-2 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
          Zapisz partię
        </h1>
      </header>

      {/* Powrót pod tytułem i przy prawej krawędzi, żeby nie wyprzedzał nagłówka. */}
      <div className="flex justify-end">
        <ActionLink
          action="neutral"
          size="compact"
          emphasis="secondary"
          href="/kronika"
        >
          Wróć do Kroniki
        </ActionLink>
      </div>

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-4 sm:p-5"
      >
        <PlayForm
          mode="create"
          action={createPlayAction}
          initialValues={formData.initialValues}
          games={formData.games}
          meetings={formData.meetings}
          members={formData.members}
          submitLabel="Zapisz partię"
          pendingLabel="Zapisywanie..."
        />
      </Panel>
    </div>
  );
}
