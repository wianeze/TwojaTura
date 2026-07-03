import { SectionHeading } from "@/components/ui/section-heading";
import { LibraryShowcase } from "@/features/games/library-showcase";

export default function GamesPage() {
  return (
    <div className="space-y-7">
      <SectionHeading
        eyebrow="Salon Gier"
        title="Biblioteka znajomych"
        description="Wspólna kolekcja pod jednym dachem. Przeglądaj pudełka, odkrywaj nowe tytuły i sprawdzaj, co pasuje do ekipy."
        action={
          <span className="bg-moss-soft text-moss w-fit rounded-full px-4 py-2 text-xs font-bold">
            4 gry w salonie
          </span>
        }
      />
      <LibraryShowcase />
    </div>
  );
}
