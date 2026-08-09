import type { ReactNode } from "react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="wood-grain relative grid min-h-dvh content-start overflow-hidden p-3 sm:p-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:content-normal lg:gap-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_45%,rgba(223,106,53,0.18),transparent_24rem)]" />
      <div className="relative flex items-start justify-center pt-2 pb-4 sm:items-center sm:py-10 lg:py-0">
        <div className="text-center">
          <div className="mx-auto max-w-xs drop-shadow-[0_30px_60px_rgba(18,8,5,0.58)] sm:max-w-sm">
            <Image
              src="/brand/logo-tt-transparent.png"
              alt="Twoja Tura!"
              width={560}
              height={560}
              priority
              className="h-auto w-full object-contain"
            />
          </div>
          <p className="font-display mx-auto mt-2 max-w-sm text-lg leading-7 text-[#e5d7c3] sm:mt-6 sm:text-xl sm:leading-8">
            Zbierz ekipę. Wybierz grę.
            <span className="block text-[#efb55e]">Twoja tura.</span>
          </p>
        </div>
      </div>
      <div className="bg-background/96 shadow-warm relative flex items-start justify-center self-start rounded-[1.5rem] px-3 py-3 sm:items-center sm:self-stretch sm:rounded-[2rem] sm:px-8 sm:py-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
