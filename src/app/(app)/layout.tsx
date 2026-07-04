import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const memberState = await getCurrentMember();
  if (memberState.status === "anonymous") redirect("/logowanie");
  if (memberState.status !== "active-member") redirect("/brak-dostepu");
  return <AppShell member={memberState.member}>{children}</AppShell>;
}
