"use client";

import { useState } from "react";
import { LabButton } from "./lab-button";
import {
  labActions,
  labArchivedDirections,
  labDirections,
  labForcedStates,
  type LabDirection,
  type LabForcedState,
} from "./lab-button-styles";

const heroActions = labActions.filter((action) => action.heroLabel);

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[0.6rem] font-bold tracking-[0.16em] text-[#8a6a4c] uppercase">
      {children}
    </p>
  );
}

function WoodPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="wood-grain rounded-2xl bg-[#2f1e19] p-4">
      <p className="mb-3 text-[0.6rem] font-bold tracking-[0.16em] text-[#c9a877] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function ParchmentPanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="paper-wash rounded-2xl bg-[#f3ecdf] p-4">
      <p className="mb-3 text-[0.6rem] font-bold tracking-[0.16em] text-[#8a6a4c] uppercase">
        {title}
      </p>
      {children}
    </div>
  );
}

function VariantRow({
  direction,
  forcedState,
  size = "default",
}: {
  direction: LabDirection;
  forcedState: LabForcedState;
  size?: "compact" | "default" | "large";
}) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {labActions.map((action) => (
        <LabButton
          key={action.id}
          direction={direction}
          action={action.id}
          size={size}
          forcedState={forcedState}
        >
          {action.label}
        </LabButton>
      ))}
    </div>
  );
}

function HeroTiles({
  direction,
  short,
}: {
  direction: LabDirection;
  short: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {heroActions.map((action) => (
        // lab-fit czyni z kafla kontener zapytań — poniżej 160 px ikona
        // znika, żeby etykieta zmieściła się w dwóch liniach.
        <div key={action.id} className="lab-fit">
          <LabButton direction={direction} action={action.id} size="hero">
            {short ? action.heroShortLabel : action.heroLabel}
          </LabButton>
        </div>
      ))}
    </div>
  );
}

function CompactCard({ direction }: { direction: LabDirection }) {
  return (
    <div className="parchment-card rounded-[1.05rem] bg-[#fffaf0] p-3">
      <p className="text-[0.58rem] font-bold tracking-[0.14em] text-[#a8794a] uppercase">
        Sobota, 2 sierpnia
      </p>
      <p className="font-display mt-1 text-[0.95rem] font-semibold text-[#4b3326]">
        Wieczór z Gloomhaven
      </p>
      <p className="mt-0.5 text-[0.7rem] text-[#7a6249]">
        4 osoby potwierdzone · brak wybranej gry
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        <LabButton direction={direction} action="vote" size="compact">
          Zagłosuj na grę
        </LabButton>
        <LabButton direction={direction} action="neutral" size="compact">
          Wróć
        </LabButton>
      </div>
    </div>
  );
}

function PhoneFrame({
  width,
  direction,
}: {
  width: number;
  direction: LabDirection;
}) {
  return (
    <div className="shrink-0">
      <p className="mb-2 text-[0.62rem] font-semibold text-[#8a6a4c]">
        {width} px
      </p>
      <div
        style={{ width }}
        className="wood-grain space-y-3 rounded-[1.6rem] border-4 border-[#1c120e] bg-[#2f1e19] p-3"
      >
        <HeroTiles direction={direction} short={false} />
        <HeroTiles direction={direction} short />
        <CompactCard direction={direction} />
        <LabButton
          direction={direction}
          action="meeting"
          size="large"
          className="w-full"
        >
          Dodaj spotkanie
        </LabButton>
      </div>
    </div>
  );
}

function StatesRow({ direction }: { direction: LabDirection }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {labForcedStates.map((state) => (
        <div key={state.id} className="space-y-1.5">
          <p className="text-[0.6rem] font-semibold text-[#8a6a4c]">
            {state.label}
          </p>
          <LabButton
            direction={direction}
            action="chronicle"
            forcedState={state.id}
          >
            Zapisz wynik
          </LabButton>
        </div>
      ))}
      <div className="space-y-1.5">
        <p className="text-[0.6rem] font-semibold text-[#8a6a4c]">loading</p>
        <LabButton direction={direction} action="chronicle" loading>
          Zapisz wynik
        </LabButton>
      </div>
      <div className="space-y-1.5">
        <p className="text-[0.6rem] font-semibold text-[#8a6a4c]">bez ikony</p>
        <LabButton direction={direction} action="chronicle" withIcon={false}>
          Zapisz wynik
        </LabButton>
      </div>
    </div>
  );
}

