import type { ReactNode } from "react";
import { RouteViewTracker } from "@/components/analytics/route-view-tracker";
import {
  DesktopNavigation,
  MobileNavigation,
} from "@/components/layout/app-navigation";
import { ClassTextureLayer } from "@/components/layout/class-texture-layer";
import { WarmLink } from "@/components/layout/warm-link";
import { SectionBackground } from "@/components/layout/section-background";
import { LogoMark } from "@/components/ui/logo-mark";
import { PlayerCurrencyCounter } from "@/components/ui/player-currency-bar";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import { MemberRoleProvider } from "@/features/auth/member-role-context";
import type { CurrentMember } from "@/features/auth/types";
import { ActiveClassEmblem } from "@/features/legendarium/active-class-emblem";
import type { ActiveClassView } from "@/features/legendarium/achievement-view-model";

type AppShellProps = {
  children: ReactNode;
  member: CurrentMember;
  currentPoints: number;
  /** Saldo Tukatów z tukat_balances; 0 dla gracza bez wypłat. */
  currentTukats: number;
  activeClass: ActiveClassView | null;
};

export function AppShell({
  children,
  member,
  currentPoints,
  currentTukats,
  activeClass,
}: AppShellProps) {
  return (
    <MemberRoleProvider role={member.role}>
      <RouteViewTracker />
      <div className="min-h-screen lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <DesktopNavigation
          member={member}
          activeClass={activeClass}
          currentPoints={currentPoints}
          currentTukats={currentTukats}
        />
        <div className="cabin-ambient min-w-0">
          <SectionBackground />
          {/* `relative z-10` już tworzy kontekst układania, więc ujemny z-index
              tekstury zostaje wewnątrz paska. overflow-hidden domyka temat na
              wypadek zaokrągleń w przyszłości — emblemat klasy z poświatą
              mieści się w 80px wysokości paska, więc nic nie przycina. Obie
              ramy walut stoją w jednym rzędzie, więc pasek nie musi być tak
              wysoki jak przy układzie z ramami jedna nad drugą. */}
          <header className="wood-grain relative z-10 flex h-20 items-center justify-between gap-1.5 overflow-hidden border-b border-white/8 px-2 sm:px-4 lg:hidden">
            <ClassTextureLayer classKey={activeClass?.key ?? null} />

            <LogoMark compact tone="light" />

            {/*
              WALUTY PO PRZECIWNYCH KOŃCACH, KLASA W ŚRODKU.

              `pointer-events-none` na ramach: to czysta informacja, nie
              kontrolka — nie mogą przechwytywać dotknięć celujących w elementy
              pod spodem.
            */}
            <PlayerCurrencyCounter
              variant="renown"
              amount={currentPoints}
              className="pointer-events-none"
            />

            {/*
              KLASA POSTACI — emblemat, pod nim nazwa. Blok jest wąski (4.5rem),
              bo obie ramy walut stoją w JEDNYM rzędzie i to szerokość, a nie
              wysokość paska, jest tu zasobem deficytowym. Nazwa łamie się
              wyłącznie między wyrazami, żeby nie zostawiać samotnych liter.
            */}
            {activeClass ? (
              <WarmLink
                href="/profil"
                aria-label={`Aktywna klasa: ${activeClass.name}`}
                title={`Aktywna klasa: ${activeClass.name}`}
                className="focus-visible:outline-gold flex max-w-[4.5rem] shrink-0 flex-col items-center gap-0.5 focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <ActiveClassEmblem
                  activeClass={activeClass}
                  sizeClass="size-11 shrink-0 min-[420px]:size-12"
                />
                <span className="font-class-title max-w-full text-center text-[0.52rem] leading-[1.05] font-bold tracking-[0.02em] break-normal text-[#f3a849] uppercase min-[420px]:text-[0.6rem] min-[420px]:tracking-[0.04em]">
                  {activeClass.name}
                </span>
              </WarmLink>
            ) : null}

            <PlayerCurrencyCounter
              variant="tukats"
              amount={currentTukats}
              className="pointer-events-none"
            />

            {/* Portret gracza wraca na swoje miejsce — skrajnie po prawej. */}
            <WarmLink
              href="/profil"
              aria-label="Przejdź do profilu"
              className="focus-visible:outline-gold shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <PlayerPortraitFrame
                avatarUrl={member.avatarUrl}
                name={member.displayName}
                frameType={member.activePortraitFrameKey}
                size="compact"
                className="w-7 min-[420px]:w-9"
              />
            </WarmLink>
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
