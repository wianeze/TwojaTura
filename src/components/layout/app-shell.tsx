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

type AppShellProps = { children: ReactNode; member: CurrentMember };

export function AppShell({ children, member }: AppShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <DesktopNavigation member={member} />
      <div className="cabin-ambient min-w-0">
        <SectionBackground />
        <header className="wood-grain relative z-10 flex h-17 items-center justify-between border-b border-white/8 px-4 lg:hidden">
          <LogoMark compact tone="light" />
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
