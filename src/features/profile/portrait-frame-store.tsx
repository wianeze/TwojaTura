"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { PlayerPortraitFrame } from "@/components/ui/player-portrait-frame";
import type {
  PortraitFrameDefinition,
  PortraitFrameStoreData,
} from "./portrait-frames";
import { portraitFrameRarityLabel } from "./portrait-frame-view-model";
import { setActivePortraitFrameAction } from "./portrait-frame-actions";

type OpenPanel = "inventory" | "shop" | null;

const rarityTone = {
  common: "border-white/55 bg-white/55 text-[#64574c]",
  rare: "border-[#82bce8]/55 bg-[#e8f5ff]/70 text-[#2c628c]",
  epic: "border-[#aa78d4]/55 bg-[#f3e8fb]/75 text-[#72428f]",
  legendary: "border-[#e3ae4d]/65 bg-[#fff0c7]/75 text-[#8c5b13]",
} as const;

function StoreTile({
  icon,
  eyebrow,
  title,
  onClick,
}: {
  icon: string;
  eyebrow: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="paper-wash group flex min-w-0 items-center gap-2 rounded-2xl border border-[#d0ae77]/65 px-3 py-3 text-left shadow-[0_7px_18px_rgba(58,30,15,0.12)] transition hover:-translate-y-0.5 hover:border-[#c87939] hover:shadow-[0_10px_24px_rgba(151,79,34,0.2)] sm:px-4"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#4c2c20] text-lg shadow-inner sm:size-10">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="text-accent block text-[0.56rem] font-black tracking-[0.16em] uppercase sm:text-[0.62rem]">
          {eyebrow}
        </span>
        <span className="block truncate text-xs font-bold text-[#4d3528] sm:text-sm">
          {title}
        </span>
      </span>
    </button>
  );
}

function FramePreview({
  frame,
  avatarUrl,
  displayName,
}: {
  frame: PortraitFrameDefinition;
  avatarUrl: string | null;
  displayName: string;
}) {
  return (
    <PlayerPortraitFrame
      avatarUrl={avatarUrl}
      name={displayName}
      frameType={frame.key}
      size="large"
      className="w-[4.6rem] sm:w-[5.4rem]"
    />
  );
}

