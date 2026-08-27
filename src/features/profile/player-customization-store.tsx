"use client";

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PlayerDisplayName } from "@/components/ui/player-display-name";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import { setActivePortraitFrameAction } from "./portrait-frame-actions";
import type { PortraitFrameDefinition, PortraitFrameStoreData } from "./portrait-frames";
import { portraitFrameRarityLabel } from "./portrait-frame-view-model";
import {
  purchaseTitleAction,
  setEquippedTitleAction,
  type PlayerTitleActionResult,
} from "./player-title-actions";
import type { PlayerTitleStoreData, TitleDefinition } from "./player-titles";

type CustomizationTab = "titles" | "frames";
type CustomizationPanelType = "inventory" | "shop";
const initialTitleState: PlayerTitleActionResult = { ok: false, message: "" };

const rarityTone = {
  common: "border-[#cdbda4] bg-[#fff9ee]/70 text-[#6a5847]",
  rare: "border-[#76abd3] bg-[#e8f5ff]/76 text-[#2c628c]",
  epic: "border-[#a878cf] bg-[#f3e8fb]/76 text-[#72428f]",
  legendary: "border-[#d9a13d] bg-[#fff1c9]/80 text-[#875913]",
} as const;

function Segment({ value, onChange, label }: {
  value: CustomizationTab;
  onChange: (value: CustomizationTab) => void;
  label: string;
}) {
  return (
    <div className="grid grid-cols-2 rounded-xl border border-[#cba875]/55 bg-[#eadcc7]/65 p-1" role="tablist" aria-label={label}>
      {(["titles", "frames"] as const).map((item) => (
        <button
          key={item}
          type="button"
          role="tab"
          aria-selected={value === item}
          onClick={() => onChange(item)}
          className={`rounded-lg px-2 py-2 text-xs font-bold transition sm:text-sm ${value === item ? "bg-[#4a2b1e] text-[#fff0dc] shadow-md" : "text-[#684b39] hover:bg-white/45"}`}
        >
          {item === "titles" ? "Tytuły" : "Ramki"}
        </button>
      ))}
    </div>
  );
}

function CustomizationPanel({ title, tab, onTabChange, children }: {
  title: string;
  tab: CustomizationTab;
  onTabChange: (value: CustomizationTab) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="paper-wash min-w-0 rounded-[1.5rem] border border-[#d0ae77]/65 p-4 shadow-[0_8px_22px_rgba(58,30,15,0.14)] sm:p-5">
      <Segment value={tab} onChange={onTabChange} label={`${title}: kategoria`} />
      <div className="mt-4">{children}</div>
    </section>
  );
}

/*
 * Kadr assetu każdego kafla: pełne wymiary PNG-a (dla next/image) oraz
 * WOLNE POLE pergaminu, w którym ma usiąść napis. Insety podane w procentach
 * KONTENERA kafla, nie samego obrazka — kontener ma wspólną dla obu kafli
 * `aspect-ratio: 1.72` (patrz .customization-launcher w globals.css), a
 * obrazek leży w nim przez `object-contain`, więc jeden z assetów dostaje
 * kilka procent letterboxa i te procenty są już w liczbach niżej wliczone.
 *
 * Granice pól zmierzone na pikselach obu PNG-ów (profil luminancji wzdłuż
 * osi kadru), a nie „na oko” — stąd nierówne liczby.
 *
 * Ekwipunek-bkg.png (1680×936): jasna, równa skóra dopiero od ~46% szerokości
 * (niżej wchodzi w kadr zwój i pas plecaka) do ~88% (dalej ciemniejszy
 * winietowany brzeg panelu i złoty okuty narożnik), w pionie ~33→70%.
 * Sklep-bkg.png (1604×981): pergamin ~21→78% w pionie, w poziomie od ~46%,
 * ale prawą krawędź przykrywa wisząca czerwona banderola, więc pole tekstu
 * kończy się przed nią; lewą stronę kadru zajmuje stragan z monetami.
 */
const CUSTOMIZATION_LAUNCHER_ART = {
  inventory: {
    src: "/assets/Ekwipunek-bkg.png",
    width: 1680,
    height: 936,
    field: "top-[34%] bottom-[31%] left-[44%] right-[11%]",
  },
  shop: {
    src: "/assets/Sklep-bkg.png",
    width: 1604,
    height: 981,
    field: "top-[20%] bottom-[20%] left-[46%] right-[17%]",
  },
} as const satisfies Record<
  CustomizationPanelType,
  { src: string; width: number; height: number; field: string }
>;

