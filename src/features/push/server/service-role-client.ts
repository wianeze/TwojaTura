import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { PushDispatchError } from "../dispatch-errors.ts";

/**
 * Czwarty, celowo wąski klient Supabase — jedyne miejsce w aplikacji
 * używające SUPABASE_SERVICE_ROLE_KEY.
 *
 * Projekt trzyma się zasady „trzy klienty” (client / server / proxy) i ta
 * zasada nadal obowiązuje wszędzie indziej. Dispatcher jest wyjątkiem, bo
 * działa bez sesji użytkownika (uruchamia go cron albo `after()` już po
 * odpowiedzi) i musi odczytać materiał kryptograficzny cudzych subskrypcji,
 * czego żaden klient działający w imieniu użytkownika nie może zrobić.
 *
 * Dlatego:
 *   * plik jest oznaczony `server-only` — import z komponentu klienckiego
 *     wywali build, a nie wycieknie klucz do bundla,
 *   * klient nie utrwala ani nie odświeża sesji (nie ma czyjej),
 *   * jedyne funkcje, jakie przez niego wołamy, to claim_push_deliveries
 *     i complete_push_delivery, nadane wyłącznie roli service_role.
 *
 * URL bierzemy WPROST z NEXT_PUBLIC_SUPABASE_URL, a nie przez
 * `getServerSupabaseEnv()`. Tamta funkcja przepuszcza opcjonalny override
 * `SUPABASE_URL`, przewidziany do testów po LAN — ale klucz service_role jest
 * związany z konkretnym projektem, więc override mógłby wskazać dispatcher na
 * inny (albo lokalny) projekt niż ten, do którego pasuje klucz. Skutek jest
 * cichy: claim wykonuje się na pustej bazie i zwraca zero wierszy.
 * Para (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) jest tu
 * kontraktem — świadomie NIE używamy SUPABASE_SECRET_KEY.
 */
export type PushServiceRoleContext = {
  client: SupabaseClient<Database>;
  /** Ten sam URL, którego użył klient — do diagnostyki, nie do żądań. */
  supabaseUrl: string;
};

let cachedContext: PushServiceRoleContext | null = null;

export function getPushServiceRoleClient(): PushServiceRoleContext {
  if (cachedContext) return cachedContext;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Brak konfiguracji to osobny stan od nieudanego claimu: środowisko nie jest
  // gotowe, więc cron ma dostać 503, a nie 500 i nie „przetworzono 0”.
  if (!supabaseUrl || !serviceRoleKey) {
    throw new PushDispatchError(
      "push_dispatch_not_configured",
      "Dispatcher powiadomień push wymaga NEXT_PUBLIC_SUPABASE_URL i SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  cachedContext = {
    supabaseUrl,
    client: createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }),
  };

  return cachedContext;
}
