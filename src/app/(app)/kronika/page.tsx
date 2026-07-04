import { SectionHeading } from "@/components/ui/section-heading";
import { ChronicleShowcase } from "@/features/plays/chronicle-showcase";

export default function ChroniclePage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Dziennik rozegranych wieczorów"
        title="Kronika"
        description="Historia wszystkich partii — gry, spotkania, uczestnicy, zwycięzcy, miejsca, punkty i komentarze."
        action={
          <span className="paper-wash text-muted w-fit rounded-full px-4 py-2 text-xs font-bold shadow-sm">
            3 ostatnie wpisy
          </span>
        }
      />
      <ChronicleShowcase />
    </div>
  );
}
