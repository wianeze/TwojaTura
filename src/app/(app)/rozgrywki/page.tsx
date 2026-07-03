import { SectionHeading } from "@/components/ui/section-heading";
import { ChronicleShowcase } from "@/features/plays/chronicle-showcase";

export default function PlaysPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Dziennik wieczorów"
        title="Kronika Partii"
        description="Papierowy ślad po rozegranych historiach — kto wygrał, ile trwała partia i co zostało w pamięci po złożeniu planszy."
        action={
          <span className="border-border bg-surface text-muted w-fit rounded-full border px-4 py-2 text-xs font-bold shadow-sm">
            3 ostatnie wpisy
          </span>
        }
      />
      <ChronicleShowcase />
    </div>
  );
}
