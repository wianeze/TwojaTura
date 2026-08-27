import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileRouteLoading } from "@/components/layout/main-route-loading";
import { ActionButton } from "@/components/ui/action-button";
import { Panel } from "@/components/ui/panel";
import { SectionFrame } from "@/components/ui/section-frame";
import { signOutAction } from "@/features/auth/actions";
import { getCurrentMember } from "@/features/auth/queries/get-current-member";
import { ProfileForm } from "@/features/auth/profile-form";
import { getAchievementClassData } from "@/features/legendarium/queries";
import { PlayerProfileShowcase } from "@/features/profile/player-profile-showcase";
import { getPlayerProfileData } from "@/features/profile/queries";
import { getPortraitFrameStoreData } from "@/features/profile/portrait-frames";
import { PlayerCustomizationStore } from "@/features/profile/player-customization-store";
import { getPlayerTitleStoreData } from "@/features/profile/player-titles";
import { PushSettingsPanel } from "@/features/push/push-settings-panel";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { profileServerOperation } from "@/lib/server-performance";

export const metadata: Metadata = { title: "Karta Gracza" };

const SIGN_OUT_FORM_ID = "profil-wyloguj";

async function ProfileContent() {
  const state = await getCurrentMember();
  if (state.status !== "active-member") redirect("/brak-dostepu");
  const { member } = state;
  const [profileData, achievementData, portraitFrameData, titleStoreData] =
    await profileServerOperation("/profil", () =>
      Promise.all([
        getPlayerProfileData(member.id),
        getAchievementClassData(member.id),
        getPortraitFrameStoreData(member.id, member.activePortraitFrameKey),
        getPlayerTitleStoreData(member.id, member.equippedTitle?.id),
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
        customization={
          <PlayerCustomizationStore
            titleData={titleStoreData}
            frameData={portraitFrameData}
            avatarUrl={member.avatarUrl}
            displayName={member.displayName}
            tukatBalance={profileData.totalTukats}
          />
        }
      />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(5)}ms` }}
          className="section-frame anim-rise-in-fast"
        >
          <SectionFrame>
            <h2 className="font-display text-center text-xl font-bold sm:text-left sm:text-2xl">
              Dane Karty Gracza
            </h2>
            {/*
              „Wyloguj się” ma własną Server Action, więc potrzebuje własnego
              <form> — a ten nie może stać wewnątrz formularza Karty Gracza
              (zagnieżdżone formularze to niepoprawny HTML). Formularz zostaje
              więc tutaj, pusty, a sam przycisk wędruje do rzędu w ProfileForm
              i wiąże się z nim atrybutem `form`. Czerwona plakietka
              (act-danger) bez ikony: piktogram tego wariantu to kosz, czyli
              symbol usuwania, a wylogowanie niczego nie kasuje. ActionButton,
              nie ActionSubmitButton, bo ten drugi bramkuje się na useCanWrite
              i przy roli tylko-do-odczytu schowałby wylogowanie.
            */}
            <form id={SIGN_OUT_FORM_ID} action={signOutAction} />
            <ProfileForm
              member={member}
              secondaryAction={
                <ActionButton
                  type="submit"
                  form={SIGN_OUT_FORM_ID}
                  action="danger"
                  size="default"
                  withIcon={false}
                >
                  Wyloguj się
                </ActionButton>
              }
            />
          </SectionFrame>
        </Panel>

        <Panel
          style={{ animationDelay: `${getEntranceStaggerDelayMs(6)}ms` }}
          className="section-frame anim-rise-in-fast"
        >
          <SectionFrame>
            <PushSettingsPanel />
          </SectionFrame>
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
