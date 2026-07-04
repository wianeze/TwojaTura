import { SectionHeading } from "@/components/ui/section-heading";
import { LegendariumShowcase } from "@/features/legendarium/legendarium-showcase";

export default function LegendariumPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Klubowe opowieści"
        title="Legendarium"
        description="Ranking graczy, przypięte wyzwania, ostatnie zdobycze i osiągnięcia, które budują historię naszej grupy."
        action={
          <span className="bg-moss-soft text-moss w-fit rounded-full px-4 py-2 text-xs font-bold">
            statyczna makieta MVP 2
          </span>
        }
      />
      <LegendariumShowcase />
    </div>
  );
}
