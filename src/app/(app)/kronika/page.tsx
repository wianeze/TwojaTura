import { Suspense } from "react";
import { ChronicleRouteLoading } from "@/components/layout/main-route-loading";
import { ActionLink } from "@/components/ui/action-button";
import { getEntranceStaggerDelayMs } from "@/lib/animation";
import { ChronicleFeed } from "@/features/plays/chronicle-feed";
import { listChroniclePlays } from "@/features/plays/queries";
import { profileServerOperation } from "@/lib/server-performance";

async function ChronicleFeedContent() {
  const plays = await profileServerOperation("/kronika", listChroniclePlays);

  return <ChronicleFeed items={plays} />;
}

export default function ChroniclePage() {
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
          <h1 className="font-display text-cream mt-2 text-[1.85rem] font-extrabold tracking-tight sm:text-[2.2rem]">
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

      <Suspense fallback={<ChronicleRouteLoading includeHeader={false} />}>
        <ChronicleFeedContent />
      </Suspense>
    </div>
  );
}
