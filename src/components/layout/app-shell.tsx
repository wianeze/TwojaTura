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

type AppShellProps = {
  children: ReactNode;
  member: CurrentMember;
  currentPoints: number;
};

export function AppShell({ children, member, currentPoints }: AppShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <DesktopNavigation member={member} />
      <div className="cabin-ambient min-w-0">
        <SectionBackground />
        <header className="wood-grain relative z-10 flex h-17 items-center justify-between gap-3 border-b border-white/8 px-4 lg:hidden">
          <LogoMark compact tone="light" />
          <div className="rounded-full border border-white/10 bg-black/18 px-3.5 py-1.5 text-center shadow-[0_10px_18px_rgba(17,8,5,0.18)]">
            <span className="font-display text-[0.84rem] font-semibold text-[#e2b578]">
              Twoje Punkty:
            </span>{" "}
            <span className="font-display text-[1.05rem] font-semibold text-[#fff1dc]">
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
