import Image from "next/image";
import Link from "next/link";

export type DashboardQuestType = "action" | "question";

export type DashboardQuest = {
  id: string;
  type: DashboardQuestType;
  title: string;
  description?: string;
  href: string;
  optionalPoints?: number;
  createdAt?: string;
};

type QuestCardProps = {
  quest: DashboardQuest;
};

const actionPresentation: Record<
  DashboardQuestType,
  { icon: string; label: string; accent: string; glow: string }
> = {
  action: {
    icon: "/brand/exclamation-nobg.png",
    label: "Ważne",
    accent: "text-[#9a4f32]",
    glow: "bg-[#d97845]/16",
  },
  question: {
    icon: "/brand/question-nobg.png",
    label: "Twoja odpowiedź",
    accent: "text-[#526b54]",
    glow: "bg-[#738c68]/16",
  },
};

export function QuestCard({ quest }: QuestCardProps) {
  const presentation = actionPresentation[quest.type];

  return (
    <Link
      href={quest.href}
      className="parchment-card premium-edge group relative flex items-start gap-2.5 overflow-hidden rounded-[1.2rem] px-3 py-3 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#e2a05d] sm:px-4 sm:py-3.5"
    >
      <span
        aria-hidden="true"
        className={`absolute -top-8 -left-8 size-24 rounded-full blur-2xl ${presentation.glow}`}
      />
      <span className="relative flex w-18 shrink-0 items-center justify-center self-stretch">
        <Image
          src={presentation.icon}
          alt=""
          width={72}
          height={72}
          className="size-16 object-contain object-center drop-shadow-[0_8px_12px_rgba(69,35,22,0.3)] transition-transform group-hover:-translate-y-0.5 group-hover:scale-105"
        />
      </span>

      <span className="relative min-w-0 flex-1">
        <span className="flex flex-wrap items-center justify-between gap-2">
          <span
            className={`text-[0.58rem] font-bold tracking-[0.14em] uppercase ${presentation.accent}`}
          >
            {presentation.label}
          </span>
          {quest.createdAt && (
            <span className="text-muted text-[0.58rem]">{quest.createdAt}</span>
          )}
        </span>
        <span className="font-display text-foreground mt-1 block text-base leading-5 font-semibold">
          {quest.title}
        </span>
        {quest.description && (
          <span className="text-muted mt-0.5 block text-[0.7rem] leading-4">
            {quest.description}
          </span>
        )}
        <span className="mt-2 flex items-center justify-between gap-3">
          <span className="text-accent text-[0.65rem] font-bold">Otwórz →</span>
          {quest.optionalPoints !== undefined && (
            <span className="bg-wood-dark text-gold rounded-full px-2.5 py-1 text-[0.62rem] font-bold shadow-sm">
              +{quest.optionalPoints} pkt
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}