function FrameDialog({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-100 flex items-end justify-center overflow-x-hidden bg-[#170b08]/82 p-2 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] backdrop-blur-sm sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="paper-wash shadow-warm max-h-[min(82vh,50rem)] w-full max-w-3xl overflow-y-auto rounded-[1.75rem] border border-[#d1a567]/70 p-4 sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-accent text-[0.6rem] font-black tracking-[0.17em] uppercase">
              Karta Gracza
            </p>
            <h2 className="font-display mt-1 text-2xl font-bold text-[#452f24] sm:text-3xl">
              {title}
            </h2>
            <p className="mt-1 text-sm text-[#78614f]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full bg-[#2d1913] text-lg font-black text-[#f7ead5]"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </section>
    </div>
  );
}

export function PortraitFrameStore({
  data,
  avatarUrl,
  displayName,
}: {
  data: PortraitFrameStoreData;
  avatarUrl: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState<OpenPanel>(null);
  const [activeFrameKey, setActiveFrameKey] = useState(data.activeFrameKey);
  const [message, setMessage] = useState<string | null>(null);
  const [focusedFrame, setFocusedFrame] =
    useState<PortraitFrameDefinition | null>(null);
  const [isPending, startTransition] = useTransition();

  function activate(frameKey: string) {
    const formData = new FormData();
    formData.set("frameKey", frameKey);
    setMessage(null);
    startTransition(async () => {
      const result = await setActivePortraitFrameAction(formData);
      setMessage(result.message);
      if (result.ok) {
        setActiveFrameKey(frameKey as typeof activeFrameKey);
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <StoreTile
          icon="🎒"
          eyebrow="Ekwipunek"
          title="Twoje ramki"
          onClick={() => {
            setMessage(null);
            setFocusedFrame(null);
            setOpenPanel("inventory");
          }}
        />
        <StoreTile
          icon="🪙"
          eyebrow="Sklep"
          title="Zdobądź nowe"
          onClick={() => {
            setMessage(null);
            setFocusedFrame(null);
            setOpenPanel("shop");
          }}
        />
      </div>

      {openPanel === "inventory" ? (
        <FrameDialog
          title="Ekwipunek ramek"
          subtitle="Wybierz oprawę swojej Karty Gracza."
          onClose={() => setOpenPanel(null)}
        >
          {focusedFrame ? (
            <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[#c89555]/55 bg-white/55 p-3">
              <PlayerPortraitFrame
                avatarUrl={avatarUrl}
                name={displayName}
                frameType={focusedFrame.key}
                size="large"
                className="w-[7rem] shrink-0 sm:w-[8rem]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-accent text-[0.58rem] font-black tracking-[0.14em] uppercase">
                  {portraitFrameRarityLabel[focusedFrame.rarity]}
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold text-[#4d3022]">
                  {focusedFrame.name}
                </h3>
                <button
                  type="button"
                  disabled={activeFrameKey === focusedFrame.key || isPending}
                  onClick={() => activate(focusedFrame.key)}
                  className="mt-3 rounded-xl bg-[#3f251c] px-4 py-2 text-xs font-bold text-[#fff0dc] disabled:cursor-default disabled:bg-[#8b7b6d]"
                >
                  {activeFrameKey === focusedFrame.key
                    ? "Aktywna"
                    : "Ustaw ramkę"}
                </button>
              </div>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {data.ownedFrames.map((frame) => {
              const isActive = activeFrameKey === frame.key;
              return (
                <article
                  key={frame.key}
                  className={`flex min-w-0 flex-col items-center rounded-2xl border p-2.5 text-center ${rarityTone[frame.rarity]}`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedFrame(frame)}
                    className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b96a35]"
                    aria-label={`Pokaż podgląd ramki ${frame.name}`}
                  >
                    <FramePreview
                      frame={frame}
                      avatarUrl={avatarUrl}
                      displayName={displayName}
                    />
                  </button>
                  <h3 className="mt-2 line-clamp-2 min-h-8 text-xs font-black sm:text-sm">
                    {frame.name}
                  </h3>
                  <p className="mt-0.5 text-[0.58rem] font-bold uppercase opacity-75">
                    {portraitFrameRarityLabel[frame.rarity]}
                  </p>
                  <button
                    type="button"
                    disabled={isActive || isPending}
                    onClick={() => activate(frame.key)}
                    className="mt-2 min-h-8 w-full rounded-xl bg-[#3f251c] px-2 py-1.5 text-xs font-bold text-[#fff0dc] disabled:cursor-default disabled:bg-[#8b7b6d]"
                  >
                    {isActive ? "Aktywna" : "Ustaw"}
                  </button>
                </article>
              );
            })}
          </div>
          {message ? (
            <p className="mt-3 text-center text-sm font-semibold text-[#71442f]">
              {message}
            </p>
          ) : null}
        </FrameDialog>
      ) : null}

      {openPanel === "shop" ? (
        <FrameDialog
          title="Sklep z ramkami"
          subtitle="Nowa waluta już wkrótce"
          onClose={() => setOpenPanel(null)}
        >
          {focusedFrame ? (
            <div className="mb-4 flex items-center gap-4 rounded-2xl border border-[#c89555]/55 bg-white/55 p-3">
              <PlayerPortraitFrame
                avatarUrl={avatarUrl}
                name={displayName}
                frameType={focusedFrame.key}
                size="large"
                className="w-[7rem] shrink-0 sm:w-[8rem]"
              />
              <div className="min-w-0 flex-1">
                <p className="text-accent text-[0.58rem] font-black tracking-[0.14em] uppercase">
                  {portraitFrameRarityLabel[focusedFrame.rarity]}
                </p>
                <h3 className="font-display mt-1 text-xl font-semibold text-[#4d3022]">
                  {focusedFrame.name}
                </h3>
                <button
                  type="button"
                  disabled
                  className="mt-3 rounded-xl bg-[#8b7b6d] px-4 py-2 text-xs font-black tracking-[0.12em] text-[#fff0dc] uppercase"
                >
                  Wkrótce
                </button>
              </div>
            </div>
          ) : null}
          {data.shopFrames.length === 0 ? (
            <p className="rounded-2xl bg-white/55 px-4 py-6 text-center text-sm text-[#715b49]">
              Wszystkie dostępne ramki są już w Twoim Ekwipunku.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {data.shopFrames.map((frame) => (
                <article
                  key={frame.key}
                  className={`flex min-w-0 flex-col items-center rounded-2xl border p-2.5 text-center ${rarityTone[frame.rarity]}`}
                >
                  <button
                    type="button"
                    onClick={() => setFocusedFrame(frame)}
                    className="rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b96a35]"
                    aria-label={`Pokaż podgląd ramki ${frame.name}`}
                  >
                    <FramePreview
                      frame={frame}
                      avatarUrl={avatarUrl}
                      displayName={displayName}
                    />
                  </button>
                  <h3 className="mt-2 line-clamp-2 min-h-8 text-xs font-black sm:text-sm">
                    {frame.name}
                  </h3>
                  <p className="mt-0.5 text-[0.58rem] font-bold uppercase opacity-75">
                    {portraitFrameRarityLabel[frame.rarity]}
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-2 min-h-8 w-full cursor-not-allowed rounded-xl bg-[#8b7b6d] px-2 py-1.5 text-xs font-black tracking-[0.1em] text-[#fff0dc] uppercase"
                  >
                    Wkrótce
                  </button>
                </article>
              ))}
            </div>
          )}
        </FrameDialog>
      ) : null}
    </>
  );
}
