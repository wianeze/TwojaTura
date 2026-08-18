"use client";

import { useState, type ReactNode } from "react";
import "./typography-lab.css";
import { typographyLabFontVariables } from "./typography-lab-fonts";

/*
 * TYMCZASOWY przełącznik dla /lab/typografia. Renderuje prawdziwy
 * <DashboardShowcase /> (przekazany jako children) wewnątrz wrappera z
 * data-font-variant — reszta systemu żyje w typography-lab.css.
 * Przyciski przełącznika świadomie zostają POZA tym wrapperem, żeby sam
 * pasek sterowania nie zmieniał czcionki razem z resztą strony (łatwiej
 * go czytać jako stały punkt odniesienia).
 */

type FontVariantId =
  | "alegreya"
  | "cinzel"
  | "cormorant"
  | "spectral"
  | "lora"
  | "grenzegotisch"
  | "pirataone"
  | "berkshireswash"
  | "piedra"
  | "quintessential";

const VARIANTS: {
  id: FontVariantId;
  label: string;
  legend: string[];
}[] = [
  {
    id: "alegreya",
    label: "Alegreya",
    legend: [
      "Display: Alegreya SC 900",
      "Section: Alegreya SC 800",
      "Card: Alegreya SC 700",
      "Button: Alegreya SC 500",
      "Body: Alegreya 500",
      "Secondary: Alegreya 400",
    ],
  },
  {
    id: "cinzel",
    label: "Cinzel",
    legend: [
      "Display: Cinzel 800",
      "Section: Cinzel 700",
      "Card: Cinzel 600",
      "Button: Cinzel 500 UPPERCASE",
      "Body: EB Garamond 500",
      "Secondary: EB Garamond 400 italic",
    ],
  },
  {
    id: "cormorant",
    label: "Cormorant",
    legend: [
      "Display: Cormorant SC 700",
      "Section: Cormorant SC 600",
      "Card: Cormorant Garamond 600",
      "Button: Cormorant SC 500",
      "Body: Cormorant Infant 500",
      "Secondary: Cormorant Garamond 400 italic",
    ],
  },
  {
    id: "spectral",
    label: "Spectral",
    legend: [
      "Display: Spectral SC 800",
      "Section: Spectral SC 700",
      "Card: Spectral SC 600",
      "Button: Spectral SC 500",
      "Body: Spectral 500",
      "Secondary: Spectral 400 italic",
    ],
  },
  {
    id: "lora",
    label: "Lora",
    legend: [
      "Display: Lora 700",
      "Section: Lora 600",
      "Card: Lora 500",
      "Button: Lora 700 UPPERCASE",
      "Body: Lora 400",
      "Secondary: Lora 400 italic",
    ],
  },
  {
    id: "grenzegotisch",
    label: "Grenze Gotisch",
    legend: [
      "Display: Grenze Gotisch 800",
      "Section: Grenze Gotisch 700",
      "Card: Grenze Gotisch 600",
      "Button: Grenze Gotisch 500 UPPERCASE",
      "Body: Cardo 400",
      "Secondary: Cardo 400 italic",
    ],
  },
  {
    id: "pirataone",
    label: "Pirata One",
    legend: [
      "Display: Pirata One 400",
      "Section: Vollkorn 800",
      "Card: Vollkorn 700",
      "Button: Vollkorn 600 UPPERCASE",
      "Body: Vollkorn 500",
      "Secondary: Vollkorn 400 italic",
    ],
  },
  {
    id: "berkshireswash",
    label: "Berkshire Swash",
    legend: [
      "Display: Berkshire Swash 400",
      "Section: Crimson Pro 800",
      "Card: Crimson Pro 700",
      "Button: Crimson Pro 600",
      "Body: Crimson Pro 500",
      "Secondary: Crimson Pro 400 italic",
    ],
  },
  {
    id: "piedra",
    label: "Piedra",
    legend: [
      "Display: Piedra 400",
      "Section: Domine 700",
      "Card: Domine 600",
      "Button: Domine 700 UPPERCASE",
      "Body: Domine 500",
      "Secondary: Domine 400 (bez kursywy)",
    ],
  },
  {
    id: "quintessential",
    label: "Quintessential",
    legend: [
      "Display: Quintessential 400",
      "Section: Crimson Text 700",
      "Card: Crimson Text 600",
      "Button: Crimson Text 700 UPPERCASE",
      "Body: Crimson Text 400",
      "Secondary: Crimson Text 400 italic",
    ],
  },
];

