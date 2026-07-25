import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";

export default async function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const memberState = await getCurrentMember();

  if (
    memberState.status !== "active-member" ||
    memberState.member.role !== "admin"
  ) {
    redirect("/");
  }

  return children;
}
