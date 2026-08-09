"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "@/components/ui/logo-mark";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import { ClassTextureLayer } from "@/components/layout/class-texture-layer";
import {
  NavigationIcon,
  type NavigationIconName,
} from "@/components/layout/navigation-icon";
import { signOutAction } from "@/features/auth/actions";
import { useMemberRole } from "@/features/auth/member-role-context";
import type { CurrentMember } from "@/features/auth/types";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";
import { getActiveClassBackdropGradient } from "@/features/legendarium/leaderboard-presentation";

type NavigationItem = { href: string; label: string; icon: NavigationIconName };

// Produkcyjne kopie menu-light-button.png / menu-dark-button.png: przycięte do
// treści, wyśrodkowane na wspólnym płótnie 826x756 (patrz .nav-tile w
// globals.css). Jeden kafelek dla obu stanów — różni je wyłącznie ten adres.
const NAV_TILE_ACTIVE_SRC = "/assets/menu-tile-active.png";
const NAV_TILE_INACTIVE_SRC = "/assets/menu-tile-inactive.png";

const navigationItems: NavigationItem[] = [
  { href: "/", label: "Stół", icon: "dashboard" },
  { href: "/gry", label: "Półka", icon: "shelf" },
  { href: "/legendarium", label: "Legendarium", icon: "games" },
  { href: "/kalendarium", label: "Kalendarium", icon: "meetings" },
  { href: "/kronika", label: "Kronika", icon: "plays" },
];

const adminNavigationItem: NavigationItem = {
  href: "/admin",
  label: "Admin",
  icon: "admin",
};

// Only a visible link — /admin itself is guarded server-side (layout
// redirect) and every admin Server Action re-checks is_admin(), so this is
// purely "don't show a link a non-admin can't use," never the real gate.
function useNavigationItems(): NavigationItem[] {
  const role = useMemberRole();
  return role === "admin"
    ? [...navigationItems, adminNavigationItem]
    : navigationItems;
}

function isCurrentPath(pathname: string, href: string) {
  return href === "/" ? pathname === href : pathname.startsWith(href);
}

/*
  Pozioma wersja .nav-tile — ten sam kafel co mobile (te same dwa assety, ta
  sama geometria 9-slice), tylko border-image-width nadpisane przez
  .nav-tile-desktop (patrz globals.css) i layout w rzędzie zamiast w kolumnie.
  Fallback bg-gold/text-wood-dark (active) i text-[#cdbfae] (inactive) to celowo
  te same klasy co w MobileNavItem — jeśli asset się nie wczyta, oba menu mają
  identyczny, sprawdzony kontrast zamiast dwóch osobnych awaryjnych palet.
*/
function DesktopNavItem({
  item,
  active,
}: {
  item: NavigationItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      style={{
        borderImageSource: `url(${active ? NAV_TILE_ACTIVE_SRC : NAV_TILE_INACTIVE_SRC})`,
      }}
      className={`nav-tile nav-tile-desktop flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition-colors ${
        active
          ? "bg-gold text-wood-dark shadow-[0_10px_30px_rgba(214,160,68,0.18)]"
          : "hover:text-cream text-[#cdbfae]"
      }`}
    >
      <NavigationIcon name={item.icon} />
      {item.label}
    </Link>
  );
}

export function DesktopNavigation({
  member,
  activeClass,
}: {
  member: CurrentMember;
  activeClass: ActiveClassView | null;
}) {
  const pathname = usePathname();
  const items = useNavigationItems();

  return (
    // isolate: zamyka ujemny z-index warstwy tekstury w obrębie sidebara.
    // Bez overflow-hidden świadomie — tekstura jest dokładnie na inset-0, więc
    // nie ma czego przycinać, a przycięcie zabrałoby poświatę aktywnej klasy,
    // która celowo wychodzi poza swój kontener (overflow-visible niżej).
    <aside className="wood-grain text-cream sticky top-0 isolate hidden h-screen border-r border-white/8 px-5 py-7 lg:flex lg:flex-col">
      <ClassTextureLayer classKey={activeClass?.key ?? null} />

      <div className="flex min-h-40 items-center justify-center px-2">
        <LogoMark tone="light" />
      </div>
      <nav className="mt-5 flex flex-col gap-1.5" aria-label="Główna nawigacja">
        {items.map((item) => (
          <DesktopNavItem
            key={item.href}
            item={item}
            active={isCurrentPath(pathname, item.href)}
          />
        ))}
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
            <PlayerPortraitFrame
              avatarUrl={member.avatarUrl}
              name={member.displayName}
              frameType={member.activePortraitFrameKey}
              size="compact"
              className="w-10"
            />
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

/*
  Jeden kafel dla obu stanów: geometria (border-width, slice, kształt) siedzi w
  .nav-tile w globals.css i jest identyczna niezależnie od `active` — zmienia
  się wyłącznie border-image-source. bg-gold/text-wood-dark (active) i
  text-[#cdbfae] (inactive) to ten sam fallback co przed zmianą: kolor tła
  maluje się POD border-image, więc jeśli asset się nie wczyta, aktywna
  zakładka wciąż ma jasne tło pod ciemnym tekstem zamiast zlać się z ciemnym
  paskiem nawigacji.
*/
function MobileNavItem({
  item,
  active,
}: {
  item: NavigationItem;
  active: boolean;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      style={{
        borderImageSource: `url(${active ? NAV_TILE_ACTIVE_SRC : NAV_TILE_INACTIVE_SRC})`,
      }}
      className={`nav-tile flex min-w-0 flex-col items-center gap-1 rounded-xl px-0.5 py-2 text-[clamp(0.5rem,2.45vw,0.65rem)] leading-none font-semibold transition-colors ${active ? "bg-gold text-wood-dark" : "text-[#cdbfae]"}`}
    >
      <NavigationIcon name={item.icon} className="size-[1.15rem]" />
      <span className="whitespace-nowrap">{item.label}</span>
    </Link>
  );
}

export function MobileNavigation() {
  const pathname = usePathname();
  const items = useNavigationItems();
  return (
    <nav
      className={`wood-grain shadow-warm fixed inset-x-3 bottom-3 z-40 grid gap-1.5 rounded-2xl border border-white/10 p-1.5 backdrop-blur lg:hidden ${
        items.length > 5 ? "grid-cols-6" : "grid-cols-5"
      }`}
      aria-label="Główna nawigacja"
    >
      {items.map((item) => (
        <MobileNavItem
          key={item.href}
          item={item}
          active={isCurrentPath(pathname, item.href)}
        />
      ))}
    </nav>
  );
}
