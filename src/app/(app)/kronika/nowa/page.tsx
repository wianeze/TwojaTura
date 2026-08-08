import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { getMeetingDetails } from "@/features/meetings/queries";
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
  const [formData, meetingDetails] = await Promise.all([
    getPlayCreateFormData(meeting),
    meeting ? getMeetingDetails(meeting) : Promise.resolve(null),
  ]);
  const continuedPlay = meetingDetails?.continuedPlay ?? null;

  return (
    // Ta sama kolumna co w szczegółach partii, ale szersza: formularz ma rząd
    // dwóch pól wyboru, którym 44rem odbierało miejsce na nazwy spotkań.
    <div className="chronicle-sheet-stack chronicle-sheet-stack-wide space-y-4">
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

      {/* Spotkanie kontynuuje rozpoczętą partię — zanim ktokolwiek założy tu
          drugi wpis o tej samej rozgrywce, pokazujemy drogę powrotną do
          istniejącego. Formularz zostaje w pełni dostępny: zagranie w inną grę
          tego samego wieczoru jest w porządku. */}
      {continuedPlay ? (
        <div className="rounded-2xl border border-[#b9884a]/55 bg-[#f7e7c4]/70 px-4 py-3 text-sm text-[#5c3f1f]">
          <p>
            To spotkanie kontynuuje partię{" "}
            <span className="font-semibold">{continuedPlay.gameTitle}</span>.
            Jeśli zapisujesz właśnie tę grę —{" "}
            <Link
              href={`/kronika/${continuedPlay.playId}/edytuj`}
              className="font-semibold underline decoration-[#b37a46]/60 underline-offset-4"
            >
              wróć do tamtego wpisu
            </Link>{" "}
            zamiast zakładać nowy.
          </p>
        </div>
      ) : null}

      {/* Border arkusza sam trzyma treść z dala od postrzępionych brzegów,
          więc formularz nie potrzebuje własnego paddingu. */}
      <section
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="chronicle-sheet anim-rise-in-fast"
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
      </section>
    </div>
  );
}
