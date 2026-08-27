import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

/**
 * Kontrakt ramek walut.
 *
 * Wartości `border-image-slice` w globals.css zostały ZMIERZONE na konkretnych
 * plikach PNG — to piksele źródła, nie liczby dobrane na oko. Jeśli ktoś podmieni
 * asset na wersję o innych wymiarach albo innym rozkładzie ozdób, slice przestaje
 * pasować i ramka rozjedzie się bez żadnego błędu w konsoli. Ten plik jest
 * zabezpieczeniem właśnie na ten cichy przypadek.
 */
const REPO_ROOT = resolve(import.meta.dirname, "../..");

/** Wymiary, dla których policzono wszystkie slice'y. */
const FRAME_WIDTH = 2172;
const FRAME_HEIGHT = 724;

function readPngSize(relativePath: string) {
  const buffer = readFileSync(resolve(REPO_ROOT, relativePath));

  assert.equal(
    buffer.toString("ascii", 1, 4),
    "PNG",
    `${relativePath} nie jest plikiem PNG`,
  );

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const globalsCss = readFileSync(
  resolve(REPO_ROOT, "src/app/globals.css"),
  "utf8",
);

const currencyBarSource = readFileSync(
  resolve(REPO_ROOT, "src/components/ui/player-currency-bar.tsx"),
  "utf8",
);

function readSlice(variant: "renown" | "tukats") {
  const rule = globalsCss.match(
    new RegExp(`\\.currency-frame--${variant}\\s*\\{([\\s\\S]*?)\\}`),
  )?.[1];

  assert.ok(rule, `brak reguły .currency-frame--${variant} w globals.css`);

  const slice = rule.match(/border-image-slice:\s*([^;]+);/)?.[1]?.trim();
  assert.ok(slice, `brak border-image-slice dla ${variant}`);

  const numbers = slice
    .split(/\s+/)
    .filter((part) => /^\d+$/.test(part))
    .map(Number);

  assert.equal(numbers.length, 4, `slice ${variant} musi mieć cztery liczby`);

  const [top, right, bottom, left] = numbers as [
    number,
    number,
    number,
    number,
  ];

  return { top, right, bottom, left, hasFill: /\bfill\b/.test(slice), rule };
}

test("oba assety mają wymiary, dla których policzono slice'y", () => {
  for (const path of [
    "public/assets/Renoma-frame.png",
    "public/assets/Tukaty-frame.png",
  ]) {
    assert.deepEqual(
      readPngSize(path),
      { width: FRAME_WIDTH, height: FRAME_HEIGHT },
      `${path} zmienił wymiary — przelicz border-image-slice w globals.css`,
    );
  }
});

test("slice'y mieszczą się w źródle i zostawiają rozciągliwy środek", () => {
  for (const variant of ["renown", "tukats"] as const) {
    const { top, right, bottom, left } = readSlice(variant);

    assert.ok(
      top + bottom < FRAME_HEIGHT,
      `${variant}: górny i dolny slice zjadają całą wysokość`,
    );
    assert.ok(
      left + right < FRAME_WIDTH,
      `${variant}: lewa i prawa ozdoba zjadają całą szerokość`,
    );
  }
});

test("Renoma ma środek przezroczysty, Tukaty wypełniony", () => {
  // To nie kosmetyka: asset Renomy ma między listwami dziurę, więc `fill`
  // niczego by tam nie namalował. Asset Tukatów ma brązową płytkę i bez `fill`
  // liczba wisiałaby w pustce.
  assert.equal(readSlice("renown").hasFill, false);
  assert.equal(readSlice("tukats").hasFill, true);
});

test("każda ozdoba dostaje grubość ramki proporcjonalną do swojego slice'u", () => {
  // Dopóki border-width to slice/724 × wysokość, rogi renderują się w skali 1:1
  // i rozciąga się wyłącznie środek listwy. Każda inna wartość deformuje puchar,
  // tarczę albo monety.
  for (const variant of ["renown", "tukats"] as const) {
    const { top, right, bottom, left, rule } = readSlice(variant);
    const widths = [...rule.matchAll(/calc\((\d+)\s*\/\s*724\s*\*/g)].map(
      (match) => Number(match[1]),
    );

    assert.deepEqual(
      widths,
      [top, right, bottom, left],
      `${variant}: border-width nie odpowiada border-image-slice`,
    );
  }
});

test("wysokość ramki jest przekazywana przez zmienną z fallbackiem", () => {
  // Deklaracja `--currency-frame-h` bezpośrednio na .currency-frame wygrywałaby
  // z wartością dziedziczoną i wariant rozmiaru dałoby się ustawić już tylko
  // stylem inline.
  const base = globalsCss.match(/\.currency-frame\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.ok(
    /height:\s*var\(--currency-frame-h,/.test(base),
    "wysokość musi czytać zmienną z fallbackiem",
  );
  assert.ok(
    !/^\s*--currency-frame-h:/m.test(base),
    ".currency-frame nie może deklarować własnej --currency-frame-h",
  );
  assert.ok(
    /box-sizing:\s*border-box/.test(base),
    "wysokość ma obejmować ramkę (border-box)",
  );
});

test("Renoma i Tukaty nie są pomylone w komponencie", () => {
  const counters = [
    ...currencyBarSource.matchAll(
      /\{\s*variant:\s*"(renown|tukats)",\s*label:\s*"([^"]+)"\s*\}/g,
    ),
  ].map((match) => [match[1], match[2]]);

  assert.deepEqual(
    counters,
    [
      ["renown", "Renoma"],
      ["tukats", "Tukaty"],
    ],
    "wariant i nazwa waluty muszą się zgadzać — i Renoma musi być pierwsza",
  );
});

test("rama i etykieta czytają wariant oraz saldo, a nie stałe teksty", () => {
  // Interpolacje w template literals łatwo zgubić przy masowej edycji — bez
  // ${variant} wszystkie ramy renderują się tym samym assetem, a bez ${label}
  // czytnik ekranu dostaje „: 1234" zamiast nazwy waluty.
  assert.match(
    currencyBarSource,
    /className=\{`currency-frame currency-frame--\$\{variant\}`\}/,
  );
  assert.match(
    currencyBarSource,
    /aria-label=\{`\$\{label\}: \$\{formatted\}`\}/,
  );
});

test("saldo trafia do właściwej ramki", () => {
  // Mapa amounts jest jedynym miejscem, gdzie liczba spotyka wariant. Zamiana
  // tych dwóch linii podmieniłaby waluty miejscami bez żadnego błędu typów.
  const amounts = currencyBarSource.match(
    /const amounts:[\s\S]*?=\s*\{([\s\S]*?)\};/,
  )?.[1];

  assert.ok(amounts, "brak mapy amounts w komponencie");
  assert.match(amounts, /\brenown\b/);
  assert.match(amounts, /\btukats\b/);
});

test("nazwy walut pokazują się w układzie telefonu", () => {
  // „header” to nagłówek telefonu — tam nazwa NAD ramą jest wymaganiem
  // produktowym, a nie ozdobą. Sidebar desktopu zostaje bez nazw.
  assert.match(currencyBarSource, /showLabel=\{size === "header"\}/);
});

test("nazwa waluty stoi nad ramą, nie w jej wnętrzu", () => {
  // Wnętrze ramy ma ~42% jej wysokości. Wepchnięcie tam podpisu obok liczby
  // zabierało szerokość i wymuszało mniejszą ramę — dlatego etykieta jest
  // rodzeństwem ramy, a nie jej dzieckiem.
  const labelRule =
    globalsCss.match(/\.currency-frame__label\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.match(labelRule, /text-transform:\s*uppercase/);
  assert.match(labelRule, /white-space:\s*nowrap/);
  assert.match(currencyBarSource, /\{frame\}/);
});

test("liczba nigdy nie łamie się na dwie linie", () => {
  const valueRule =
    globalsCss.match(/\.currency-frame__value\s*\{([\s\S]*?)\}/)?.[1] ?? "";

  assert.ok(/white-space:\s*nowrap/.test(valueRule));
  assert.ok(
    /font-variant-numeric:\s*tabular-nums/.test(valueRule),
    "stała szerokość cyfr trzyma sąsiada w miejscu przy zmianie salda",
  );
});
