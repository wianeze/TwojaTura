import type { CurrentMember, CurrentMemberState, MemberRole } from "./types";

type CurrentMemberQueryError = {
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

type MembershipRow = {
  role: MemberRole;
  is_active: boolean;
};

type ProfileRow = {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  active_portrait_frame_key?: string | null;
  active_class_key?: string | null;
  equipped_title?: {
    id: string;
    name: string;
    rarity: string;
  } | null;
};

export function assertCurrentMemberQuerySuccess(
  scope: "membership" | "profile",
  userId: string,
  error: CurrentMemberQueryError | null,
): asserts error is null {
  if (!error) return;

  if (process.env.NODE_ENV !== "production") {
    console.error("[getCurrentMember] Supabase query failed", {
      scope,
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
  }

  throw new Error(
    `Nie udało się pobrać ${scope === "membership" ? "członkostwa" : "profilu"} użytkownika.`,
  );
}

export function mapCurrentMember(
  userId: string,
  membership: MembershipRow | null,
  profile: ProfileRow | null,
): CurrentMemberState {
  if (!membership) {
    return { status: "authenticated-but-not-member", userId };
  }

  if (!membership.is_active) {
    return { status: "inactive-member", userId };
  }

  if (!profile) {
    return { status: "authenticated-but-not-member", userId };
  }

  const member: CurrentMember = {
    id: profile.id,
    displayName: profile.display_name,
    email: profile.email,
    avatarUrl: profile.avatar_url,
    activePortraitFrameKey: profile.active_portrait_frame_key ?? null,
    ...(profile.active_class_key !== undefined
      ? { activeClassKey: profile.active_class_key }
      : {}),
    ...(profile.equipped_title !== undefined
      ? {
          equippedTitle: profile.equipped_title
            ? {
                ...profile.equipped_title,
                rarity: (["common", "rare", "epic", "legendary"].includes(
                  profile.equipped_title.rarity,
                )
                  ? profile.equipped_title.rarity
                  : "common") as "common" | "rare" | "epic" | "legendary",
              }
            : null,
        }
      : {}),
    role: membership.role,
  };

  return { status: "active-member", member };
}

export function getMemberInitial(displayName: string) {
  return displayName.trim().charAt(0).toLocaleUpperCase("pl-PL") || "?";
}
