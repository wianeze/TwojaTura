import type { ReactNode } from "react";
import Link from "next/link";
import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/layout/app-navigation";
import { ClassTextureLayer } from "@/components/layout/class-texture-layer";
import { SectionBackground } from "@/components/layout/section-background";
import { LogoMark } from "@/components/ui/logo-mark";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import { MemberRoleProvider } from "@/features/auth/member-role-context";
import type { CurrentMember } from "@/features/auth/types";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";

type AppShellProps = {
  children: ReactNode;
  member: CurrentMember;
  currentPoints: number;
  activeClass: ActiveClassView | null;
};

export function AppShell({
  children,
  member,
  currentPoints,
  activeClass,
}: AppShellProps) {
  return (
    <MemberRoleProvider role={member.role}>
      <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <DesktopNavigation member={member} activeClass={activeClass} />
        <div className="cabin-ambient min-w-0">
          <SectionBackground />
          {/* `relative z-10` już tworzy kontekst układania, więc ujemny z-index
              tekstury zostaje wewnątrz paska. overflow-hidden domyka temat na
              wypadek zaokrągleń w przyszłości — emblemat klasy z poświatą
              mieści się w 68px wysokości paska, więc nic nie przycina. */}
          <header className="wood-grain relative z-10 flex h-17 items-center justify-between gap-2 overflow-hidden border-b border-white/8 px-3 sm:px-4 lg:hidden">
            <ClassTextureLayer classKey={activeClass?.key ?? null} />

            <LogoMark compact tone="light" />
            {activeClass ? (
              <Link
                href="/profil"
                aria-label={`Aktywna klasa: ${activeClass.name}`}
                className="-ml-1.5 flex min-w-0 items-center gap-1.5"
              >
                <ActiveClassEmblem
                  activeClass={activeClass}
                  sizeClass="size-10 shrink-0 min-[420px]:size-12"
                />
                <span className="max-w-14 text-xs leading-4 font-bold tracking-wide text-[#f3a849] uppercase">
                  {activeClass.name}
                </span>
              </Link>
            ) : null}
            <div className="flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/18 px-2 py-1 whitespace-nowrap shadow-[0_10px_18px_rgba(17,8,5,0.18)] sm:px-3">
              <span className="font-display flex flex-col items-center text-center text-[0.56rem] leading-[1.05] font-semibold text-[#e2b578] min-[420px]:text-[0.68rem]">
                <span>Twoje</span>
                <span>Punkty:</span>
              </span>
              <span className="font-display text-[0.8rem] font-semibold text-[#fff1dc] min-[420px]:text-[1.05rem]">
                {currentPoints.toLocaleString("pl-PL")} pkt
              </span>
            </div>
            <Link
              href="/profil"
              aria-label="Przejdź do profilu"
              className="focus-visible:outline-gold shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <PlayerPortraitFrame
                avatarUrl={member.avatarUrl}
                name={member.displayName}
                frameType={member.activePortraitFrameKey}
                size="compact"
                className="w-8 min-[420px]:w-9"
              />
            </Link>
          </header>
          <main className="relative z-10 mx-auto w-full max-w-[90rem] px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:py-10 xl:px-12">
            {children}
          </main>
          <MobileNavigation />
        </div>
      </div>
    </MemberRoleProvider>
  );
}
