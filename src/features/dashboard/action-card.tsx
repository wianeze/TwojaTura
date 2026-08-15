import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { formatQuestRenownPreview } from "./formatting";
import {
  getQuestVisualVariant,
  type QuestVisualVariant,
} from "./quest-variants";
import type { DashboardQuest } from "./types";

type QuestCardProps = {
  quest: DashboardQuest;
  isPrimary?: boolean;
};

type QuestRewardBadgeProps = {
  amount: number;
  plateAsset: QuestVisualVariant["badgePlateAsset"];
  textClassName: QuestVisualVariant["rewardTextClassName"];
};

/**
 * Plakietka „+X Renomy” po prawej stronie karty questa — miniaturowa wersja
 * TEJ SAMEJ plakietki co ActionButton (public/assets/buttons/*.png przez
 * border-image, patrz .quest-reward-badge w globals.css). Zero dedykowanych
 * assetów nagrody. Jedna linia, bez nagród „na później” — pole `renownPoints`
 * questa to jedyna realna wartość, którą baza naliczy.
 */
export function QuestRewardBadge({
  amount,
  plateAsset,
  textClassName,
}: QuestRewardBadgeProps) {
  return (
    <span
      className="quest-reward-badge"
      style={{ "--quest-badge-plate": `url(${plateAsset})` } as CSSProperties}
    >
      <span
        className={`quest-reward-badge__text text-center text-[0.5rem] leading-none font-bold tracking-wide uppercase sm:text-[0.56rem] ${textClassName}`}
      >
        +{amount} Renomy
      </span>
    </span>
  );
}

