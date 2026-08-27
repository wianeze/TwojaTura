import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";
import { getUserPointBalanceResult } from "@/features/points/queries";
import { getUserTukatBalanceResult } from "@/features/missions/queries";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const memberState = await getCurrentMember();
  if (memberState.status === "anonymous") redirect("/logowanie");
  if (memberState.status !== "active-member") redirect("/brak-dostepu");

  const supabase = await createClient();
  const activeClassKey = memberState.member.activeClassKey;
  const activeClassPromise = activeClassKey
    ? supabase
        .from("class_definitions")
        .select("class_key, name, description, playstyle, icon_path")
        .eq("class_key", activeClassKey)
        .eq("is_active", true)
        .maybeSingle()
    : Promise.resolve({ data: null });
  const [balanceResult, tukatBalanceResult, classDefinitionResult] =
    await Promise.all([
      getUserPointBalanceResult(memberState.member.id),
      getUserTukatBalanceResult(memberState.member.id),
      activeClassPromise,
    ]);
  let activeClass: ActiveClassView | null = null;

  if (classDefinitionResult.data) {
    activeClass = {
      key: classDefinitionResult.data.class_key,
      name: classDefinitionResult.data.name,
      description: classDefinitionResult.data.description,
      playstyle: classDefinitionResult.data.playstyle,
      iconPath: classDefinitionResult.data.icon_path,
    };
  }

  return (
    <AppShell
      member={memberState.member}
      currentPoints={balanceResult.data?.total_points ?? 0}
      // Brak wiersza w tukat_balances = gracz nie dostał jeszcze żadnej
      // wypłaty. To zwykłe zero, nie brak danych — ledger zostaje pusty.
      currentTukats={Number(tukatBalanceResult.data?.total_tukats ?? 0)}
      activeClass={activeClass}
    >
      {children}
    </AppShell>
  );
}
