import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const memberState = await getCurrentMember();
  if (memberState.status === "anonymous") redirect("/logowanie");
  if (memberState.status !== "active-member") redirect("/brak-dostepu");

  const supabase = await createClient();
  const [balanceResult, profileResult] = await Promise.all([
    supabase
      .from("user_point_balances")
      .select("total_points")
      .eq("user_id", memberState.member.id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("active_class_key")
      .eq("id", memberState.member.id)
      .maybeSingle(),
  ]);
  const activeClassKey = profileResult.data?.active_class_key;
  let activeClass: ActiveClassView | null = null;

  if (activeClassKey) {
    const { data: classDefinition } = await supabase
      .from("class_definitions")
      .select("class_key, name, description, playstyle, icon_path")
      .eq("class_key", activeClassKey)
      .eq("is_active", true)
      .maybeSingle();

    if (classDefinition) {
      activeClass = {
        key: classDefinition.class_key,
        name: classDefinition.name,
        description: classDefinition.description,
        playstyle: classDefinition.playstyle,
        iconPath: classDefinition.icon_path,
      };
    }
  }

  return (
    <AppShell
      member={memberState.member}
      currentPoints={balanceResult.data?.total_points ?? 0}
      activeClass={activeClass}
    >
      {children}
    </AppShell>
  );
}
