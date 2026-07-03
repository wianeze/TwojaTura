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
    note: "Ostatnia Latarnia prowadzi",
    accent: "text-accent",
    surface: "-rotate-[0.2deg]",
    tape: "bg-[#bd7451]/45",
  },
];

function GameNightStillLife() {
  return (
    <div
      className="relative h-[25rem] w-full max-w-[31rem] [perspective:900px]"
      aria-hidden="true"
    >
      <div className="absolute top-5 right-2 size-72 rounded-full bg-[#e97b3f]/16 blur-[70px]" />
      <div className="absolute top-20 right-12 size-36 rounded-full bg-[#ffc568]/14 blur-[42px]" />

      <div className="absolute inset-x-5 bottom-2 h-60 [transform:rotateX(54deg)] rounded-[48%_52%_18%_18%] border border-[#b77a51]/24 bg-[linear-gradient(155deg,#80523c_0%,#4a2e24_52%,#261815_100%)] shadow-[0_36px_70px_rgba(10,5,3,0.62),inset_0_2px_0_rgba(255,225,185,0.14)]">
        <div className="absolute inset-0 rounded-[inherit] bg-[repeating-linear-gradient(4deg,transparent_0_30px,rgba(255,229,196,0.025)_31px_33px)]" />
      </div>

      <div className="absolute top-25 left-22 h-42 w-42 -rotate-7 [transform:rotateX(42deg)_rotateZ(-8deg)] rounded-lg border-[6px] border-[#8c5a3d] bg-[#334b3d] shadow-[12px_18px_35px_rgba(8,4,3,0.62),inset_0_0_28px_rgba(13,28,20,0.65)]">
        <span className="absolute inset-4 rounded-sm border border-[#d0bd8d]/25" />
        <span className="absolute top-[32%] left-[18%] size-5 rounded-full border border-[#d5bd82]/45 bg-[#8d4c38] shadow-lg" />
        <span className="absolute right-[22%] bottom-[25%] size-4 rounded-full border border-[#d5bd82]/45 bg-[#c08a48] shadow-lg" />
        <span className="absolute top-[47%] left-[48%] size-3 rounded-full bg-[#75906f] shadow-lg" />
        <span className="absolute inset-x-8 top-1/2 h-px rotate-12 bg-[#d8c792]/20" />
        <span className="absolute inset-y-7 left-1/2 w-px -rotate-8 bg-[#d8c792]/20" />
      </div>

      <div className="absolute right-7 bottom-23 h-27 w-18 rotate-12 rounded-md border border-[#d8bb87]/40 bg-[#e8d8b8] shadow-[8px_12px_24px_rgba(10,5,3,0.55)]">
        <span className="absolute inset-2 rounded-sm border border-[#9e5d47]/45" />
        <span className="absolute top-4 left-1/2 h-13 w-px -translate-x-1/2 rotate-35 bg-[#9e5d47]/35" />
      </div>
      <div className="absolute right-19 bottom-18 h-25 w-17 -rotate-6 rounded-md border border-[#d8bb87]/35 bg-[#c78a58] shadow-[7px_10px_20px_rgba(10,5,3,0.48)]" />

      <div className="absolute bottom-27 left-9 size-10 rotate-12 rounded-xl border border-[#f0d4a0]/50 bg-[#dfc08a] shadow-[6px_10px_18px_rgba(10,5,3,0.52),inset_-3px_-4px_8px_rgba(94,48,27,0.28)]">
        {[
          "top-2 left-2",
          "top-2 right-2",
          "bottom-2 left-2",
          "bottom-2 right-2",
        ].map((position) => (
          <span
            key={position}
            className={`absolute size-1.5 rounded-full bg-[#5b3427] ${position}`}
          />
        ))}
      </div>

      {[
        ["left-20 bottom-18", "bg-[#a9563d]"],
        ["left-36 bottom-14", "bg-[#657a60]"],
        ["right-34 bottom-12", "bg-[#c1914c]"],
      ].map(([position, color]) => (
        <span key={position} className={`absolute ${position}`}>
          <span
            className={`block size-5 rounded-full ${color} shadow-[0_7px_14px_rgba(8,4,3,0.55)]`}
          />
          <span
            className={`mx-auto -mt-1 block h-8 w-7 rounded-[45%_45%_35%_35%] ${color} shadow-[0_8px_14px_rgba(8,4,3,0.45)]`}
          />
        </span>
      ))}

      <span className="bg-moss absolute right-5 bottom-10 size-7 rounded-full border border-[#edcf8d]/35 shadow-[0_9px_20px_rgba(8,4,3,0.58)]" />
      <span className="bg-accent absolute right-14 bottom-8 size-6 rounded-full border border-[#edcf8d]/35 shadow-[0_9px_20px_rgba(8,4,3,0.58)]" />
    </div>
  );
}

