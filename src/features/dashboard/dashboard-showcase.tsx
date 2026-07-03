import Link from "next/link";
import { LogoMark } from "@/components/ui/logo-mark";
import { Panel } from "@/components/ui/panel";

const circleCards = [
  {
    label: "Najbliższy wieczór",
    value: "Sobota · 18:00",
    note: "Górska Chata u Michała",
    accent: "bg-[#f5e4ca] text-[#855727]",
  },
  {
    label: "Ankieta dostępności",
    value: "4 z 6 osób",
    note: "Dwie odpowiedzi jeszcze czekają",
    accent: "bg-moss-soft text-moss",
  },
  {
    label: "Propozycje na stół",
    value: "3 gry",
    note: "Ostatnia Latarnia prowadzi",
    accent: "bg-accent-soft text-accent",
  },
];

export function DashboardShowcase() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <section className="wood-grain fire-glow text-cream relative isolate overflow-hidden rounded-[2.25rem] border border-white/10 px-5 py-8 sm:px-9 sm:py-10 lg:grid lg:min-h-[32rem] lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:gap-8 lg:px-12">
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

        <div>
          <span className="inline-flex rounded-full border border-[#e9c481]/25 bg-[#e9c481]/10 px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.2em] text-[#ebc985] uppercase">
            Planszówkowy Krąg
          </span>
          <p className="font-display mt-6 text-4xl leading-[1.08] font-semibold tracking-tight sm:text-5xl xl:text-6xl">
            Zbierz ekipę.
            <br />
            Wybierz grę.
            <span className="mt-1 block text-[#efb65c]">Twoja tura.</span>
          </p>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#d7c8b7] sm:text-lg">
            Jedno ciepłe miejsce dla wspólnej kolekcji, planów na wieczór i
            historii partii, do których chce się wracać.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/moja-polka"
              className="bg-gold text-wood-dark rounded-xl px-4 py-3 text-sm font-bold shadow-lg transition-transform hover:-translate-y-0.5"
            >
              Otwórz moją półkę
            </Link>
            <Link
              href="/spotkania"
              className="text-cream rounded-xl border border-white/15 bg-white/7 px-4 py-3 text-sm font-bold transition-colors hover:bg-white/12"
            >
              Zobacz spotkania
            </Link>
          </div>
        </div>

        <div className="mt-10 flex justify-center lg:mt-0">
          <div className="relative">
            <div className="bg-ember/25 absolute inset-10 rounded-full blur-3xl" />
            <LogoMark variant="hero" tone="light" />
          </div>
        </div>
      </section>

      <section
        className="grid gap-4 md:grid-cols-3"
        aria-label="Planszówkowy Krąg"
      >
        {circleCards.map((card) => (
          <Panel key={card.label} className="paper-wash p-5 sm:p-6">
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
        <Panel className="overflow-hidden">
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

        <Panel className="paper-wash p-5 sm:p-6">
          <p className="text-wood text-xs font-bold tracking-[0.16em] uppercase">
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
                className="border-border/70 bg-surface/75 flex items-center gap-3 rounded-2xl border p-4"
              >
                <span className={`size-2.5 shrink-0 rounded-full ${color}`} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{label}</p>
                  <p className="text-muted mt-0.5 truncate text-xs">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>
    </div>
  );
}
