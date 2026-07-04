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
  icon: NavigationIconName;
};

const navigationItems: NavigationItem[] = [
  {
    href: "/",
    label: "Stół",
    icon: "dashboard",
  },
  {
    href: "/gry",
    label: "Półka",
    icon: "shelf",
  },
  {
    href: "/legendarium",
    label: "Legendarium",
    icon: "games",
  },
  {
    href: "/kalendarium",
    label: "Kalendarium",
    icon: "meetings",
  },
  {
    href: "/kronika",
    label: "Kronika",
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
      <div className="flex min-h-40 items-center justify-center px-2">
        <LogoMark tone="light" />
      </div>

      <nav
        className="mt-5 flex flex-1 flex-col gap-1.5"
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
          <span className="block text-xs text-[#aa9a8a]">Karta Gracza</span>
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
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[clamp(0.5rem,2.45vw,0.65rem)] leading-none font-semibold transition-colors ${
              active ? "bg-gold text-wood-dark" : "text-[#cdbfae]"
            }`}
          >
            <NavigationIcon name={item.icon} className="size-[1.15rem]" />
            <span className="whitespace-nowrap">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
