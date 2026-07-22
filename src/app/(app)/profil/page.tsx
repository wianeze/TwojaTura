import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Panel } from "@/components/ui/panel";
import { signOutAction } from "@/features/auth/actions";
import { getMemberInitial } from "@/features/auth/current-member";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { ProfileForm } from "@/features/auth/profile-form";
import { getAchievementClassData } from "@/features/legendarium/queries";
import { ProfileAchievementsPanel } from "@/features/legendarium/profile-achievements-panel";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import { listRecentMemberPlays } from "@/features/plays/queries";
import { RecentMemberPlaysPanel } from "@/features/plays/recent-plays-list";

export const metadata: Metadata = { title: "Karta Gracza" };

export default async function ProfilePage() {
  const state = await getCurrentMember();
  if (state.status !== "active-member") redirect("/brak-dostepu");
  const { member } = state;
  const [recentPlays, achievementData] = await Promise.all([
    listRecentMemberPlays(member.id),
    getAchievementClassData(member.id),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Panel className="paper-wash p-6 sm:p-8">
        <div className="flex items-center gap-4">
          <span className="relative shrink-0">
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
              <img
                src={member.avatarUrl}
                alt=""
                className="size-20 rounded-full object-cover shadow-lg"
              />
            ) : (
              <span className="bg-brand text-cream grid size-20 place-items-center rounded-full text-2xl font-bold shadow-lg">
                {getMemberInitial(member.displayName)}
              </span>
            )}
            <ActiveClassEmblem
              activeClass={achievementData.currentActiveClass}
              sizeClass="size-11"
              className="absolute -right-2 -bottom-2"
            />
          </span>
          <div>
            <p className="text-accent text-xs font-bold tracking-[0.16em] uppercase">
              Twoje konto
            </p>
            <h1 className="font-display mt-1 text-3xl font-semibold">
              Karta Gracza
            </h1>
          </div>
        </div>
        <ProfileForm member={member} />
        <form action={signOutAction} className="mt-4 text-center">
          <button
            type="submit"
            className="text-accent text-sm font-semibold underline-offset-4 hover:underline"
          >
            Wyloguj się
          </button>
        </form>
      </Panel>

      <ProfileAchievementsPanel
        achievements={achievementData.achievements}
        classes={achievementData.classes}
        activeClass={achievementData.currentActiveClass}
      />

      <RecentMemberPlaysPanel
        title="Ostatnie partie"
        items={recentPlays}
        emptyMessage="Nie masz jeszcze zapisanych partii w Kronice."
      />
    </div>
  );
}