function CustomizationLauncher({
  type,
  title,
  onClick,
  buttonRef,
}: {
  type: CustomizationPanelType;
  title: string;
  onClick: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const art = CUSTOMIZATION_LAUNCHER_ART[type];

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      className="customization-launcher relative block w-full min-w-0 cursor-pointer"
    >
      {/*
        alt="" — asset jest czystą dekoracją, a nazwę dostępną przycisku
        niesie widoczny napis niżej (inaczej czytnik ekranu przeczytałby
        tytuł dwa razy). Klikalny jest CAŁY kafel: obrazek i napis to
        warstwy wewnątrz jednego <button>, obrazek dodatkowo z
        pointer-events: none, więc nic nie zjada kliknięcia.
      */}
      <Image
        src={art.src}
        alt=""
        width={art.width}
        height={art.height}
        sizes="(min-width: 640px) 24rem, 46vw"
        className="pointer-events-none absolute inset-0 size-full object-contain select-none"
      />
      <span className={`absolute grid place-items-center px-[1%] ${art.field}`}>
        <span className="customization-launcher__label font-display text-center leading-tight font-bold">
          {title}
        </span>
      </span>
    </button>
  );
}

function TitleCard({ title, displayName, children }: {
  title: TitleDefinition;
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`flex min-w-0 flex-col rounded-2xl border p-3 ${rarityTone[title.rarity]}`}>
      <p className="text-[0.56rem] font-black tracking-[0.14em] uppercase opacity-75">{title.rarity}</p>
      <PlayerDisplayName displayName={displayName} title={title} variant="standard" className="mt-1 text-sm font-bold" />
      {title.priceTukats ? <p className="mt-2 text-xs font-bold">{title.priceTukats} Tukatów</p> : null}
      <div className="mt-auto pt-3">{children}</div>
    </article>
  );
}

function FrameCard({ frame, avatarUrl, displayName, children }: {
  frame: PortraitFrameDefinition;
  avatarUrl: string | null;
  displayName: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`flex min-w-0 flex-col items-center rounded-2xl border p-2.5 text-center ${rarityTone[frame.rarity]}`}>
      <PlayerPortraitFrame avatarUrl={avatarUrl} name={displayName} frameType={frame.key} size="large" className="w-[4.6rem] sm:w-[5.2rem]" />
      <h4 className="mt-2 line-clamp-2 min-h-8 text-xs font-black sm:text-sm">{frame.name}</h4>
      <p className="mt-0.5 text-[0.56rem] font-bold uppercase opacity-75">{portraitFrameRarityLabel[frame.rarity]}</p>
      <div className="mt-auto w-full pt-2">{children}</div>
    </article>
  );
}