export function QuestCard({ quest, isPrimary = false }: QuestCardProps) {
  const variant = getQuestVisualVariant(quest);
  const renownPreview = formatQuestRenownPreview(quest);
  const isActiveClickable = quest.type !== "info";

  // `py-0.5` na mobile jest celowo minimalne: pogrubiona rama (patrz
  // --quest-frame-band w globals.css) sama daje treści szeroki odstęp od
  // krawędzi, więc dokładanie do niej jeszcze 9px paddingu tylko windowało
  // wysokość karty. Zabranie go oddaje niemal cały wzrost wysokości wynikający
  // z grubszej ramy, nie ruszając układu treści ani desktopu (sm:py-2.5 bez zmian).
  return (
    <Link
      href={quest.href}
      className={`quest-card-frame relative ml-2 flex min-h-[4.75rem] w-[calc(100%-0.5rem)] overflow-visible px-2 py-0 pl-1 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a05d] sm:min-h-[5.25rem] sm:px-3.5 sm:py-1 sm:pl-2 ${
        isActiveClickable ? "quest-glow" : ""
      } ${isActiveClickable && isPrimary ? "quest-glow-sheen" : ""}`}
      style={
        {
          "--quest-frame-asset": `url(${variant.cardFrameAsset})`,
          "--quest-frame-slice": variant.cardFrameSlice,
          "--quest-frame-edge": variant.cardFrameEdgeInset,
          "--quest-accent-offset": `${variant.accentOffset}px`,
          "--quest-accent-offset-sm": `${variant.accentOffsetSm}px`,
          "--quest-accent-scale": variant.accentScale,
          "--quest-glow-strong": variant.glowStrongColor,
          "--quest-glow-soft": variant.glowSoftColor,
          "--quest-glow-strong-hover": variant.glowStrongHoverColor,
          "--quest-glow-soft-hover": variant.glowSoftHoverColor,
        } as CSSProperties
      }
    >
      {/*
        Trzy akcenty na krawędź: mały – duży (środek) – mały. Duży bierze
        `variant.accentAsset` (wariant `-epic`), boczne `variant.accentAssetSm`
        (wariant bez `-epic`) — dwa różne pliki tej samej rarity, nie ten sam
        skalowany przez CSS. Rozmiar/pozycja bocznych i tak sterowane przez
        CSS (.quest-card-accent--sm/--left/--right, patrz globals.css). Dolny
        rząd to te same pliki odwrócone w pionie przez CSS (scaleY(-1)).
        Dekoracja poza flow.

        width/height celowo małe (200×110), a NIE naturalne wymiary pliku:
        źródła mają 325×265 do 1536×1024 i po kilkaset kB do 1.8 MB, a ornament
        renderuje się w ~15-70px. Te wartości sterują tylko doborem wariantu
        przez next/image — o realnym rozmiarze decyduje CSS (`height` z bandu,
        `width: auto`), a element jest absolutny, więc niezgodność proporcji
        w atrybutach nie powoduje przeskoku layoutu. `loading="eager"`, bo to
        dekoracja zawsze widoczna, nie doładowywana przy scrollu.
      */}
      <Image
        aria-hidden="true"
        src={variant.accentAssetSm}
        alt=""
        width={200}
        height={110}
        loading="eager"
        className="quest-card-accent quest-card-accent--sm quest-card-accent--top quest-card-accent--left"
      />
      <Image
        aria-hidden="true"
        src={variant.accentAsset}
        alt=""
        width={200}
        height={110}
        loading="eager"
        className="quest-card-accent quest-card-accent--top"
      />
      <Image
        aria-hidden="true"
        src={variant.accentAssetSm}
        alt=""
        width={200}
        height={110}
        loading="eager"
        className="quest-card-accent quest-card-accent--sm quest-card-accent--top quest-card-accent--right"
      />
      <Image
        aria-hidden="true"
        src={variant.accentAssetSm}
        alt=""
        width={200}
        height={110}
        loading="eager"
        className="quest-card-accent quest-card-accent--sm quest-card-accent--bottom quest-card-accent--left"
      />
      <Image
        aria-hidden="true"
        src={variant.accentAsset}
        alt=""
        width={200}
        height={110}
        loading="eager"
        className="quest-card-accent quest-card-accent--bottom"
      />
      <Image
        aria-hidden="true"
        src={variant.accentAssetSm}
        alt=""
        width={200}
        height={110}
        loading="eager"
        className="quest-card-accent quest-card-accent--sm quest-card-accent--bottom quest-card-accent--right"
      />

      {/*
        Emblemat jest wyśrodkowany DOKŁADNIE na lewej krawędzi karty: połowa
        wystaje poza kartę, połowa nachodzi na ramę.
        `left: 0` by tu NIE zadziałało — element absolutny liczy `left` od
        PADDING-boxa, a ten zaczyna się dopiero za ramą, więc `left: 0` siada
        na wewnętrznej krawędzi ramy, nie na krawędzi karty. Zewnętrzna
        krawędź karty (border-box) leży o całą grubość ramy w lewo, stąd
        `-1 * var(--quest-frame-band)`. To nie jest kotwiczenie do środka
        ramy (to było poprzednie `-0.5 *`), tylko do jej zewnętrznego lica.
        -translate-x-1/2 na obrazku centruje go na tym punkcie, więc zmiana
        rozmiaru emblematu nie wymaga przeliczania pozycji. z-30 nad
        .quest-glow::before (z-index: -1). Stała pozycja na hover.
      */}
      <span
        className="pointer-events-none absolute top-1/2 z-30 -translate-y-1/2"
        style={
          {
            // Środek emblematu ma trafiać w WIDOCZNĄ lewą krawędź ramy, a nie
            // w krawędź border-boxa. Asset ramy ma po lewej przezroczysty
            // margines (2–46px źródła zależnie od rarity), który po
            // przeskalowaniu przez slice daje 0.3–6px — i o tyle właśnie rama
            // wypadała na prawo od środka emblematu.
            // +8px kompensuje poszerzenie karty o 8px w lewo (ml-4 -> ml-2):
            // emblemat jest pozycjonowany względem karty, więc bez tego
            // przesunąłby się razem z nią. Zostaje dokładnie tam, gdzie był.
            left: "calc(var(--quest-frame-band) * (var(--quest-frame-edge, 0) / var(--quest-frame-slice, 320) - 1) + 8px)",
          } as CSSProperties
        }
      >
        <Image
          src={variant.exclamationAsset}
          alt=""
          width={130}
          height={130}
          // JEDEN rozmiar dla wszystkich rarity. Wcześniej questy
          // nie-spotkaniowe miały 7.25rem zamiast 7.75rem — emblemat wystawał
          // wtedy w lewo do -26px zamiast -30px, przez co biała i zielona
          // karta wyglądały na krótsze z lewej strony mimo identycznej
          // szerokości (zmierzone: 512.7px w każdej z pięciu).
          className="-translate-x-1/2 object-contain object-center drop-shadow-[0_12px_16px_rgba(69,35,22,0.32)] size-[7.75rem]"
        />
      </span>

      <span className="relative flex min-w-0 flex-1 flex-col">
        <span
          className={`w-fit rounded-full px-2 py-[0.1rem] text-[0.46rem] font-bold tracking-[0.16em] uppercase sm:text-[0.48rem] ${variant.badgeClassName}`}
        >
          Zlecenie
        </span>

        {/*
          Jeden rozmiar tytułu dla wszystkich rarity — ten sam co miały questy
          spotkaniowe. Wcześniej reszta dostawała 0.88rem/1.16, przez co przy
          dłuższym tytule łamała się w innym miejscu i karta rosła inaczej niż
          sąsiednie.
        */}
        <span
          className={`font-display line-clamp-2 block text-[0.95rem] leading-[1.04] font-semibold ${variant.titleClassName}`}
        >
          {quest.title}
        </span>

        {quest.description ? (
          <span
            className={`line-clamp-1 block text-[0.63rem] leading-[1.08] ${variant.descriptionClassName}`}
          >
            {quest.description}
          </span>
        ) : null}

        <span className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-0">
          <span
            className={`min-w-0 text-[0.64rem] font-bold ${variant.ctaClassName}`}
          >
            {quest.ctaLabel} {"→"}
          </span>
        </span>
      </span>

      {/*
        Nagroda operacyjna jest detalem, nie głównym CTA: mała plakietka
        z realną wartością albo — dla czynności bez Renomy — nic. Bezpośrednie
        dziecko .quest-card-frame (nie wiersza CTA) — position:absolute,
        pionowo wyśrodkowana względem całej karty (patrz .quest-reward-badge
        w globals.css), niezależnie od wysokości tytułu/opisu nad nią.
      */}
      {renownPreview && quest.renownPoints ? (
        <QuestRewardBadge
          amount={quest.renownPoints}
          plateAsset={variant.badgePlateAsset}
          textClassName={variant.rewardTextClassName}
        />
      ) : null}
    </Link>
  );
}
