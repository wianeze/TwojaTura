import Image from "next/image";
import Link from "next/link";
import { formatQuestRenownPreview } from "./formatting";
import { getQuestVisualVariant } from "./quest-variants";
import type { DashboardQuest } from "./types";

type QuestCardProps = {
  quest: DashboardQuest;
  isPrimary?: boolean;
};

export function QuestCard({ quest, isPrimary = false }: QuestCardProps) {
  const variant = getQuestVisualVariant(quest);
  const renownPreview = formatQuestRenownPreview(quest);
  const isActiveClickable = quest.type !== "info";

  return (
    <Link
      href={quest.href}
      className={`premium-edge group relative ml-6 flex min-h-[6.5rem] w-[calc(100%-1.5rem)] overflow-visible rounded-[1.05rem] px-3 py-2.25 pl-9 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a05d] sm:ml-7 sm:min-h-[6.75rem] sm:w-[calc(100%-1.75rem)] sm:px-3.5 sm:py-2.5 sm:pl-10 ${
        variant.cardClassName
      } ${isActiveClickable ? "quest-glow" : ""} ${
        isActiveClickable && isPrimary ? "quest-glow-sheen" : ""
      }`}
    >
      <span
        aria-hidden="true"
        className={`absolute -top-10 -left-10 size-28 rounded-full blur-3xl ${variant.glowClassName}`}
      />

      <span className="pointer-events-none absolute top-1/2 left-0 z-20 -translate-x-[52%] -translate-y-1/2 transition-transform group-hover:-translate-x-[56%]">
        <Image
          src={variant.exclamationAsset}
          alt=""
          width={108}
          height={108}
          className={`object-contain object-center drop-shadow-[0_12px_16px_rgba(69,35,22,0.32)] ${
            variant.isMeetingQuest
              ? "size-[5.625rem] sm:size-[6.25rem]"
              : "size-[5rem] sm:size-[5.625rem]"
          }`}
        />
      </span>

      <span className="relative flex min-w-0 flex-1 flex-col">
        <span
          className={`w-fit rounded-full px-2 py-[0.16rem] text-[0.46rem] font-bold tracking-[0.16em] uppercase sm:text-[0.48rem] ${variant.badgeClassName}`}
        >
          Zlecenie
        </span>

        <span
          className={`font-display mt-1 line-clamp-2 block font-semibold ${
            variant.isMeetingQuest
              ? "text-[0.95rem] leading-[1.12]"
              : "text-[0.88rem] leading-[1.24]"
          } ${variant.titleClassName}`}
        >
          {quest.title}
        </span>

        {quest.description ? (
          <span
            className={`mt-0.5 line-clamp-1 block text-[0.63rem] leading-[1.2] ${variant.descriptionClassName}`}
          >
            {quest.description}
          </span>
        ) : null}

        <span className="mt-auto flex min-w-0 items-end justify-between gap-2 pt-1.5">
          <span
            className={`min-w-0 text-[0.64rem] font-bold ${variant.ctaClassName}`}
          >
            {quest.ctaLabel} {"→"}
          </span>

          {/*
            Nagroda operacyjna jest detalem, nie głównym CTA: mała plakietka
            z realną wartością albo — dla czynności bez Renomy — nic.
          */}
          {renownPreview ? (
            <span
              className={`shrink-0 rounded-full px-2 py-[0.2rem] text-right text-[0.58rem] leading-none font-bold whitespace-nowrap sm:text-[0.6rem] ${variant.rewardClassName}`}
            >
              {renownPreview}
            </span>
          ) : null}
        </span>
      </span>
    </Link>
  );
}
