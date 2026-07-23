import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
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
    <div className="space-y-4">
      <Link
        href={`/kronika/${id}`}
        className="paper-wash inline-flex rounded-full px-4 py-2 text-xs font-bold text-[#6a4d36]"
      >
        ← Wróć do partii
      </Link>

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

      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(1)}ms` }}
        className="anim-rise-in-fast paper-wash p-4 sm:p-5"
      >
        <PlayForm
          action={updatePlayAction.bind(null, id)}
          initialValues={formData.initialValues}
          games={formData.games}
          meetings={formData.meetings}
          members={formData.members}
          submitLabel="Zapisz zmiany"
          pendingLabel="Zapisywanie..."
        />
      </Panel>
    </div>
  );
}
