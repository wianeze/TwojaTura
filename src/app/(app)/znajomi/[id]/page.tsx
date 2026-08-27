import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { getMemberInitial } from "@/features/auth/current-member";
import {
  getVisibleMemberProfile,
  listRecentMemberPlays,
} from "@/features/plays/queries";
import { RecentMemberPlaysPanel } from "@/features/plays/recent-plays-list";

export const metadata: Metadata = { title: "Gracz" };

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const memberState = await getCurrentMember();
  if (memberState.status !== "active-member") notFound();

  const { id } = await params;
  const [profile, recentPlays] = await Promise.all([
    getVisibleMemberProfile(id),
    listRecentMemberPlays(id),
  ]);

  if (!profile) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Panel
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast paper-wash p-6 sm:p-8"
      >
        <div className="flex items-center gap-4">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
            <img
              src={profile.avatarUrl}
              alt=""
              className="size-20 rounded-full object-cover shadow-lg"
            />
          ) : (
            <span className="bg-brand text-cream grid size-20 place-items-center rounded-full text-2xl font-bold shadow-lg">
              {getMemberInitial(profile.displayName)}
            </span>
          )}
          <div>
            <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
              Przy stole
            </p>
            <PlayerDisplayName
              displayName={profile.displayName}
              title={profile.equippedTitle}
              variant="hero"
              className="font-display mt-1 text-3xl font-semibold"
            />
          </div>
        </div>
      </Panel>

      <RecentMemberPlaysPanel
        title="Ostatnie partie"
        items={recentPlays}
        emptyMessage="Ten gracz nie ma jeszcze zapisanych partii w Kronice."
        entranceIndex={1}
      />
    </div>
  );
}
