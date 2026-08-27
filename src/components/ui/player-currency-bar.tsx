/**
 * Salda gracza — Renoma i Tukaty.
 *
 * DWIE WALUTY, DWIE ROLE. Renoma to prestiż: zdobywana, nigdy niewydawana,
 * liczona z point_events. Tukaty to waluta Misji, przyszłościowo wydawalna,
 * liczona z tukat_balances. Nie mieszamy ich — dlatego mają osobne ramy, osobne
 * etykiety i osobne źródła danych.
 *
 * DWA WEJŚCIA:
 *
 *   PlayerCurrencyCounter — JEDNA rama. Nagłówek telefonu rozdziela waluty na
 *                           przeciwne końce paska (Renoma z lewej, Tukaty z
 *                           prawej, emblemat klasy między nimi), więc nie może
 *                           renderować obu jednym blokiem.
 *   PlayerCurrencyBar     — obie ramy obok siebie. Używa tego sidebar desktopu,
 *                           gdzie stoją razem tuż nad kartą gracza.
 */
type CurrencyVariant = "renown" | "tukats";

type CurrencySize = "header" | "sidebar";

/*
  Wysokość ramy. Cała geometria 9-slice liczy się z tej jednej liczby, więc
  rozmiar to dosłownie jedna zmienna, a nie zestaw ręcznie dobranych paddingów.

  „header” jest związany z szerokością ekranu, nie z wysokością paska: obie ramy
  stoją w JEDNYM rzędzie, więc to szerokość jest zasobem deficytowym. Przy 360px
  muszą się w nim zmieścić logo, obie ramy, sekcja klasy i portret gracza.
  Wyprowadzenie nazwy waluty NAD ramę zwolniło tyle szerokości, że sama rama
  mogła urosnąć — liczba w środku ma teraz całe wnętrze dla siebie.
*/
const FRAME_HEIGHT: Record<CurrencySize, string> = {
  header: "clamp(2.4rem, 10.8vw, 2.9rem)",
  sidebar: "2.5rem",
};

type CounterCopy = {
  variant: CurrencyVariant;
  /** Nazwa waluty — nagłówek nad ramą, nazwa dostępnościowa i tooltip. */
  label: string;
};

const COUNTERS: readonly CounterCopy[] = [
  { variant: "renown", label: "Renoma" },
  { variant: "tukats", label: "Tukaty" },
] as const;

const COPY_BY_VARIANT: Record<CurrencyVariant, CounterCopy> = {
  renown: COUNTERS[0]!,
  tukats: COUNTERS[1]!,
};

function CurrencyFrame({
  variant,
  label,
  amount,
  showLabel,
}: CounterCopy & { amount: number; showLabel: boolean }) {
  const formatted = amount.toLocaleString("pl-PL");

  const frame = (
    <span
      className={`currency-frame currency-frame--${variant}`}
      title={`${label}: ${formatted}`}
      role="img"
      aria-label={`${label}: ${formatted}`}
    >
      <span
        aria-hidden="true"
        className="currency-frame__content flex items-baseline justify-center"
      >
        <span className="currency-frame__value font-display font-semibold text-[#fff1dc] drop-shadow-[0_1px_2px_rgba(24,10,4,0.7)]">
          {formatted}
        </span>
      </span>
    </span>
  );

  if (!showLabel) return frame;

  return (
    <span className="flex flex-col items-center gap-[0.1rem]">
      <span aria-hidden="true" className="currency-frame__label font-display">
        {label}
      </span>
      {frame}
    </span>
  );
}

/** Pojedyncza rama waluty — dla układów, które rozdzielają Renomę od Tukatów. */
export function PlayerCurrencyCounter({
  variant,
  amount,
  size = "header",
  className = "",
}: {
  variant: CurrencyVariant;
  amount: number;
  size?: CurrencySize;
  className?: string;
}) {
  return (
    <span
      style={
        { "--currency-frame-h": FRAME_HEIGHT[size] } as React.CSSProperties
      }
      className={`inline-flex shrink-0 ${className}`}
    >
      <CurrencyFrame
        {...COPY_BY_VARIANT[variant]}
        amount={amount}
        showLabel={size === "header"}
      />
    </span>
  );
}

/** Obie ramy obok siebie — sidebar desktopu. */
export function PlayerCurrencyBar({
  renown,
  tukats,
  size = "sidebar",
  className = "",
}: {
  renown: number;
  /** Saldo z tukat_balances. Brak wpisów w ledgerze to po prostu 0. */
  tukats: number;
  size?: CurrencySize;
  className?: string;
}) {
  const amounts: Record<CurrencyVariant, number> = { renown, tukats };

  return (
    <div
      style={
        { "--currency-frame-h": FRAME_HEIGHT[size] } as React.CSSProperties
      }
      className={`currency-bar currency-bar--${size} flex min-w-0 shrink-0 flex-row items-center gap-1.5 ${className}`}
    >
      {COUNTERS.map((counter) => (
        <CurrencyFrame
          key={counter.variant}
          {...counter}
          amount={amounts[counter.variant]}
          showLabel={size === "header"}
        />
      ))}
    </div>
  );
}
