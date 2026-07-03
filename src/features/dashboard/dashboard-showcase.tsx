import Image from "next/image";
import Link from "next/link";
import { Panel } from "@/components/ui/panel";

const circleCards = [
  {
    label: "Najbliższy wieczór",
    value: "Sobota · 18:00",
    note: "Górska Chata u Michała",
    accent: "text-[#8b5938]",
    surface: "-rotate-[0.45deg]",
    tape: "bg-[#b98c60]/55",
  },
  {
    label: "Ankieta dostępności",
    value: "4 z 6 osób",
    note: "Dwie odpowiedzi jeszcze czekają",
    accent: "text-moss",
    surface: "rotate-[0.28deg] md:mt-3",
    tape: "bg-[#7f9275]/45",
  },
  {
    label: "Propozycje na stół",
    value: "3 gry",
    note: "Nemesis prowadzi",
    accent: "text-accent",
    surface: "-rotate-[0.2deg]",
    tape: "bg-[#bd7451]/45",
  },
];

export function DashboardShowcase() {
  return (
    <div className="space-y-7 sm:space-y-9">
      <section className="text-cream relative isolate flex min-h-[29rem] overflow-hidden rounded-[2.4rem] border border-[#c99768]/20 shadow-[0_38px_100px_rgba(12,6,4,0.58)] sm:min-h-[31rem] lg:min-h-[34rem]">
        <Image
          src="/brand/hero-desktop.png"
          alt="Wieczór planszówkowy w górskiej chacie przy kominku"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 80vw"
          className="-z-30 hidden object-cover object-center md:block"
        />
        <Image
          src="/brand/hero-mobile.png"
          alt="Wieczór planszówkowy w górskiej chacie przy kominku"
          fill
          priority
          sizes="(max-width: 767px) calc(100vw - 2rem), 0px"
          className="-z-30 object-cover object-[center_58%] md:hidden"
        />
        <div className="absolute inset-0 -z-20 bg-[linear-gradient(90deg,rgba(17,9,7,0.94),rgba(17,9,7,0.76))] md:bg-[linear-gradient(90deg,rgba(17,9,7,0.94)_0%,rgba(20,11,8,0.79)_38%,rgba(20,11,8,0.32)_68%,rgba(12,7,5,0.14)_100%)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(13,7,5,0.42),rgba(13,7,5,0.2)_35%,rgba(13,7,5,0.92)_100%)] md:bg-[radial-gradient(circle_at_20%_50%,rgba(220,116,53,0.13),transparent_34rem)]" />

        <div className="relative flex w-full max-w-2xl flex-col justify-end px-5 py-7 sm:px-9 sm:py-10 md:justify-center lg:px-12">
          <span className="w-fit rounded-full border border-[#e4b16c]/25 bg-black/30 px-3 py-1.5 text-[0.63rem] font-bold tracking-[0.2em] text-[#e3bd86] uppercase backdrop-blur-md">
            Krąg Graczy · wieczór trwa
          </span>
          <h1 className="font-display mt-5 text-4xl leading-[1.06] font-semibold tracking-tight text-[#fff2df] drop-shadow-[0_5px_24px_rgba(0,0,0,0.72)] sm:text-5xl xl:text-6xl">
            Zbierz ekipę.
            <br />
            Wybierz grę.
            <span className="mt-1 block text-[#e2a05d]">Twoja tura.</span>
          </h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[#e2d2c0] drop-shadow-md sm:text-lg sm:leading-7">
            Jedno ciepłe miejsce dla wspólnej kolekcji, planów na wieczór i
            historii partii, do których chce się wracać.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/moja-polka"
              className="rounded-xl border border-[#efbf82]/35 bg-[#a95f3d]/95 px-4 py-3 text-sm font-bold text-[#fff1dc] shadow-[0_12px_30px_rgba(20,8,4,0.52)] backdrop-blur transition-transform hover:-translate-y-0.5 hover:bg-[#b86b45]"
            >
              Otwórz Półkę Gier
            </Link>
            <Link
              href="/spotkania"
              className="rounded-xl border border-white/18 bg-black/30 px-4 py-3 text-sm font-bold text-[#f2e4d3] backdrop-blur-md transition-colors hover:bg-black/42"
            >
              Usiądź Przy Stole
            </Link>
          </div>
        </div>
      </section>

      <section
        className="leather-panel relative grid gap-5 rounded-[2rem] border border-white/8 p-4 sm:p-6 md:grid-cols-3"
        aria-label="Krąg Graczy"
      >
        {circleCards.map((card) => (
          <Panel
            key={card.label}
            className={`parchment-card relative border-[#c6a77b]/55 p-5 sm:p-6 ${card.surface}`}
          >
            <span
              className={`absolute -top-2 left-1/2 h-5 w-14 -translate-x-1/2 -rotate-2 ${card.tape} shadow-sm`}
            />
            <p
              className={`text-[0.63rem] font-bold tracking-[0.12em] uppercase ${card.accent}`}
            >
              {card.label}
            </p>
            <p className="font-display text-foreground mt-5 text-2xl font-semibold">
              {card.value}
            </p>
            <p className="text-muted mt-2 text-sm leading-6">{card.note}</p>
          </Panel>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="parchment-card overflow-hidden border-[#c2a174]/55">
          <div className="flex items-center justify-between border-b border-[#ccb48d] bg-[#e8d4b7]/50 px-5 py-4 sm:px-6">
            <p className="text-wood text-xs font-bold tracking-[0.16em] uppercase">
              Wieczór przy stole
            </p>
            <span className="bg-moss-soft text-moss rounded-full px-3 py-1 text-[0.62rem] font-bold">
              Potwierdzone
            </span>
          </div>
          <div className="grid gap-6 p-5 sm:grid-cols-[7rem_1fr] sm:p-7">
            <div className="wood-grain text-cream grid min-h-32 place-items-center rounded-2xl text-center shadow-[0_14px_28px_rgba(42,23,16,0.25)]">
              <div>
                <span className="block text-xs font-bold tracking-widest text-[#c9945a] uppercase">
                  lipiec
                </span>
                <span className="font-display mt-1 block text-5xl font-semibold">
                  11
                </span>
                <span className="block text-xs text-[#c5b5a3]">sobota</span>
              </div>
            </div>
            <div>
              <p className="text-accent text-xs font-bold">
                18:00 · Górska Chata
              </p>
              <h2 className="font-display mt-2 text-2xl font-semibold">
                Letni wieczór z cięższą strategią
              </h2>
              <p className="text-muted mt-3 text-sm leading-6">
                Ciepła herbata, stół zarezerwowany i trzy gry czekające na
                wspólny wybór.
              </p>
            </div>
          </div>
        </Panel>

        <Panel className="wood-grain text-cream border-white/8 p-5 sm:p-6">
          <p className="text-xs font-bold tracking-[0.16em] text-[#cba36d] uppercase">
            Na drewnianym blacie
          </p>
          <div className="mt-5 space-y-3">
            {[
              ["Ankieta do wypełnienia", "Weekend 18–19 lipca", "bg-accent"],
              ["Nowa gra na półce", "Frostpunk", "bg-moss"],
              ["Ostatnia partia", "Nemesis · 108 min", "bg-[#b9864d]"],
            ].map(([label, detail, color], index) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border border-white/8 bg-black/16 p-4 ${index % 2 ? "ml-2" : "mr-2"}`}
              >
                <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="mt-0.5 truncate text-xs text-[#bcae9f]">
                    {detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
