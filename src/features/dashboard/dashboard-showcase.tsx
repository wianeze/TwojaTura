import Link from "next/link";
import { LogoMark } from "@/components/ui/logo-mark";
import { Panel } from "@/components/ui/panel";

const circleCards = [
  {
    label: "Najbliższy wieczór",
    value: "Sobota · 18:00",
    note: "Górska Chata u Michała",
    accent: "bg-[#f5e4ca] text-[#855727]",
    surface: "parchment-card -rotate-[0.35deg]",
  },
  {
    label: "Ankieta dostępności",
    value: "4 z 6 osób",
    note: "Dwie odpowiedzi jeszcze czekają",
    accent: "bg-moss-soft text-moss",
    surface: "bg-[#f2eadc] rotate-[0.25deg]",
  },
  {
    label: "Propozycje na stół",
    value: "3 gry",
    note: "Ostatnia Latarnia prowadzi",
    accent: "bg-accent-soft text-accent",
    surface: "parchment-card -rotate-[0.2deg]",
  },
];

export function DashboardShowcase() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="wood-grain fire-glow text-cream relative isolate overflow-hidden rounded-[2.25rem] border border-white/10 px-5 pt-8 pb-20 sm:px-9 sm:pt-10 sm:pb-24 lg:grid lg:min-h-[34rem] lg:grid-cols-[1.18fr_0.82fr] lg:items-center lg:gap-8 lg:px-12">
        <svg
          viewBox="0 0 800 340"
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-auto w-full opacity-35"
        >
          <path
            d="m0 290 180-170 100 95L400 74l184 173 76-75 140 118v50H0Z"
            fill="#596A56"
          />
          <path
            d="m180 120 100 95 35-41M400 74l184 173 35-34"
            fill="none"
            stroke="#F6E7C8"
            strokeWidth="8"
            opacity=".45"
          />
        </svg>
        <div className="bg-ember/15 absolute -top-24 -left-20 -z-10 size-80 rounded-full blur-3xl" />
        <div className="absolute top-8 right-8 -z-10 hidden h-40 w-52 rounded-t-[5rem] border-[10px] border-[#6e4632]/70 bg-[#17201d]/70 shadow-[0_0_0_2px_rgba(229,190,122,0.14),inset_0_0_35px_rgba(0,0,0,0.5)] lg:block">
          <span className="absolute inset-x-2 top-1/2 h-1 bg-[#6e4632]/80" />
          <span className="absolute inset-y-2 left-1/2 w-1 bg-[#6e4632]/80" />
        </div>

        <div>
          <span className="inline-flex rounded-full border border-[#e9c481]/25 bg-[#e9c481]/10 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.2em] text-[#ebc985] uppercase">
            Krąg Graczy · ogień już płonie
          </span>
          <h1 className="font-display mt-6 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl xl:text-6xl">
            Zbierz ekipę.
            <br />
            Wybierz grę.
            <span className="mt-1 block text-[#efb65c]">Twoja tura.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#d7c8b7] sm:text-lg">
            Jedno ciepłe miejsce dla wspólnej kolekcji, planów na wieczór i
            historii partii, do których chce się wracać.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/moja-polka"
              className="bg-gold text-wood-dark rounded-xl px-4 py-3 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Otwórz Półkę Gier
            </Link>
            <Link
              href="/spotkania"
              className="text-cream rounded-xl border border-white/15 bg-white/7 px-4 py-3 text-sm font-bold transition-colors hover:bg-white/12"
            >
              Usiądź Przy Stole
            </Link>
          </div>
        </div>

        <div className="relative mt-10 hidden justify-center lg:flex">
          <div className="relative flex min-h-80 flex-col items-center justify-center">
            <div className="bg-ember/25 absolute inset-10 rounded-full blur-3xl" />
            <LogoMark variant="hero" tone="light" />
            <div className="relative mt-5 h-16 w-44 rounded-t-[2.4rem] border-8 border-[#80523b] bg-[#24130f] shadow-[0_-9px_0_#5a382b,0_18px_40px_rgba(223,106,53,0.24)]">
              <span className="bg-ember absolute bottom-1 left-1/2 h-11 w-8 -translate-x-1/2 rounded-[55%_45%_52%_48%] shadow-[0_0_24px_rgba(255,150,60,0.8)]" />
              <span className="absolute bottom-1 left-1/2 h-7 w-4 -translate-x-1/2 rounded-full bg-[#ffd06e]" />
            </div>
          </div>
        </div>

        <div
          aria-hidden="true"
          className="absolute inset-x-0 bottom-0 h-13 border-t border-[#b47b4d]/35 bg-gradient-to-b from-[#754731] to-[#3a241c] shadow-[0_-14px_35px_rgba(0,0,0,0.25)]"
        >
          <span className="absolute top-3 left-[12%] size-5 rotate-12 rounded-md border border-[#f6d99d]/45 bg-[#e9d4a8] shadow-lg">
            <i className="bg-wood absolute top-1 left-1 size-1 rounded-full" />
            <i className="bg-wood absolute right-1 bottom-1 size-1 rounded-full" />
          </span>
          <span className="bg-moss absolute top-4 left-[31%] size-4 rounded-full border border-[#efd492]/50 shadow-lg" />
          <span className="bg-accent absolute top-2 left-[38%] size-4 rounded-full border border-[#efd492]/50 shadow-lg" />
          <span className="absolute top-3 right-[22%] h-7 w-11 -rotate-6 rounded-sm border border-[#d8b46f]/40 bg-[#efe2c2]/85 shadow-lg" />
        </div>
      </section>

      <section
        className="rug-pattern grid gap-4 rounded-[2rem] border border-[#bda98c]/40 p-3 sm:p-4 md:grid-cols-3"
        aria-label="Krąg Graczy"
      >
        {circleCards.map((card) => (
          <Panel key={card.label} className={`${card.surface} p-5 sm:p-6`}>
            <span
              className={`inline-flex rounded-full px-3 py-1.5 text-[0.65rem] font-bold ${card.accent}`}
            >
              {card.label}
            </span>
            <p className="font-display mt-5 text-2xl font-semibold">
              {card.value}
            </p>
            <p className="text-muted mt-2 text-sm leading-6">{card.note}</p>
          </Panel>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel className="parchment-card overflow-hidden">
          <div className="border-border flex items-center justify-between border-b bg-[#efe2cf]/55 px-5 py-4 sm:px-6">
            <p className="text-wood text-xs font-bold tracking-[0.16em] uppercase">
              Wieczór przy stole
            </p>
            <span className="bg-moss-soft text-moss rounded-full px-3 py-1 text-[0.62rem] font-bold">
              Potwierdzone
            </span>
          </div>
          <div className="grid gap-6 p-5 sm:grid-cols-[7rem_1fr] sm:p-7">
            <div className="bg-wood-dark text-cream grid min-h-32 place-items-center rounded-2xl text-center shadow-inner">
              <div>
                <span className="block text-xs font-bold tracking-widest text-[#d8b673] uppercase">
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
              <div className="mt-5 flex items-center gap-2">
                {["M", "A", "K", "J"].map((initial, index) => (
                  <span
                    key={initial}
                    className={`border-surface text-cream grid size-8 place-items-center rounded-full border-2 text-[0.65rem] font-bold ${
                      index % 2 ? "bg-moss" : "bg-accent"
                    } ${index ? "-ml-3" : ""}`}
                  >
                    {initial}
                  </span>
                ))}
                <span className="text-muted ml-1 text-xs font-semibold">
                  4 osoby
                </span>
              </div>
            </div>
          </div>
        </Panel>

        <Panel className="leather-panel text-cream border-white/10 p-5 sm:p-6">
          <p className="text-xs font-bold tracking-[0.16em] text-[#dfbd7e] uppercase">
            Szybki rzut oka
          </p>
          <div className="mt-5 space-y-3">
            {[
              ["Ankieta do wypełnienia", "Weekend 18–19 lipca", "bg-accent"],
              ["Nowa gra na półce", "Kroniki Szczytu", "bg-moss"],
              ["Ostatnia partia", "Leśny Szlak · 82 min", "bg-gold"],
            ].map(([label, detail, color]) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/7 p-4"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="mt-0.5 truncate text-xs text-[#beae9d]">
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
