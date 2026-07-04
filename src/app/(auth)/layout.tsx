import type { ReactNode } from "react";
import Image from "next/image";

export default function AuthLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <main className="wood-grain relative grid min-h-screen overflow-hidden p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_30rem] lg:gap-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_45%,rgba(223,106,53,0.18),transparent_24rem)]" />
      <div className="relative flex items-center justify-center py-10 lg:py-0">
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
          <p className="font-display mx-auto mt-6 max-w-sm text-xl leading-8 text-[#e5d7c3]">
            Zbierz ekipę. Wybierz grę.
            <span className="block text-[#efb55e]">Twoja tura.</span>
          </p>
        </div>
      </div>
      <div className="bg-background/96 shadow-warm relative flex items-center justify-center rounded-[2rem] px-4 py-8 sm:px-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </main>
  );
}
