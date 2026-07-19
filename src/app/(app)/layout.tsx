import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const memberState = await getCurrentMember();
  if (memberState.status === "anonymous") redirect("/logowanie");
  if (memberState.status !== "active-member") redirect("/brak-dostepu");

  const supabase = await createClient();
  const { data: balance } = await supabase
    .from("user_point_balances")
    .select("total_points")
    .eq("user_id", memberState.member.id)
    .maybeSingle();

  return (
    <AppShell
      member={memberState.member}
      currentPoints={balance?.total_points ?? 0}
    >
      {children}
    </AppShell>
  );
}
