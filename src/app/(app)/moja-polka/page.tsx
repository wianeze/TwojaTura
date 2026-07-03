import { SectionHeading } from "@/components/ui/section-heading";
import { ShelfShowcase } from "@/features/games/shelf-showcase";

export default function MyShelfPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Drewniana półka"
        title="Półka Gier"
        description="Twój kawałek klubowej biblioteki — pudełka, które znasz, lubisz i możesz przynieść na następny wieczór."
        action={
          <span className="border-border bg-surface text-muted w-fit rounded-full border px-4 py-2 text-xs font-bold shadow-sm">
            4 gry · statyczna makieta
          </span>
        }
      />
      <ShelfShowcase />
    </div>
  );
}