export function PlayerCustomizationStore({ titleData, frameData, avatarUrl, displayName, tukatBalance }: {
  titleData: PlayerTitleStoreData;
  frameData: PortraitFrameStoreData;
  avatarUrl: string | null;
  displayName: string;
  tukatBalance: number;
}) {
  const router = useRouter();
  const [inventoryTab, setInventoryTab] = useState<CustomizationTab>("titles");
  const [shopTab, setShopTab] = useState<CustomizationTab>("titles");
  const [openPanel, setOpenPanel] = useState<CustomizationPanelType | null>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const inventoryTriggerRef = useRef<HTMLButtonElement>(null);
  const shopTriggerRef = useRef<HTMLButtonElement>(null);
  const [activeFrameKey, setActiveFrameKey] = useState(frameData.activeFrameKey);
  const [frameMessage, setFrameMessage] = useState("");
  const [framePending, startFrameTransition] = useTransition();
  const [purchaseState, purchaseAction, purchasePending] = useActionState(purchaseTitleAction, initialTitleState);
  const [equipState, equipAction, equipPending] = useActionState(setEquippedTitleAction, initialTitleState);
  const titleMessage = purchaseState.message || equipState.message;
  const equippedTitle = titleData.ownedTitles.find((title) => title.id === titleData.equippedTitleId) ?? null;
  const activeFrame = frameData.ownedFrames.find((frame) => frame.key === activeFrameKey) ?? null;

  useEffect(() => {
    if (purchaseState.ok || equipState.ok) router.refresh();
  }, [equipState.ok, purchaseState.ok, router]);

  useEffect(() => {
    if (!openPanel) return;

    const previousOverflow = document.body.style.overflow;
    const triggerElement =
      openPanel === "inventory"
        ? inventoryTriggerRef.current
        : shopTriggerRef.current;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-customization-close]")
        ?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpenPanel(null);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      triggerElement?.focus();
    };
  }, [openPanel]);

  function activateFrame(frameKey: PortraitFrameDefinition["key"]) {
    const formData = new FormData();
    formData.set("frameKey", frameKey);
    setFrameMessage("");
    startFrameTransition(async () => {
      const result = await setActivePortraitFrameAction(formData);
      setFrameMessage(result.message);
      if (result.ok) {
        setActiveFrameKey(frameKey);
        router.refresh();
      }
    });
  }

  const frameGrid = (frames: PortraitFrameDefinition[], shop: boolean) => (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {frames.map((frame) => {
        const active = frame.key === activeFrameKey;
        return (
          <FrameCard key={frame.key} frame={frame} avatarUrl={avatarUrl} displayName={displayName}>
            {shop ? (
              <button type="button" disabled className="w-full cursor-not-allowed rounded-xl bg-[#8b7b6d] px-2 py-2 text-xs font-black tracking-[0.1em] text-[#fff0dc] uppercase">Wkrótce</button>
            ) : (
              <button type="button" disabled={active || framePending} onClick={() => activateFrame(frame.key)} className="w-full rounded-xl bg-[#3f251c] px-2 py-2 text-xs font-bold text-[#fff0dc] disabled:bg-[#8b7b6d]">
                {active ? "Aktywna" : "Ustaw"}
              </button>
            )}
          </FrameCard>
        );
      })}
    </div>
  );

  const inventoryPanel = (
    <CustomizationPanel title="Ekwipunek" tab={inventoryTab} onTabChange={setInventoryTab}>
          {inventoryTab === "titles" ? (
            <div className="space-y-4">
              <div className="min-w-0 rounded-2xl border border-[#c89555]/55 bg-white/55 p-3">
                  <p className="text-[0.52rem] font-black tracking-[0.12em] text-[#9a603d] uppercase sm:text-[0.58rem] sm:tracking-[0.14em]">
                    Aktualnie wyposażony
                  </p>
                  <PlayerDisplayName
                    displayName={displayName}
                    title={equippedTitle}
                    variant="standard"
                    className="mt-1 text-sm font-bold text-[#4d3528] sm:text-lg"
                  />
                  {equippedTitle ? (
                    <form action={equipAction} className="mt-3">
                      <input type="hidden" name="titleId" value="" />
                      <button
                        disabled={equipPending}
                        className="w-full rounded-xl bg-[#4a2b1e] px-2 py-2 text-[0.68rem] font-bold text-[#fff0dc] disabled:opacity-60 sm:px-4 sm:text-xs"
                      >
                        Zdejmij tytuł
                      </button>
                    </form>
                  ) : (
                    <p className="mt-1 text-xs text-[#78614f]">
                      Brak aktywnego tytułu.
                    </p>
                  )}
              </div>
              <div aria-hidden="true" className="h-px bg-gradient-to-r from-transparent via-[#b97842]/55 to-transparent" />
              {titleData.ownedTitles.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {titleData.ownedTitles.map((title) => {
                    const active = title.id === titleData.equippedTitleId;
                    return (
                      <article
                        key={title.id}
                        className={`flex min-w-0 flex-col rounded-2xl border p-3 ${rarityTone[title.rarity]}`}
                      >
                        <div className="min-w-0 text-left">
                          <span className="block text-[0.58rem] font-black tracking-[0.14em] uppercase opacity-75">
                            {title.rarity}
                          </span>
                          <span className="font-display mt-1 block line-clamp-2 text-base leading-5 font-bold sm:text-lg">
                            {title.name}
                          </span>
                        </div>
                        <form action={equipAction}>
                          <input type="hidden" name="titleId" value={active ? "" : title.id} />
                          <button
                            disabled={equipPending}
                            className="mt-3 w-full rounded-xl bg-[#4a2b1e] px-3 py-2 text-xs font-bold text-[#fff0dc] disabled:opacity-60"
                          >
                            {active ? "Zdejmij" : "Wyposaż"}
                          </button>
                        </form>
                      </article>
                    );
                  })}
                </div>
              ) : <p className="rounded-xl bg-white/55 px-4 py-4 text-sm text-[#715b49]">Nie masz jeszcze żadnego tytułu.</p>}
              {titleMessage ? <p role={purchaseState.ok || equipState.ok ? "status" : "alert"} className="text-sm font-semibold text-[#71442f]">{titleMessage}</p> : null}
            </div>
          ) : (
            <div className="space-y-4">
              {activeFrame ? (
                <div className="flex items-center gap-3 rounded-2xl border border-[#c89555]/55 bg-white/55 p-3">
                  <PlayerPortraitFrame avatarUrl={avatarUrl} name={displayName} frameType={activeFrame.key} size="large" className="w-[5rem] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[0.56rem] font-black tracking-[0.14em] text-[#9a603d] uppercase">Aktualnie wyposażona</p>
                    <p className="font-display truncate text-lg font-bold text-[#4d3022]">{activeFrame.name}</p>
                  </div>
                </div>
              ) : null}
              {frameGrid(frameData.ownedFrames, false)}
              {frameMessage ? <p className="text-sm font-semibold text-[#71442f]">{frameMessage}</p> : null}
            </div>
          )}
    </CustomizationPanel>
  );

  const shopPanel = (
    <CustomizationPanel title="Sklep" tab={shopTab} onTabChange={setShopTab}>
          {shopTab === "titles" ? (
            <div className="space-y-3">
              <p className="text-xs font-bold text-[#775a43]">Saldo: {tukatBalance.toLocaleString("pl-PL")} Tukatów</p>
              {titleData.shopTitles.length ? (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {titleData.shopTitles.map((title) => (
                    <TitleCard key={title.id} title={title} displayName={displayName}>
                      <form action={purchaseAction}>
                        <input type="hidden" name="titleId" value={title.id} />
                        <button disabled={purchasePending} className="w-full rounded-xl bg-[#4a2b1e] px-3 py-2 text-xs font-bold text-[#fff0dc] disabled:opacity-60">Kup za {title.priceTukats} Tukatów</button>
                      </form>
                    </TitleCard>
                  ))}
                </div>
              ) : <p className="rounded-xl bg-white/55 px-4 py-4 text-sm text-[#715b49]">Wszystkie dostępne tytuły są już w Twoim Ekwipunku.</p>}
              {titleMessage ? <p role={purchaseState.ok || equipState.ok ? "status" : "alert"} className="text-sm font-semibold text-[#71442f]">{titleMessage}</p> : null}
            </div>
          ) : frameData.shopFrames.length ? frameGrid(frameData.shopFrames, true) : (
            <p className="rounded-xl bg-white/55 px-4 py-4 text-sm text-[#715b49]">Kolejne ramki pojawią się wkrótce.</p>
          )}
    </CustomizationPanel>
  );

  return (
    <section aria-label="Personalizacja gracza">
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-2">
        <CustomizationLauncher
          type="inventory"
          title="Ekwipunek"
          onClick={() => setOpenPanel("inventory")}
          buttonRef={inventoryTriggerRef}
        />
        <CustomizationLauncher
          type="shop"
          title="Sklep"
          onClick={() => setOpenPanel("shop")}
          buttonRef={shopTriggerRef}
        />
      </div>

      {openPanel
        ? createPortal(
            <div
              className="fixed inset-0 z-100 flex items-end justify-center overflow-x-hidden bg-[#170b08]/80 p-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-sm sm:items-center sm:p-5"
              role="presentation"
              onClick={() => setOpenPanel(null)}
            >
              <section
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="customization-dialog-title"
                className="cork-board-bg premium-edge anim-rise-in-fast relative isolate flex max-h-[calc(100dvh-env(safe-area-inset-bottom)-6.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-[1.6rem] p-2.5 shadow-[0_24px_52px_rgba(10,4,2,0.52)] sm:max-h-[min(50rem,calc(100dvh-2.5rem))] sm:p-3"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="parchment-card flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.25rem]">
                  <header className="flex items-center justify-between gap-3 border-b border-[#bd966f]/35 px-4 py-3 sm:px-5">
                    <div>
                      <p className="text-accent text-[0.6rem] font-black tracking-[0.16em] uppercase">
                        Personalizacja
                      </p>
                      <h2
                        id="customization-dialog-title"
                        className="font-display mt-0.5 text-xl font-bold text-[#3f2a1a] sm:text-2xl"
                      >
                        {openPanel === "inventory" ? "Ekwipunek" : "Sklep"}
                      </h2>
                      <p className="mt-0.5 text-xs text-[#78614f] sm:text-sm">
                        {openPanel === "inventory"
                          ? "Wyposaż posiadane tytuły i ramki."
                          : "Kupuj tytuły za Tukaty i oglądaj nadchodzące ramki."}
                      </p>
                    </div>
                    <button
                      type="button"
                      data-customization-close
                      onClick={() => setOpenPanel(null)}
                      aria-label={`Zamknij ${openPanel === "inventory" ? "Ekwipunek" : "Sklep"}`}
                      className="grid size-9 shrink-0 place-items-center rounded-full border border-[#a76b43] bg-[#6b3828] text-lg font-bold text-[#fff4df] shadow-[0_4px_10px_rgba(60,27,13,0.2)] transition hover:bg-[#81452f] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b5538]"
                    >
                      ×
                    </button>
                  </header>
                  <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-4">
                    {openPanel === "inventory" ? inventoryPanel : shopPanel}
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </section>
  );
}
