import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { PlayDetailsCard } from "@/features/plays/play-details-card";
import { getPlayDetails } from "@/features/plays/queries";

export const metadata: Metadata = { title: "Szczegóły partii" };

export default async function PlayDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { id } = await params;
  const play = await getPlayDetails(id);
  if (!play) notFound();

  return <PlayDetailsCard play={play} />;
}
