import type { ReactNode } from "react";
import Link from "next/link";
import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/layout/app-navigation";
import { SectionBackground } from "@/components/layout/section-background";
import { LogoMark } from "@/components/ui/logo-mark";
import { getMemberInitial } from "@/features/auth/current-member";
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
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <DesktopNavigation member={member} activeClass={activeClass} />
      <div className="cabin-ambient min-w-0">
        <SectionBackground />
        <header className="wood-grain relative z-10 flex h-17 items-center justify-between gap-2 border-b border-white/8 px-3 sm:px-4 lg:hidden">
          <LogoMark compact tone="light" />
          {activeClass ? (
            <Link
              href="/profil"
              aria-label={`Aktywna klasa: ${activeClass.name}`}
              className="flex min-w-0 items-center gap-1.5"
            >
              <ActiveClassEmblem
                activeClass={activeClass}
                sizeClass="size-10 shrink-0 min-[420px]:size-12"
              />
              <span className="hidden max-w-14 text-xs leading-4 font-bold tracking-wide text-[#f3a849] uppercase min-[420px]:block">
                {activeClass.name}
              </span>
            </Link>
          ) : null}
          <div className="min-w-0 rounded-full border border-white/10 bg-black/18 px-2 py-1.5 text-center shadow-[0_10px_18px_rgba(17,8,5,0.18)] sm:px-3.5">
            <span className="font-display text-[0.72rem] font-semibold text-[#e2b578] min-[420px]:text-[0.84rem]">
              Twoje Punkty:
            </span>{" "}
            <span className="font-display text-[0.95rem] font-semibold text-[#fff1dc] min-[420px]:text-[1.05rem]">
              {currentPoints.toLocaleString("pl-PL")} pkt
            </span>
          </div>
          <Link
            href="/profil"
            aria-label="Przejdź do profilu"
            className="focus-visible:outline-gold grid size-9 place-items-center overflow-hidden rounded-full border border-white/10 bg-white/8 text-xs font-bold text-[#f2ad77] focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
              <img
                src={member.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              getMemberInitial(member.displayName)
            )}
          </Link>
        </header>
        <main className="relative z-10 mx-auto w-full max-w-[90rem] px-4 pt-6 pb-28 sm:px-6 lg:px-10 lg:py-10 xl:px-12">
          {children}
        </main>
        <MobileNavigation />
      </div>
    </div>
  );
}
