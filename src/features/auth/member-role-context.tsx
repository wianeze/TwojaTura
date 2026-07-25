"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { MemberRole } from "./types";

const MemberRoleContext = createContext<MemberRole | null>(null);

/**
 * Makes the current member's role available to client components deep in
 * the tree (submit buttons, RSVP/vote toggles, etc.) without prop-drilling
 * it through every page. Mounted once in AppShell, fed by the member the
 * (app) layout already fetches server-side.
 *
 * This is UI-only convenience — the real enforcement is RLS
 * (private.current_user_can_write()) and requireWriteAccess() on the
 * server. Hiding a button here never has to be perfectly exhaustive for
 * the app to stay safe.
 */
export function MemberRoleProvider({
  role,
  children,
}: {
  role: MemberRole;
  children: ReactNode;
}) {
  return (
    <MemberRoleContext.Provider value={role}>
      {children}
    </MemberRoleContext.Provider>
  );
}

export function useMemberRole(): MemberRole {
  const role = useContext(MemberRoleContext);
  if (role === null) {
    throw new Error("useMemberRole must be used within MemberRoleProvider");
  }
  return role;
}

export function useCanWrite(): boolean {
  return useMemberRole() !== "observer";
}