function DiscriminationRow({ direction }: { direction: LabDirection }) {
  return (
    <div className="flex flex-wrap items-end gap-3">
      {[
        {
          action: "shelf" as const,
          label: "Dodaj grę do Półki",
          note: "shelf",
        },
        { action: "neutral" as const, label: "Wróć", note: "neutral" },
      ].map((item) => (
        <div key={item.note} className="space-y-1.5">
          <p className="text-[0.6rem] font-semibold text-[#8a6a4c]">
            {item.note}
          </p>
          <LabButton direction={direction} action={item.action}>
            {item.label}
          </LabButton>
        </div>
      ))}
      <div className="space-y-1.5">
        <p className="text-[0.6rem] font-semibold text-[#8a6a4c]">
          shelf disabled
        </p>
        <LabButton direction={direction} action="shelf" disabled>
          Dodaj grę do Półki
        </LabButton>
      </div>
      <div className="space-y-1.5">
        <p className="text-[0.6rem] font-semibold text-[#8a6a4c]">
          neutral disabled
        </p>
        <LabButton direction={direction} action="neutral" disabled>
          Wróć
        </LabButton>
      </div>
    </div>
  );
}

const CHOSEN: LabDirection = "bc3";

function ChosenSetSection({ forcedState }: { forcedState: LabForcedState }) {
  return (
    <section className="space-y-4 rounded-[1.75rem] bg-[#fffaf0]/90 p-4 sm:p-5">
      <header>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-[1.4rem] font-semibold text-[#4b3326]">
            Zestaw B×C3 — wszystkie akcje
          </h2>
          <span className="rounded-full bg-[#b96f22] px-2.5 py-1 text-[0.62rem] font-bold text-[#fff6e6]">
            wybrany kierunek
          </span>
        </div>
        <p className="mt-1.5 max-w-3xl text-[0.82rem] text-[#6f5540]">
          Pieczęć z poświatą na oryginalnej ciemnej bazie. Każda akcja ma stały
          kolor i stały symbol — ten sam wszędzie, gdzie akcja występuje.
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <WoodPanel title="Ciemne drewno">
          <div className="flex flex-col items-start gap-2.5">
            {labActions.map((action) => (
              <LabButton
                key={action.id}
                direction={CHOSEN}
                action={action.id}
                forcedState={forcedState}
              >
                {action.label}
              </LabButton>
            ))}
          </div>
        </WoodPanel>
        <ParchmentPanel title="Jasny pergamin">
          <div className="flex flex-col items-start gap-2.5">
            {labActions.map((action) => (
              <LabButton
                key={action.id}
                direction={CHOSEN}
                action={action.id}
                forcedState={forcedState}
              >
                {action.label}
              </LabButton>
            ))}
          </div>
        </ParchmentPanel>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Symbole przypisane na stałe</SubHeading>
        <ParchmentPanel title="Akcja · kolor · symbol">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {labActions.map((action) => (
              <div key={action.id} className="flex items-center gap-2.5">
                <LabButton
                  direction={CHOSEN}
                  action={action.id}
                  size="compact"
                  ariaLabel={action.label}
                >
                  {action.id}
                </LabButton>
                <span className="text-[0.68rem] text-[#6f5540]">
                  {action.colorName} · {action.symbol}
                </span>
              </div>
            ))}
          </div>
        </ParchmentPanel>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Rozmiary</SubHeading>
        <WoodPanel title="compact 40 / default 44 / large 50 px na mobile">
          <div className="flex flex-wrap items-center gap-2.5">
            <LabButton direction={CHOSEN} action="meeting" size="compact">
              Dodaj spotkanie
            </LabButton>
            <LabButton direction={CHOSEN} action="meeting">
              Dodaj spotkanie
            </LabButton>
            <LabButton direction={CHOSEN} action="meeting" size="large">
              Dodaj spotkanie
            </LabButton>
          </div>
        </WoodPanel>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Stany</SubHeading>
        <WoodPanel title="Wszystkie stany obok siebie">
          <StatesRow direction={CHOSEN} />
        </WoodPanel>
      </div>

      <div className="space-y-2.5">
        <SubHeading>W kontekście</SubHeading>
        <div className="grid gap-3 lg:grid-cols-2">
          <WoodPanel title="Hero Stołu · 3 kolumny">
            <div className="space-y-2">
              <HeroTiles direction={CHOSEN} short={false} />
              <HeroTiles direction={CHOSEN} short />
            </div>
          </WoodPanel>
          <ParchmentPanel title="Kompaktowa karta">
            <CompactCard direction={CHOSEN} />
          </ParchmentPanel>
        </div>
        <div className="flex flex-wrap gap-4">
          <PhoneFrame width={375} direction={CHOSEN} />
          <PhoneFrame width={360} direction={CHOSEN} />
        </div>
      </div>
    </section>
  );
}

function SideBySideGrid({ forcedState }: { forcedState: LabForcedState }) {
  return (
    <div className="space-y-2 overflow-x-auto">
      <div className="flex min-w-max gap-2 pl-[7.5rem]">
        {labDirections.map((direction) => (
          <span
            key={direction.id}
            className="w-[11.5rem] shrink-0 text-[0.6rem] font-bold text-[#8a6a4c]"
          >
            {direction.name}
          </span>
        ))}
      </div>
      {labActions.map((action) => (
        <div key={action.id} className="flex min-w-max items-center gap-2">
          <span className="w-[7.5rem] shrink-0 text-[0.62rem] font-bold text-[#6f5540]">
            {action.id}
          </span>
          {labDirections.map((direction) => (
            <div key={direction.id} className="lab-fit w-[11.5rem] shrink-0">
              <LabButton
                direction={direction.id}
                action={action.id}
                forcedState={forcedState}
                className="w-full"
              >
                {action.label}
              </LabButton>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function DirectionSection({
  direction,
  name,
  mechanism,
  description,
  forcedState,
}: {
  direction: LabDirection;
  name: string;
  mechanism: string;
  description: string;
  forcedState: LabForcedState;
}) {
  return (
    <section className="space-y-4 rounded-[1.75rem] bg-[#fffaf0]/90 p-4 sm:p-5">
      <header>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="font-display text-[1.4rem] font-semibold text-[#4b3326]">
            {name}
          </h2>
          <span className="rounded-full bg-[#efe3cc] px-2.5 py-1 text-[0.62rem] font-bold text-[#7a5a35]">
            {mechanism}
          </span>
        </div>
        <p className="mt-1.5 max-w-3xl text-[0.82rem] text-[#6f5540]">
          {description}
        </p>
      </header>

      <div className="grid gap-3 lg:grid-cols-2">
        <WoodPanel title="Ciemne drewno · default">
          <VariantRow direction={direction} forcedState={forcedState} />
        </WoodPanel>
        <ParchmentPanel title="Jasny pergamin · default">
          <VariantRow direction={direction} forcedState={forcedState} />
        </ParchmentPanel>
      </div>

      <div className="space-y-3">
        <SubHeading>Rozmiary</SubHeading>
        <div className="grid gap-3 lg:grid-cols-2">
          <WoodPanel title="compact 40 / 36 px">
            <VariantRow
              direction={direction}
              forcedState={forcedState}
              size="compact"
            />
          </WoodPanel>
          <ParchmentPanel title="large 50 / 46 px">
            <VariantRow
              direction={direction}
              forcedState={forcedState}
              size="large"
            />
          </ParchmentPanel>
        </div>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Stany</SubHeading>
        <ParchmentPanel title="Wszystkie stany obok siebie">
          <StatesRow direction={direction} />
        </ParchmentPanel>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Rozróżnialność: shelf vs neutral vs disabled</SubHeading>
        <div className="grid gap-3 lg:grid-cols-2">
          <WoodPanel title="Na drewnie">
            <DiscriminationRow direction={direction} />
          </WoodPanel>
          <ParchmentPanel title="Na pergaminie">
            <DiscriminationRow direction={direction} />
          </ParchmentPanel>
        </div>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Kontekst desktop</SubHeading>
        <div className="grid gap-3 lg:grid-cols-2">
          <WoodPanel title="Hero Stołu · 3 kolumny">
            <div className="space-y-2">
              <HeroTiles direction={direction} short={false} />
              <HeroTiles direction={direction} short />
            </div>
          </WoodPanel>
          <ParchmentPanel title="Kompaktowa karta">
            <CompactCard direction={direction} />
          </ParchmentPanel>
        </div>
      </div>

      <div className="space-y-2.5">
        <SubHeading>Kontekst mobile</SubHeading>
        <div className="flex flex-wrap gap-4">
          <PhoneFrame width={375} direction={direction} />
          <PhoneFrame width={360} direction={direction} />
        </div>
      </div>
    </section>
  );
}

export function ButtonLab() {
  const [forcedState, setForcedState] = useState<LabForcedState>("none");
  const [showArchive, setShowArchive] = useState(false);

  return (
    <div className="space-y-5">
      <div className="rounded-[1.5rem] bg-[#fffaf0]/90 p-4">
        <p className="text-[0.6rem] font-bold tracking-[0.16em] text-[#8a6a4c] uppercase">
          Wymuszony stan wizualny
        </p>
        <p className="mt-1 text-[0.78rem] text-[#6f5540]">
          Przełącznik nadaje wybrany stan wszystkim przyciskom w sekcjach
          porównawczych — bez trzymania kursora i klawisza. Stan wymuszony i
          prawdziwy korzystają z tych samych reguł CSS.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {labForcedStates.map((state) => {
            const isActive = state.id === forcedState;
            return (
              <button
                key={state.id}
                type="button"
                onClick={() => setForcedState(state.id)}
                aria-pressed={isActive}
                className={`rounded-full border px-3.5 py-2 text-xs font-bold transition-colors ${
                  isActive
                    ? "border-[#8f5417] bg-[#b96f22] text-[#fff6e6]"
                    : "border-[#d3c1a5] bg-[#f6efe1] text-[#6a4d36] hover:bg-[#efe3cc]"
                }`}
              >
                {state.label}
              </button>
            );
          })}
        </div>
      </div>

      <ChosenSetSection forcedState={forcedState} />

      <section className="space-y-3 rounded-[1.75rem] bg-[#fffaf0]/90 p-4 sm:p-5">
        <header>
          <h2 className="font-display text-[1.4rem] font-semibold text-[#4b3326]">
            Sześć jasnych odsłon B, obok siebie
          </h2>
          <p className="mt-1.5 max-w-3xl text-[0.82rem] text-[#6f5540]">
            Ta sama mechanika co w kierunku B — barwa mieszka w obramowaniu,
            ikonie i poświacie, nigdy w pełnej ciemnej powierzchni. Zmienia się
            baza: pergamin, emalia albo kamień.
          </p>
        </header>
        <WoodPanel title="Na ciemnym drewnie">
          <SideBySideGrid forcedState={forcedState} />
        </WoodPanel>
        <ParchmentPanel title="Na jasnym pergaminie">
          <SideBySideGrid forcedState={forcedState} />
        </ParchmentPanel>
      </section>

      {labDirections.map((direction) => (
        <DirectionSection
          key={direction.id}
          direction={direction.id}
          name={direction.name}
          mechanism={direction.mechanism}
          description={direction.description}
          forcedState={forcedState}
        />
      ))}

      <div className="rounded-[1.5rem] bg-[#fffaf0]/90 p-4">
        <button
          type="button"
          onClick={() => setShowArchive((value) => !value)}
          aria-expanded={showArchive}
          className="rounded-full border border-[#d3c1a5] bg-[#f6efe1] px-4 py-2 text-xs font-bold text-[#6a4d36] transition-colors hover:bg-[#efe3cc]"
        >
          {showArchive ? "Ukryj" : "Pokaż"} kierunki z pierwszej rundy (B, A, C,
          D)
        </button>
      </div>

      {showArchive
        ? labArchivedDirections.map((direction) => (
            <DirectionSection
              key={direction.id}
              direction={direction.id}
              name={direction.name}
              mechanism={direction.mechanism}
              description={direction.description}
              forcedState={forcedState}
            />
          ))
        : null}
    </div>
  );
}
