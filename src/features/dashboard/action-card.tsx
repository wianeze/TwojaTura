import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import {
  formatQuestExpiryLabel,
  formatQuestRenownPreview,
  isQuestExpiryUrgent,
} from "./formatting";
import {
  QUEST_CARD_BACKGROUND,
  QUEST_CARD_SLICE,
  getQuestVisualVariant,
  type QuestCardKind,
} from "./quest-variants";
import type { DashboardQuest } from "./types";

type QuestCardProps = {
  quest: DashboardQuest;
  isPrimary?: boolean;
  /**
   * Rodzaj karty — "zlecenie" (domyślny, jedyny generowany dziś przez
   * `buildDashboardQuests`) albo "misja" (nagroda w Tukatach). "misja" jest
   * na razie czystym wariantem wizualnym: quests.ts nie zna tego pojęcia i
   * nie przyznaje Tukatów, więc żaden dzisiejszy quest go nie ustawia.
   */
  kind?: QuestCardKind;
  /**
   * Nagrody Misji w Tukatach — ignorowane dla kind="zlecenie". Jedna do
   * dwóch pozycji: przy jednej karta rysuje linię nad i pod nią (jak
   * Zlecenie), przy dwóch tylko jedną linię-rozdzielacz między nimi.
   */
  tukatyAmounts?: number[];
};

type QuestRenownRewardProps = {
  amount: number;
  textClassName: string;
};

/**
 * Nagroda „+X Renomy” po prawej stronie karty Zlecenia — delikatny,
 * bezpłytkowy zapis nawiązujący do referencji: cienka linia nad i pod
 * dwuwierszowym tekstem, bez ciężkiej plakietki z poprzedniego systemu.
 */
function QuestRenownReward({ amount, textClassName }: QuestRenownRewardProps) {
  return (
    <span className="quest-card-reward mr-[-1.15rem] ml-2 flex shrink-0 flex-col items-center self-center sm:mr-[-1.5rem] sm:ml-3">
      <span className="quest-reward__rule" aria-hidden="true" />
      <span
        className={`font-display text-[0.92rem] leading-tight font-bold sm:text-[1.05rem] ${textClassName}`}
      >
        +{amount}
      </span>
      <span
        className={`text-[0.58rem] leading-none font-semibold tracking-[0.08em] uppercase sm:text-[0.62rem] ${textClassName}`}
      >
        Renomy
      </span>
      <span className="quest-reward__rule" aria-hidden="true" />
    </span>
  );
}

type QuestTukatyRewardProps = {
  amounts: number[];
  textClassName: string;
};

/**
 * Nagroda/-y Misji w Tukatach — ikonka `Tukaty.png` obok „+X”, a pod tym
 * „TUKATÓW” — ten sam dwuwierszowy układ i te same klasy typografii co
 * „+X” / „RENOMY” w QuestRenownReward, łącznie z uppercase/tracking na
 * etykiecie. Ornament linii na wzór QuestRenownReward: przy JEDNEJ pozycji
 * linia nad i pod nią (bookend, jak w Zleceniu); przy DWÓCH — wyłącznie
 * jedna linia między nimi, bez linii na zewnętrznych krawędziach. Wariant
 * wyłącznie wizualny, patrz komentarz przy QuestCardKind w
 * quest-variants.ts.
 */
function QuestTukatyReward({ amounts, textClassName }: QuestTukatyRewardProps) {
  const isSingle = amounts.length === 1;

  return (
    <span className="quest-card-reward mr-[-1.15rem] ml-2 flex shrink-0 flex-col items-center gap-1 self-center sm:mr-[-1.5rem] sm:ml-3">
      {isSingle ? (
        <span className="quest-reward__rule" aria-hidden="true" />
      ) : null}
      {amounts.map((amount, index) => (
        <span key={index} className="contents">
          {index > 0 ? (
            <span className="quest-reward__rule" aria-hidden="true" />
          ) : null}
          <span className="flex flex-col items-center">
            <span className="flex items-center gap-1">
              <Image
                src="/assets/Tukaty.png"
                alt=""
                width={40}
                height={36}
                className="h-[1.35rem] w-auto object-contain drop-shadow-[0_2px_3px_rgba(69,35,22,0.35)] sm:h-[1.55rem]"
              />
              <span
                className={`font-display text-[0.92rem] leading-tight font-bold sm:text-[1.05rem] ${textClassName}`}
              >
                +{amount}
              </span>
            </span>
            <span
              className={`text-[0.58rem] leading-none font-semibold tracking-[0.08em] uppercase sm:text-[0.62rem] ${textClassName}`}
            >
              Tukatów
            </span>
          </span>
        </span>
      ))}
      {isSingle ? (
        <span className="quest-reward__rule" aria-hidden="true" />
      ) : null}
    </span>
  );
}

