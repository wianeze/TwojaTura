import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ActionLink } from "@/components/ui/action-button";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import {
  getPlayTablePhase,
  toLivePlayDurationMinutes,
} from "@/features/meetings/live-play";
import { updatePlayAction } from "@/features/plays/actions";
import { PlayForm } from "@/features/plays/play-form";
import { getPlayEditFormData } from "@/features/plays/queries";

export const metadata: Metadata = { title: "Edytuj partię" };

export default async function EditPlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ powrot?: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { id } = await params;
  const { powrot } = await searchParams;
  const formData = await getPlayEditFormData(id);
  if (!formData?.play || !formData.play.canEdit) notFound();

  /*
   * Rozliczenie partii ze Stołu to TA SAMA edycja wpisu Kroniki, a nie drugi
   * formularz wyniku. Zmienia się wyłącznie obudowa:
   *   * po zapisie wracamy na Stół, a nie do Kroniki,
   *   * nagłówek mówi o wieczorze i o tym, co realnie zostało do zrobienia,
   *   * partii wciąż granej (ktoś wszedł tu z „GRAMY!”) podpowiadamy czas
   *     trwania z rzeczywistego startu — partia już zakończona ma go zapisanego.
   * Reguły wyniku (WIN/LOST w kooperacji, miejsca w rywalizacji), punkty i
   * odznaki zostają nietknięte — liczy je ta sama ścieżka co zawsze.
   */
  const play = formData.play;
  const phase = getPlayTablePhase(play);
  const isTableFlow =
    powrot === "stol" && (phase === "running" || phase === "awaiting-result");
  // Czas biegnącej partii nie jest jeszcze nigdzie zapisany — tylko wtedy warto
  // go podpowiadać. Partia zakończona ma już policzony łączny czas sesji.
  const suggestedDuration =
    phase === "running" && play.liveStartedAt
      ? toLivePlayDurationMinutes(play.liveStartedAt, new Date())
      : null;

  const initialValues = isTableFlow
    ? {
        ...formData.initialValues,
        status: "completed" as const,
        durationMinutes:
          formData.initialValues.durationMinutes ||
          (suggestedDuration === null ? "" : String(suggestedDuration)),
      }
    : formData.initialValues;

  return (
    // Ta sama kolumna i ta sama szerokość co w „Zapisz partię” — oba formularze
    // muszą wyglądać identycznie.
    <div className="chronicle-sheet-stack chronicle-sheet-stack-wide space-y-4">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast"
      >
        <p className="text-[0.62rem] font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
          {isTableFlow ? "Wieczór przy stole" : "Kronika"}
        </p>
        <h1 className="font-display text-cream mt-2 text-[1.85rem] font-semibold tracking-tight sm:text-[2.15rem]">
          {isTableFlow ? "Uzupełnij wynik" : "Edytuj partię"}
        </h1>
      </header>

      {/* Powrót pod tytułem i przy prawej krawędzi, żeby nie wyprzedzał nagłówka. */}
      <div className="flex justify-end">
        <ActionLink
          action="neutral"
          size="compact"
          emphasis="secondary"
          href={isTableFlow ? "/" : `/kronika/${id}`}
        >
          {isTableFlow ? "Wróć do Stołu" : "Wróć do partii"}
        </ActionLink>
      </div>

      {isTableFlow ? (
        <div className="rounded-2xl border border-[#b9884a]/55 bg-[#f7e7c4]/70 px-4 py-3 text-sm text-[#5c3f1f]">
          <p>
            Czas gry policzyliśmy z rzeczywistych sesji przy stole — popraw go,
            jeśli trzeba. Po zapisaniu wyniku wrócisz na Stół i wybierzesz
            kolejną grę albo zakończysz spotkanie.
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
          mode="edit"
          action={updatePlayAction.bind(null, id)}
          initialValues={initialValues}
          games={formData.games}
          meetings={formData.meetings}
          members={formData.members}
          submitLabel={isTableFlow ? "Zapisz wynik partii" : "Zapisz zmiany"}
          pendingLabel="Zapisywanie..."
          playId={id}
          initialPhotos={formData.play.photos}
          returnTo={isTableFlow ? "stol" : undefined}
        />
      </section>
    </div>
  );
}
