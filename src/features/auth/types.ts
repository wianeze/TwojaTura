export type MemberRole = "member" | "admin" | "observer";

export type CurrentMember = {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string | null;
  activePortraitFrameKey?: string | null;
  activeClassKey?: string | null;
  equippedTitle?: {
    id: string;
    name: string;
    rarity: "common" | "rare" | "epic" | "legendary";
  } | null;
  role: MemberRole;
};

export type CurrentMemberState =
  | { status: "anonymous" }
  | { status: "authenticated-but-not-member"; userId: string }
  | { status: "inactive-member"; userId: string }
  | { status: "active-member"; member: CurrentMember };
