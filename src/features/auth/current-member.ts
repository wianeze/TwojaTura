import type { CurrentMember, CurrentMemberState, MemberRole } from "./types";

type MembershipRow = {
  role: MemberRole;
  is_active: boolean;
};

type ProfileRow = {
  id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
};

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
    role: membership.role,
  };

  return { status: "active-member", member };
}

export function getMemberInitial(displayName: string) {
  return displayName.trim().charAt(0).toLocaleUpperCase("pl-PL") || "?";
}
