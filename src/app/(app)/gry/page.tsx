import { SectionHeading } from "@/components/ui/section-heading";
import { ShelfShowcase } from "@/features/games/shelf-showcase";

export default function GamesPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Wspólna kolekcja"
        title="Półka"
        description="Wszystkie fizyczne egzemplarze gier należące do naszej grupy — niezależnie od właściciela i tego, kto ma je obecnie."
        action={
          <span className="bg-moss-soft text-moss w-fit rounded-full px-4 py-2 text-xs font-bold">
            9 gier na półce
          </span>
        }
      />
      <ShelfShowcase />
    </div>
  );
}