export function DashboardShowcase() {
  return (
    <div className="space-y-7 sm:space-y-9">
      <section className="text-cream relative isolate overflow-hidden rounded-[2.4rem] border border-[#c99768]/16 bg-[linear-gradient(125deg,rgba(25,15,13,0.98),rgba(71,43,32,0.96)_52%,rgba(30,18,16,0.98))] px-5 py-8 shadow-[0_38px_100px_rgba(12,6,4,0.52),inset_0_1px_0_rgba(255,226,188,0.08)] sm:px-9 sm:py-10 lg:grid lg:min-h-[32rem] lg:grid-cols-[1.06fr_0.94fr] lg:items-center lg:gap-4 lg:px-12">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_52%,rgba(228,105,46,0.22),transparent_30%),radial-gradient(circle_at_55%_0,rgba(231,170,93,0.09),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 -z-10 [background-image:repeating-linear-gradient(90deg,transparent_0_92px,rgba(255,230,200,0.022)_93px_95px)] opacity-40" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#d8ab72]/20 bg-black/16 px-3 py-1.5 text-[0.63rem] font-bold tracking-[0.2em] text-[#d7ad74] uppercase backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-[#d78548] shadow-[0_0_12px_rgba(240,137,61,0.9)]" />
            Krąg Graczy · wieczór trwa
          </span>
          <h1 className="font-display mt-6 text-4xl leading-[1.07] font-semibold tracking-tight text-[#f3e7d4] drop-shadow-[0_4px_22px_rgba(0,0,0,0.38)] sm:text-5xl xl:text-6xl">
            Zbierz ekipę.
            <br />
            Wybierz grę.
            <span className="mt-1 block text-[#d99455]">Twoja tura.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-[#cdbdad] sm:text-lg">
            Jedno ciepłe miejsce dla wspólnej kolekcji, planów na wieczór i
            historii partii, do których chce się wracać.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/moja-polka"
              className="rounded-xl border border-[#e5b67a]/35 bg-[#a95f3d] px-4 py-3 text-sm font-bold text-[#fff1dc] shadow-[0_12px_26px_rgba(35,13,7,0.35)] transition-transform hover:-translate-y-0.5 hover:bg-[#b86b45]"
            >
              Otwórz Półkę Gier
            </Link>
            <Link
              href="/spotkania"
              className="rounded-xl border border-white/12 bg-white/6 px-4 py-3 text-sm font-bold text-[#e4d6c6] backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Usiądź Przy Stole
            </Link>
          </div>
        </div>

        <div className="relative hidden items-center justify-center lg:flex">
          <GameNightStillLife />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16 border-t border-[#b37950]/18 bg-[linear-gradient(180deg,rgba(111,68,48,0.55),rgba(38,23,19,0.82))] shadow-[0_-22px_45px_rgba(8,4,3,0.2)] lg:hidden"
        >
          <span className="absolute top-4 left-[15%] size-5 rotate-12 rounded-md border border-[#f1d29a]/35 bg-[#d9ba85] shadow-lg" />
          <span className="bg-moss absolute top-5 left-[43%] size-4 rounded-full shadow-lg" />
          <span className="absolute top-3 right-[20%] h-7 w-11 -rotate-6 rounded-sm bg-[#e4d5ba] shadow-lg" />
        </div>
      </section>

      <section
        className="leather-panel relative grid gap-5 rounded-[2rem] border border-white/8 p-4 sm:p-6 md:grid-cols-3"
        aria-label="Krąg Graczy"
      >
        <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-[radial-gradient(circle_at_85%_20%,rgba(223,106,53,0.12),transparent_22rem)]" />
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
            <div className="bg-wood-dark text-cream grid min-h-32 place-items-center rounded-2xl text-center shadow-[0_14px_28px_rgba(42,23,16,0.25),inset_0_1px_0_rgba(255,255,255,0.08)]">
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
              <div className="mt-5 flex items-center gap-2">
                {["M", "A", "K", "J"].map((initial, index) => (
                  <span
                    key={initial}
                    className={`border-surface text-cream grid size-8 place-items-center rounded-[55%_55%_42%_42%] border-2 text-[0.65rem] font-bold ${index % 2 ? "bg-moss" : "bg-wood"} ${index ? "-ml-3" : ""}`}
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

        <Panel className="text-cream border-white/8 bg-[linear-gradient(145deg,rgba(58,36,29,0.96),rgba(32,21,18,0.98))] p-5 sm:p-6">
          <p className="text-xs font-bold tracking-[0.16em] text-[#cba36d] uppercase">
            Na drewnianym blacie
          </p>
          <div className="mt-5 space-y-3">
            {[
              ["Ankieta do wypełnienia", "Weekend 18–19 lipca", "bg-accent"],
              ["Nowa gra na półce", "Kroniki Szczytu", "bg-moss"],
              ["Ostatnia partia", "Leśny Szlak · 82 min", "bg-[#b9864d]"],
            ].map(([label, detail, color], index) => (
              <div
                key={label}
                className={`flex items-center gap-3 rounded-xl border border-white/8 bg-white/6 p-4 shadow-[0_10px_24px_rgba(0,0,0,0.14)] ${index % 2 ? "ml-2" : "mr-2"}`}
              >
                <span
                  className={`size-2.5 shrink-0 rounded-full ${color} shadow-[0_0_12px_currentColor]`}
                />
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
