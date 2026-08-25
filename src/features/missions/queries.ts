import { after } from "next/server";
import type { createClient } from "@/lib/supabase/server";
import { isMissionActive } from "./formatting";
import { sortDashboardMissions } from "./mission-catalog";
import type { DashboardMission } from "./types";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const MISSION_SELECT =
  "id, mission_type, game_id, generated_at, expires_at, reward_amount, games ( title )";

/**
 * Odczyt Misji na Stół.
 *
 * Filtr `expires_at > now()` jest tu istotny: dzięki niemu poprawność WIDOKU
 * nie zależy od tego, czy zdążył się wykonać reconcile. Przeterminowana Misja
 * znika z karty od razu, a zmiana jej statusu w bazie może poczekać.
 */
export async function getDashboardMissions(
  supabase: SupabaseServerClient,
  userId: string,
  now = new Date(),
): Promise<DashboardMission[]> {
  const { data, error } = await supabase
    .from("user_missions")
    .select(MISSION_SELECT)
    .eq("user_id", userId)
    .eq("status", "active")
    .gt("expires_at", now.toISOString());

  if (error) {
    throw new Error("Nie udało się pobrać Misji.");
  }

  const missions = (data ?? []).flatMap<DashboardMission>((row) => {
    // Wszystkie cztery typy v1 są związane z grą (pilnuje tego CHECK
    // user_missions_game_scoped_types). Wiersz bez gry byłby przyszłą Misją
    // Spotkaniową, której Stół jeszcze nie umie narysować — pomijamy zamiast
    // udawać, że mamy tytuł.
    if (!row.game_id || !row.games) return [];

    return [
      {
        id: row.id,
        missionType: row.mission_type,
        gameId: row.game_id,
        gameTitle: row.games.title,
        generatedAt: row.generated_at,
        expiresAt: row.expires_at,
        rewardTukats: row.reward_amount,
      },
    ];
  });

  return sortDashboardMissions(
    missions.filter((mission) => isMissionActive(mission, now)),
  );
}

/**
 * Lekki reconcile Misji wołającego, uruchamiany PO wysłaniu odpowiedzi
 * (`next/server` `after`), a nie w trakcie renderu Stołu.
 *
 * Dlaczego to nie jest „ciężki write-on-read”:
 *   * render nigdy nie czeka na zapis — odczyt wyżej jest samowystarczalny,
 *   * operacja jest idempotentna, więc powtórzone wejścia na Stół nie mnożą
 *     ani Misji, ani wypłat,
 *   * zakres to wyłącznie własne Misje wołającego (RPC pracuje na auth.uid()),
 *   * koszt to jeden UPDATE wygaszający i jedno zapytanie o kandydatów.
 *
 * Główną ścieżką pozostaje generowanie event-driven: `recompute_play_rewards`
 * dopina reconcile do każdej mutacji partii. Tutaj chodzi o to, żeby zwolniony
 * przez wygaśnięcie slot nie czekał na najbliższą rozgrywkę. Świeżo utworzona
 * Misja pojawi się przy kolejnym wejściu na Stół — celowo bez `revalidatePath`,
 * które w tym miejscu tylko unieważniłoby właśnie policzony render.
 */
export function scheduleMissionReconcile(supabase: SupabaseServerClient) {
  after(async () => {
    const { error } = await supabase.rpc("recompute_current_user_missions");

    if (error) {
      console.error("Nie udało się przeliczyć Misji po renderze Stołu:", error);
    }
  });
}
