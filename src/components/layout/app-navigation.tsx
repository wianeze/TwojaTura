"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/logo-mark";
import {
  NavigationIcon,
  type NavigationIconName,
} from "@/components/layout/navigation-icon";

type NavigationItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: NavigationIconName;
};

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Dashboard", shortLabel: "Start", icon: "dashboard" },
  {
    href: "/moja-polka",
    label: "Moja półka",
    shortLabel: "Półka",
    icon: "shelf",
  },
  { href: "/gry", label: "Biblioteka", shortLabel: "Gry", icon: "games" },
  {
    href: "/spotkania",
    label: "Spotkania",
    shortLabel: "Spotkania",
    icon: "meetings",
  },
  {
    href: "/rozgrywki",
    label: "Rozgrywki",
    shortLabel: "Partie",
    icon: "plays",
  },
];

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

export function DesktopNavigation() {
  const pathname = usePathname();

  return (
    <aside className="wood-grain text-cream sticky top-0 hidden h-screen border-r border-white/8 px-5 py-7 lg:flex lg:flex-col">
      <div className="px-2">
        <LogoMark tone="light" />
      </div>

      <nav
        className="mt-11 flex flex-1 flex-col gap-1.5"
        aria-label="Główna nawigacja"
      >
        {navigationItems.map((item) => {
          const active = isCurrentPath(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-semibold transition-colors ${
                active
                  ? "bg-gold text-wood-dark shadow-[0_10px_30px_rgba(214,160,68,0.18)]"
                  : "hover:text-cream text-[#cdbfae] hover:bg-white/7"
              }`}
            >
              <NavigationIcon name={item.icon} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/profil"
        className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-colors hover:bg-white/9"
      >
        <span className="bg-ember/20 grid size-10 place-items-center rounded-full text-sm font-bold text-[#f2ad77]">
          G
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            Gość przy stole
          </span>
          <span className="block text-xs text-[#aa9a8a]">Profil</span>
        </span>
      </Link>
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
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-2 text-[0.65rem] font-semibold transition-colors ${
              active ? "bg-gold text-wood-dark" : "text-[#cdbfae]"
            }`}
          >
            <NavigationIcon name={item.icon} className="size-[1.15rem]" />
            <span className="truncate">{item.shortLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
}
