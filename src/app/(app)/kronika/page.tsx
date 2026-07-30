import { ActionLink } from "@/components/ui/action-button";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { ChronicleFeed } from "@/features/plays/chronicle-feed";
import { listChroniclePlays } from "@/features/plays/queries";

export default async function ChroniclePage() {
  const plays = await listChroniclePlays();

  return (
    <div className="space-y-4">
      <header
        style={{ animationDelay: `${getEntranceStaggerDelayMs(0)}ms` }}
        className="anim-rise-in-fast flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-[#e3ae67] uppercase">
            Historia stołu
          </p>
          <h1 className="font-display text-cream mt-2 text-[1.85rem] font-semibold tracking-tight sm:text-[2.2rem]">
            Kronika
          </h1>
        </div>

        {/*
          Nagłówek jest kolumną na smartfonie — self-end dosuwa akcję do
          prawej krawędzi bez rozciągania jej na całą szerokość.
        */}
        <ActionLink
          action="chronicle"
          href="/kronika/nowa"
          className="self-end sm:self-auto"
        >
          Zapisz partię
        </ActionLink>
      </header>

      <ChronicleFeed items={plays} />
    </div>
  );
}
