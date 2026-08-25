/**
 * Klient Supabase dla LOKALNYCH NARZĘDZI OPERATORSKICH.
 *
 * Skrypty backfillu uruchamia administrator ze swojej maszyny, poza sesją
 * użytkownika i poza RLS — muszą więc mieć klucz `service_role`. Klucz
 * publishable/anon nie ma prawa odczytu `public.games` i kończy się mylącym
 * „permission denied for table games” zamiast czytelnego błędu konfiguracji.
 *
 * DLACZEGO NIE getPushServiceRoleClient(). Tamten helper jest oznaczony
 * `server-only` (import z gołego Node'a rzuca wyjątkiem), rzuca
 * PushDispatchError i cache'uje kontekst pod dispatcher powiadomień. Ten plik
 * to jego odpowiednik dla CLI — świadomie osobny, ale trzymający tę samą
 * zasadę: service_role żyje wyłącznie tam, gdzie nie ma czyjej sesji.
 *
 * BEZPIECZEŃSTWO. Wartość klucza nie jest nigdzie logowana ani zwracana w
 * komunikatach błędów — na zewnątrz wychodzi tylko etykieta rodzaju klucza
 * (`describeKeyKind`). Sekrety wczytuje `--env-file-if-exists=.env.local`,
 * a `.gitignore` wyklucza `.env*` poza `.env.example`.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database.generated.ts";

export type OperatorSupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  /** Nazwa zmiennej, z której wzięto URL — do wypisania w logu. */
  urlSource: "SUPABASE_URL" | "NEXT_PUBLIC_SUPABASE_URL";
  /** Rodzaj klucza BEZ jego wartości, np. „service_role (JWT)”. */
  keyKind: string;
};

type EnvLike = Record<string, string | undefined>;

function decodeJwtRole(key: string): string | null {
  const segments = key.split(".");
  if (segments.length !== 3) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(segments[1] ?? "", "base64url").toString("utf8"),
    ) as { role?: unknown };

    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

/**
 * Rodzaj klucza — nigdy jego wartość.
 *
 * Akceptujemy oba formaty, które faktycznie omijają RLS: starsze JWT
 * `service_role` i nowe klucze sekretne `sb_secret_...`. Odrzucamy wszystko,
 * co jest kluczem publicznym, bo to właśnie ono daje „permission denied”.
 */
export function describeKeyKind(
  key: string,
): { ok: true; kind: string } | { ok: false; kind: string; message: string } {
  if (key.startsWith("sb_secret_")) {
    return { ok: true, kind: "sb_secret_… (Supabase secret key)" };
  }

  if (key.startsWith("sb_publishable_")) {
    return {
      ok: false,
      kind: "sb_publishable_… (klucz publiczny)",
      message:
        "SUPABASE_SERVICE_ROLE_KEY zawiera klucz PUBLISHABLE. Klucz publiczny działa pod RLS i nie ma prawa odczytu public.games — podstaw klucz service_role albo sb_secret_… z Supabase → Project Settings → API.",
    };
  }

  const role = decodeJwtRole(key);

  if (role === "service_role") {
    return { ok: true, kind: "service_role (JWT)" };
  }

  if (role === "anon") {
    return {
      ok: false,
      kind: "anon (JWT)",
      message:
        "SUPABASE_SERVICE_ROLE_KEY zawiera klucz ANON. Anon działa pod RLS i nie ma prawa odczytu public.games — podstaw klucz service_role z Supabase → Project Settings → API.",
    };
  }

  if (role) {
    return {
      ok: false,
      kind: `${role} (JWT)`,
      message: `SUPABASE_SERVICE_ROLE_KEY zawiera JWT o roli „${role}”, a wymagany jest service_role.`,
    };
  }

  return {
    ok: false,
    kind: "nierozpoznany",
    message:
      "SUPABASE_SERVICE_ROLE_KEY ma nierozpoznany format. Oczekiwany jest JWT service_role albo klucz sb_secret_… .",
  };
}

export function readOperatorSupabaseConfig(
  env: EnvLike = process.env,
): OperatorSupabaseConfig {
  // SUPABASE_URL ma pierwszeństwo: operator celuje narzędziem w konkretny
  // projekt, a NEXT_PUBLIC_SUPABASE_URL bywa ustawiony na lokalny Supabase.
  const explicitUrl = env.SUPABASE_URL?.trim();
  const publicUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const url = explicitUrl || publicUrl;
  const urlSource = explicitUrl ? "SUPABASE_URL" : "NEXT_PUBLIC_SUPABASE_URL";

  if (!url) {
    throw new Error(
      "Brakuje adresu Supabase. Ustaw SUPABASE_URL (zalecane dla narzędzi operatorskich) albo NEXT_PUBLIC_SUPABASE_URL.",
    );
  }

  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!serviceRoleKey) {
    throw new Error(
      [
        "Brakuje SUPABASE_SERVICE_ROLE_KEY.",
        "To narzędzie operatorskie działa poza sesją użytkownika, więc wymaga klucza service_role — klucz publishable/anon dostanie „permission denied for table games”.",
        "Uzupełnij zmienną w .env.local (plik jest w .gitignore) albo podaj ją w środowisku wywołania.",
      ].join(" "),
    );
  }

  const keyCheck = describeKeyKind(serviceRoleKey);

  if (!keyCheck.ok) {
    throw new Error(keyCheck.message);
  }

  return { url, serviceRoleKey, urlSource, keyKind: keyCheck.kind };
}

export function createOperatorSupabaseClient(
  config: OperatorSupabaseConfig,
): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/** Log konfiguracji BEZ sekretu — sam adres i rodzaj klucza. */
export function describeOperatorConnection(config: OperatorSupabaseConfig) {
  return `Supabase: ${config.url} (z ${config.urlSource}), klucz: ${config.keyKind}`;
}