const PL_SAMPLE = "ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż";

export function TypographyLabSwitcher({ children }: { children: ReactNode }) {
  const [variant, setVariant] = useState<FontVariantId>("alegreya");
  const active = VARIANTS.find((item) => item.id === variant) ?? VARIANTS[0];

  return (
    <div>
      <div className="sticky top-0 z-50 mb-3 rounded-[1rem] border border-[color:var(--border)] bg-[color:var(--wood-dark)] p-3 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
        {/* Awaryjny natywny <select> — gdyby dotyk na przyciskach z jakiegoś
            powodu nadal zawodził na realnym telefonie (mimo poprawnych
            wyników testów w tym środowisku), natywny picker systemowy
            (iOS/Android) obsługuje CAŁĄ interakcję poza naszym JS/CSS, więc
            nie może paść na ten sam sposób co customowy przycisk. Ten sam
            stan `variant` co przyciski niżej — oba sterują tym samym
            wrapperem. */}
        <label className="mb-2 flex items-center gap-2 text-[0.62rem] font-bold text-white/70 sm:hidden">
          Wariant fontu
          <select
            value={variant}
            onChange={(event) => setVariant(event.target.value as FontVariantId)}
            className="min-h-11 flex-1 rounded-lg border border-white/20 bg-white/5 px-2 text-xs font-bold text-[color:var(--cream)]"
          >
            {VARIANTS.map((item) => (
              <option
                key={item.id}
                value={item.id}
                className="text-black"
              >
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {/* WYŁĄCZNIE flex-wrap, żadnego overflow-x-auto — poziomy scroll na
            tym samym elemencie co przyciski to znany konflikt na realnym
            dotyku: przeglądarka musi rozstrzygnąć "to scroll czy tap", i przy
            najmniejszym bocznym drgnięciu palca (normalne przy tapnięciu)
            wygrywa scroll, więc klik nigdy nie dochodzi do skutku — mimo że
            programowe zdarzenia dotykowe (bez ruchu między pointerdown a
            pointerup) w testach przechodziły. Zamiast tego przyciski
            zawijają się do kolejnych wierszy — brak scrollowalnego
            kontenera, więc nie ma czego rozstrzygać. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:gap-1.5">
          {VARIANTS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setVariant(item.id)}
              aria-pressed={item.id === variant}
              className={`touch-manipulation rounded-full border px-3 py-3.5 text-xs font-bold transition-colors sm:py-1.5 ${
                item.id === variant
                  ? "border-[color:var(--gold)] bg-[color:var(--gold)] text-[#2f1e19]"
                  : "border-white/20 bg-white/5 text-[color:var(--cream)] hover:bg-white/10"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div
          data-font-variant={variant}
          className={`${typographyLabFontVariables} mt-2 space-y-1.5`}
        >
          <p className="lab-fx-secondary text-[0.64rem] text-white/70">
            {active.legend.join(" · ")}
          </p>
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="lab-fx-display text-[1.05rem] text-white">
              {PL_SAMPLE}
            </span>
            <span className="lab-fx-body text-[0.82rem] text-white/90">
              {PL_SAMPLE}
            </span>
            <span className="lab-fx-secondary text-[0.76rem] text-white/70">
              {PL_SAMPLE}
            </span>
          </div>
        </div>
      </div>

      <div data-font-variant={variant} className={typographyLabFontVariables}>
        {children}
      </div>
    </div>
  );
}
