"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

/*
  Pływający panel zakotwiczony przy polu formularza.

  Renderujemy go przez portal do <body> z `position: fixed`, i to nie jest
  ozdobnik — arkusz pergaminu (.chronicle-sheet) ma `filter: drop-shadow(...)`,
  a filtr robi z elementu ZARAZEM kontekst układania ORAZ blok zawierający dla
  potomków `fixed`. Panel zostawiony wewnątrz arkusza nie mógłby więc ani
  pozycjonować się względem viewportu, ani przykryć dolnej nawigacji (fixed,
  z-40 w korzeniu dokumentu), bo jego z-index działałby tylko w obrębie arkusza.

  Pozycję trzymamy w stylu inline. Poza wygodą ma to drugą funkcję: chroni przed
  klasą pokroju `.premium-edge`, która ustawia `position: relative` spoza warstwy
  kaskady i dlatego wygrywała z Tailwindowym `.absolute` z `@layer utilities`
  (styl nielayerowany bije layerowany niezależnie od specyficzności). Właśnie
  przez to poprzedni panel zostawał w normalnym flow i rozpychał formularz.
*/

const VIEWPORT_MARGIN = 8;
const ANCHOR_GAP = 8;
// Poniżej tej wysokości panel pod polem jest bezużyteczny — wtedy szukamy
// miejsca nad polem, o ile jest go tam więcej.
const MIN_USABLE_HEIGHT = 200;
const MIN_PANEL_HEIGHT = 120;

type PopoverPlacement = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

function measurePlacement(
  anchor: HTMLElement,
  minWidth: number,
  maxWidth: number,
): PopoverPlacement {
  const rect = anchor.getBoundingClientRect();
  // clientWidth/Height, nie innerWidth/Height — pomijają pasek przewijania,
  // więc panel nigdy nie wystaje poza obszar treści i nie tworzy poziomego
  // scrolla.
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;

  // maxWidth ogranicza tylko ROZROST panelu ponad pole; nigdy nie zwęża go
  // poniżej kotwicy, bo dropdown węższy od własnego przycisku wygląda na błąd.
  // Jedynym twardym limitem zostaje viewport.
  const width = Math.min(
    Math.max(rect.width, minWidth),
    Math.max(rect.width, maxWidth),
    viewportWidth - VIEWPORT_MARGIN * 2,
  );
  const left = Math.min(
    Math.max(rect.left, VIEWPORT_MARGIN),
    viewportWidth - VIEWPORT_MARGIN - width,
  );

  const spaceBelow =
    viewportHeight - rect.bottom - ANCHOR_GAP - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - ANCHOR_GAP - VIEWPORT_MARGIN;
  const placeAbove = spaceBelow < MIN_USABLE_HEIGHT && spaceAbove > spaceBelow;

  if (placeAbove) {
    return {
      left,
      width,
      maxHeight: Math.max(spaceAbove, MIN_PANEL_HEIGHT),
      bottom: viewportHeight - rect.top + ANCHOR_GAP,
    };
  }

  return {
    left,
    width,
    maxHeight: Math.max(spaceBelow, MIN_PANEL_HEIGHT),
    top: rect.bottom + ANCHOR_GAP,
  };
}

function isSamePlacement(left: PopoverPlacement, right: PopoverPlacement) {
  return (
    left.left === right.left &&
    left.width === right.width &&
    left.maxHeight === right.maxHeight &&
    left.top === right.top &&
    left.bottom === right.bottom
  );
}

type AnchoredPopoverProps = {
  /** Element, przy którym panel się zakotwicza i który nie liczy się jako „klik poza”. */
  anchorRef: RefObject<HTMLElement | null>;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Domyślnie panel ma dokładnie szerokość kotwicy — na mobile to pełna szerokość pola w arkuszu. */
  minWidth?: number;
  maxWidth?: number;
  id?: string;
  role?: "dialog" | "listbox";
  ariaLabel?: string;
};

export function AnchoredPopover({
  anchorRef,
  isOpen,
  onClose,
  children,
  minWidth = 0,
  maxWidth = 560,
  id,
  role = "dialog",
  ariaLabel,
}: AnchoredPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [placement, setPlacement] = useState<PopoverPlacement | null>(null);

  const reposition = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;

    const next = measurePlacement(anchor, minWidth, maxWidth);
    // Zachowanie poprzedniego obiektu przy identycznych wartościach ucina
    // pętlę re-renderów przy strumieniu zdarzeń scroll.
    setPlacement((current) =>
      current && isSamePlacement(current, next) ? current : next,
    );
  }, [anchorRef, minWidth, maxWidth]);

  // Pozycji nie zerujemy przy zamknięciu: zamknięty panel i tak nie renderuje
  // się wcale, a useLayoutEffect przelicza ją przed malowaniem, więc przy
  // ponownym otwarciu stara wartość nigdy nie trafia na ekran.
  useLayoutEffect(() => {
    if (!isOpen) return;
    reposition();
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;

    const handleViewportChange = () => reposition();
    // capture: true — łapie też przewijanie kontenerów pośrednich, nie tylko okna.
    window.addEventListener("scroll", handleViewportChange, true);
    window.addEventListener("resize", handleViewportChange);

    return () => {
      window.removeEventListener("scroll", handleViewportChange, true);
      window.removeEventListener("resize", handleViewportChange);
    };
  }, [isOpen, reposition]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      // Kotwica jest wyłączona z „kliku poza”, inaczej kliknięcie w przycisk
      // zamykałoby i natychmiast otwierało panel z powrotem.
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, anchorRef]);

  if (!isOpen || !placement) return null;

  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={ariaLabel}
      style={{
        position: "fixed",
        left: `${placement.left}px`,
        top: placement.top === undefined ? undefined : `${placement.top}px`,
        bottom:
          placement.bottom === undefined ? undefined : `${placement.bottom}px`,
        width: `${placement.width}px`,
        maxHeight: `${placement.maxHeight}px`,
      }}
      className="paper-wash z-[70] flex flex-col overflow-hidden rounded-[1.1rem] border border-[#9a7657]/45 p-3 shadow-[0_24px_52px_rgba(18,8,6,0.32)]"
    >
      {children}
    </div>,
    document.body,
  );
}
