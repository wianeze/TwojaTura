import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { getServerSupabaseEnv } from "@/lib/supabase/env";

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
 */
let cachedClient: SupabaseClient<Database> | null = null;

export function getPushServiceRoleClient(): SupabaseClient<Database> {
  if (cachedClient) return cachedClient;

  const { url } = getServerSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "Brakuje SUPABASE_SERVICE_ROLE_KEY wymaganego przez dispatcher powiadomień push.",
    );
  }

  cachedClient = createClient<Database>(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  return cachedClient;
}
