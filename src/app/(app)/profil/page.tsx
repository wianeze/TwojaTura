import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileRouteLoading } from "@/components/layout/main-route-loading";
import { Panel } from "@/components/ui/panel";
import { signOutAction } from "@/features/auth/actions";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { ProfileForm } from "@/features/auth/profile-form";
import { getAchievementClassData } from "@/features/legendarium/queries";
import { PlayerProfileShowcase } from "@/features/profile/player-profile-showcase";
import { getPlayerProfileData } from "@/features/profile/queries";
import { getPortraitFrameStoreData } from "@/features/profile/portrait-frames";
import { PushSettingsPanel } from "@/features/push/push-settings-panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { profileServerOperation } from "@/lib/server-performance";

export const metadata: Metadata = { title: "Karta Gracza" };

async function ProfileContent() {
  const state = await getCurrentMember();
  if (state.status !== "active-member") redirect("/brak-dostepu");
  const { member } = state;
  const [profileData, achievementData, portraitFrameData] =
    await profileServerOperation("/profil", () =>
      Promise.all([
        getPlayerProfileData(member.id),
        getAchievementClassData(member.id),
        getPortraitFrameStoreData(member.id, member.activePortraitFrameKey),
      ]),
    );

  return (
    <div className="mx-auto max-w-[96rem] space-y-4">
      <PlayerProfileShowcase
        member={member}
        profile={profileData}
        achievements={achievementData.achievements}
        classes={achievementData.classes}
        activeClass={achievementData.currentActiveClass}
        portraitFrameData={portraitFrameData}
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(5)}ms` }}
          className="anim-rise-in-fast paper-wash p-5 sm:p-6"
        >
          <p className="text-accent text-[0.62rem] font-bold tracking-[0.17em] uppercase">
            Ustawienia bohatera
          </p>
          <h2 className="font-display mt-1 text-2xl font-bold">
            Dane Karty Gracza
          </h2>
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

        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(6)}ms` }}
          className="anim-rise-in-fast paper-wash p-5 sm:p-6"
        >
          <PushSettingsPanel />
        </Panel>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense fallback={<ProfileRouteLoading />}>
      <ProfileContent />
    </Suspense>
  );
}
