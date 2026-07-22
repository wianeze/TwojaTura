"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/logo-mark";
import {
  NavigationIcon,
  type NavigationIconName,
} from "@/components/layout/navigation-icon";
import { signOutAction } from "@/features/auth/actions";
import { getMemberInitial } from "@/features/auth/current-member";
import type { CurrentMember } from "@/features/auth/types";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";
import { getActiveClassBackdropGradient } from "@/features/legendarium/leaderboard-presentation";

type NavigationItem = { href: string; label: string; icon: NavigationIconName };

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Stół", icon: "dashboard" },
  { href: "/gry", label: "Półka", icon: "shelf" },
  { href: "/legendarium", label: "Legendarium", icon: "games" },
  { href: "/kalendarium", label: "Kalendarium", icon: "meetings" },
  { href: "/kronika", label: "Kronika", icon: "plays" },
];

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function DesktopNavigation({
  member,
  activeClass,
}: {
  member: CurrentMember;
  activeClass: ActiveClassView | null;
}) {
  const pathname = usePathname();

  return (
    <aside className="wood-grain text-cream sticky top-0 hidden h-screen border-r border-white/8 px-5 py-7 lg:flex lg:flex-col">
      <div className="flex min-h-40 items-center justify-center px-2">
        <LogoMark tone="light" />
      </div>
      <nav className="mt-5 flex flex-col gap-1.5" aria-label="Główna nawigacja">
        {navigationItems.map((item) => {
          const active = isCurrentPath(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors ${active ? "bg-gold text-wood-dark shadow-[0_10px_30px_rgba(214,160,68,0.18)]" : "hover:text-cream text-[#cdbfae] hover:bg-white/7"}`}
            >
              <NavigationIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto">
        {activeClass ? (
          <div
            className="relative isolate mb-5 flex min-h-0 flex-col items-center justify-center overflow-visible rounded-[1.6rem] px-2 py-2 text-center"
            title={`Aktywna klasa: ${activeClass.name}`}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -inset-x-10 -inset-y-8 -z-10 blur-xl"
              style={{
                backgroundImage: getActiveClassBackdropGradient(
                  activeClass.key,
                ),
              }}
            />
            <ActiveClassEmblem
              activeClass={activeClass}
              sizeClass="size-[clamp(10rem,15vw,14.5rem)] max-w-full shrink-0"
              showAura={false}
              imageSizes="232px"
            />
            <span className="font-class-title mt-1 text-base font-bold tracking-[0.1em] text-[#ef8d36] uppercase">
              {activeClass.name}
            </span>
          </div>
        ) : null}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-2.5">
          <Link
            href="/profil"
            className="flex items-center gap-3 rounded-xl p-1 transition-colors hover:bg-white/7"
          >
            {member.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external user-provided URL
              <img
                src={member.avatarUrl}
                alt=""
                className="size-10 rounded-full object-cover"
              />
            ) : (
              <span className="bg-ember/20 grid size-10 place-items-center rounded-full text-sm font-bold text-[#f2ad77]">
                {getMemberInitial(member.displayName)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {member.displayName}
              </span>
              <span className="block text-xs text-[#aa9a8a]">Karta Gracza</span>
            </span>
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              className="mt-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[#cdbfae] transition-colors hover:bg-white/7 hover:text-white"
            >
              Wyloguj się
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  return (
    <nav
      className="wood-grain shadow-warm fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-white/10 p-1.5 backdrop-blur lg:hidden"
      aria-label="Główna nawigacja"
    >
      {navigationItems.map((item) => {
        const active = isCurrentPath(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[clamp(0.5rem,2.45vw,0.65rem)] leading-none font-semibold transition-colors ${active ? "bg-gold text-wood-dark" : "text-[#cdbfae]"}`}
          >
            <NavigationIcon name={item.icon} className="size-[1.15rem]" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