export function QuestCard({
  quest,
  isPrimary = false,
  kind = "zlecenie",
  tukatyAmounts,
}: QuestCardProps) {
  const variant = getQuestVisualVariant(quest);
  const renownPreview = formatQuestRenownPreview(quest);
  const expiryLabel = formatQuestExpiryLabel(quest.expiresAt);
  const expiryIsUrgent = isQuestExpiryUrgent(quest.expiresAt);
  const isActiveClickable = quest.type !== "info";
  const showRenownReward =
    kind === "zlecenie" &&
    Boolean(renownPreview) &&
    Boolean(quest.renownPoints);
  const showTukatyReward = kind === "misja" && Boolean(tukatyAmounts?.length);

  return (
    <Link
      href={quest.href}
      data-quest-kind={kind}
      className={`quest-card-frame relative flex min-h-[4.75rem] w-full overflow-visible px-2.5 py-1 pl-0 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a05d] sm:min-h-[5.25rem] sm:px-4 sm:py-1.5 sm:pl-0 ${
        isActiveClickable ? "quest-glow" : ""
      } ${isActiveClickable && isPrimary ? "quest-glow-sheen" : ""}`}
      style={
        {
          "--quest-frame-asset": `url(${QUEST_CARD_BACKGROUND[kind]})`,
          "--quest-frame-slice": QUEST_CARD_SLICE,
          "--quest-glow-strong": variant.glowStrongColor,
          "--quest-glow-soft": variant.glowSoftColor,
          "--quest-glow-strong-hover": variant.glowStrongHoverColor,
          "--quest-glow-soft-hover": variant.glowSoftHoverColor,
        } as CSSProperties
      }
    >
      {/*
        Trzykolumnowy wiersz flex: emblemat (stała szerokość) — treść
        (flex-1) — nagroda (tylko gdy istnieje, swoja naturalna szerokość).
        Żadnych ręcznie dobranych paddingów do rezerwowania miejsca na
        nagrodę — jeśli jej nie ma, treść dostaje całą resztę wiersza; jeśli
        jest, przeglądarka sama liczy, ile realnie zajmuje (patrz `ml-2` na
        samej nagrodzie w QuestRenownReward/QuestTukatyReward zamiast `pr-`
        tutaj).

        Emblemat: stała, niekurcząca się „szufladka” (`shrink-0`), wewnątrz
        której `items-center justify-center` centruje obrazek i w pionie,
        i w poziomie. `self-stretch` rozciąga szufladkę na pełną wysokość
        karty, więc pionowe centrowanie działa niezależnie od wysokości
        tytułu/opisu obok. `mr-` obok (nie `gap` na wierszu) daje ciasny,
        stały odstęp WYŁĄCZNIE do treści — odstęp treść→nagroda idzie z
        `ml-` na samej nagrodzie i może być inny, bez wspólnego `gap`
        wymuszającego tę samą wartość między każdą parą kolumn.

        `-ml-` UJEMNY: `.quest-card-frame` ma `border-width:
        var(--quest-frame-band)` (9-slice pergaminu, ~21–27px) — padding-box,
        od którego liczą się wszystkie dzieci flex, zaczyna się DOPIERO za tym
        pasem. Same paddingi na dzieciach nie mogły więc nigdy przybliżyć
        emblematu bardziej niż o szerokość pasa. Ujemny margines na
        PIERWSZYM dziecku cofa cały wiersz (emblemat i, przez normalny flow,
        wszystko po nim) w głąb pasa ramy, zamiast dalej ściskać odstępy
        między dziećmi.
      */}
      <span className="mr-0 ml-[calc(-1*var(--quest-frame-band))] flex w-[4.75rem] shrink-0 items-center justify-center self-stretch sm:mr-[0.225rem] sm:-ml-[1.1rem] sm:w-[5.5rem]">
        <Image
          src={variant.exclamationAsset}
          alt=""
          width={130}
          height={130}
          className="size-[4.75rem] object-contain object-center drop-shadow-[0_12px_16px_rgba(69,35,22,0.32)] sm:size-[5.5rem]"
        />
      </span>

      <span className="relative -ml-2 flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1">
        <span
          className={`text-[0.52rem] font-bold tracking-[0.2em] uppercase sm:text-[0.56rem] ${variant.labelClassName}`}
        >
          {kind === "misja" ? "Misja" : "Zlecenie"}
        </span>

        <span
          className={`font-display line-clamp-2 text-[0.95rem] leading-[1.08] font-semibold ${variant.titleClassName}`}
        >
          {quest.title}
        </span>

        {quest.description ? (
          <span
            className={`line-clamp-1 text-[0.63rem] leading-[1.1] ${variant.descriptionClassName}`}
          >
            {quest.description}
          </span>
        ) : null}

        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span
            className={`min-w-0 text-[0.64rem] font-bold ${variant.ctaClassName}`}
          >
            {quest.ctaLabel} {"→"}
          </span>
          {expiryLabel ? (
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[0.5rem] leading-none font-semibold tracking-[0.02em] ${
                expiryIsUrgent
                  ? "border-[#b75a3d]/45 bg-[#b75a3d]/12 text-[#8b3d2e]"
                  : "border-[#8f6847]/25 bg-[#8f6847]/8 text-[#75533d]"
              }`}
            >
              {expiryLabel}
            </span>
          ) : null}
        </span>
      </span>

      {showRenownReward ? (
        <QuestRenownReward
          amount={quest.renownPoints as number}
          textClassName={variant.rewardTextClassName}
        />
      ) : null}

      {showTukatyReward ? (
        <QuestTukatyReward
          amounts={tukatyAmounts as number[]}
          textClassName={variant.rewardTextClassName}
        />
      ) : null}
    </Link>
  );
}
