import { SectionHeading } from "@/components/ui/section-heading";
import { MeetingsShowcase } from "@/features/meetings/meetings-showcase";

export default function CalendarPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Planowanie wieczorów"
        title="Kalendarium"
        description="Spotkania, proponowane terminy, ankiety dostępności i wybór gier na wspólny wieczór."
        action={
          <span className="paper-wash text-muted w-fit rounded-full px-4 py-2 text-xs font-bold shadow-sm">
            3 nadchodzące
          </span>
        }
      />
      <MeetingsShowcase />
    </div>
  );
}
