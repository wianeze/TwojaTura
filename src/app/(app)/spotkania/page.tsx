import { SectionHeading } from "@/components/ui/section-heading";
import { MeetingsShowcase } from "@/features/meetings/meetings-showcase";

export default function MeetingsPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Przy Stole"
        title="Spotkania"
        description="Zaproszenia na wspólny wieczór, proponowane terminy i decyzje podejmowane spokojnie przy jednym stole."
        action={
          <span className="border-border bg-surface text-muted w-fit rounded-full border px-4 py-2 text-xs font-bold shadow-sm">
            3 nadchodzące
          </span>
        }
      />
      <MeetingsShowcase />
    </div>
  );
}
