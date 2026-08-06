import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { updatePlayAction } from "@/features/plays/actions";
import { PlayForm } from "@/features/plays/play-form";
import { getPlayEditFormData } from "@/features/plays/queries";

export const metadata: Metadata = { title: "Edytuj partię" };

export default async function EditPlayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { id } = await params;
  const formData = await getPlayEditFormData(id);
  if (!formData?.play || !formData.play.canEdit) notFound();

  return (
    // Ta sama kolumna i ta sama szerokość co w „Zapisz partię” — oba formularze
    // muszą wyglądać identycznie.
    <div className="chronicle-sheet-stack chronicle-sheet-stack-wide space-y-4">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          Kronika
        </p>
        <h1 className="font-display text-cream mt-2 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
          Edytuj partię
        </h1>
      </header>

      {/* Powrót pod tytułem i przy prawej krawędzi, żeby nie wyprzedzał nagłówka. */}
      <div className="flex justify-end">
        <ActionLink
          action="neutral"
          size="compact"
          emphasis="secondary"
          href={`/kronika/${id}`}
        >
          Wróć do partii
        </ActionLink>
      </div>

      {/* Border arkusza sam trzyma treść z dala od postrzępionych brzegów,
          więc formularz nie potrzebuje własnego paddingu. */}
      <section
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="chronicle-sheet anim-rise-in-fast"
      >
        <PlayForm
          mode="edit"
          action={updatePlayAction.bind(null, id)}
          initialValues={formData.initialValues}
          games={formData.games}
          meetings={formData.meetings}
          members={formData.members}
          submitLabel="Zapisz zmiany"
          pendingLabel="Zapisywanie..."
          playId={id}
          initialPhotos={formData.play.photos}
        />
      </section>
    </div>
  );
}
