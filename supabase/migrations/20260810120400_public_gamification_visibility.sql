-- Rozdzielenie „kto zdobywa” od „kogo widać” (korekta po Economy V2).
--
-- MIGRACJA FORWARD-ONLY. Migracje 20260810120000-120300 są już zastosowane na
-- produkcji, więc poprawka nie może polegać na edycji 120300 — trafia tu.
--
-- ===========================================================================
-- PROBLEM
-- ===========================================================================
--
-- 20260810120300 słusznie przestało wykluczać admina z grywalizacji: rola jest
-- przełącznikiem uprawnień, a nie oznaczeniem konta technicznego, więc gracz z
-- uprawnieniami dalej zdobywa Renomę i odznaki. Przy okazji jednak ten sam
-- predykat trafił do public.get_leaderboard i public.get_public_player_
-- profiles — a to sklejenie dwóch różnych pytań w jedno:
--
--   „czy to konto ROBI progres?”      -> admin: TAK
--   „czy to konto POKAZUJEMY innym?”  -> admin: NIE
--
-- Efekt: konto administracyjne, dotąd konsekwentnie ukryte w listach członków,
-- zaczęło się pojawiać w publicznych zestawieniach Legendarium.
--
-- ===========================================================================
-- ROZWIĄZANIE
-- ===========================================================================
--
--   private.is_gamification_eligible(user_id)      — bez zmian (progres)
--   private.is_public_gamification_visible(user_id) — nowy (widoczność)
--
-- Drugi predykat jest ZBUDOWANY z pierwszego, a nie napisany od nowa: kto nie
-- zdobywa, ten tym bardziej nie jest pokazywany. Jedyna różnica to rola
-- administratora. Dzięki temu warunek nie jest powielony po RPC i nie da się
-- ich rozjechać.
--
-- CZEGO TA MIGRACJA NIE RUSZA: cennika, przyznawania Renomy i odznak, planu
-- Economy V2, preview/APPLY, sald, public.point_events ani żadnej reguły
-- ekonomii. Admin dalej zdobywa i dalej ma pełną historię w księdze — po
-- prostu jego wiersz nie trafia do cudzych widoków.

-- ---------------------------------------------------------------------------
-- 1. Predykat widoczności publicznej
-- ---------------------------------------------------------------------------

create or replace function private.is_public_gamification_visible(
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_gamification_eligible($1) and not private.is_admin($1);
$$;

comment on function private.is_public_gamification_visible(uuid) is
  'Czy konto pokazujemy INNYM w publicznych zestawieniach (leaderboard, publiczne elementy Legendarium, publiczne projekcje gracza). Nadbudowa nad private.is_gamification_eligible: kto nie zdobywa Renomy, ten tym bardziej nie jest pokazywany, a dodatkowo ukrywamy rolę administratora. Admin NADAL zdobywa Renomę i odznaki — to wyłącznie widoczność. Nie dotyczy własnych danych: każdy widzi siebie.';

revoke all on function private.is_public_gamification_visible(uuid)
  from public, anon;

-- GRANT dla `authenticated` jest tu KONIECZNY, w odróżnieniu od
-- private.is_gamification_eligible, które zostaje odebrane. Powód: ten predykat
-- jest używany w polityce RLS (sekcja 4), a polityki wykonują się z
-- uprawnieniami roli WOŁAJĄCEJ, nie właściciela. Bez grantu każdy odczyt
-- public.user_achievements przez zwykłego członka kończyłby się błędem
-- „permission denied for function”. Ten sam wzorzec co private.is_active_member,
-- private.is_observer i private.is_visible_member (20260708000200).
grant execute on function private.is_public_gamification_visible(uuid)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Leaderboard
-- ---------------------------------------------------------------------------

-- Ciało przepisane z 20260810120300. Zmienia się WYŁĄCZNIE predykat
-- kwalifikacji wiersza: sortowanie (rank po total_points desc, display_name,
-- user_id), sposób liczenia Renomy i kształt wyniku zostają bez zmian.
--
-- Admin zachowuje saldo i dalej je zdobywa — po prostu nie rankuje.
create or replace function public.get_leaderboard()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  total_points bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with balances as (
    select
      profiles.id as user_id,
      profiles.display_name,
      profiles.avatar_url,
      coalesce(sum(events.points), 0)::bigint as total_points
    from public.app_members as membership
    join public.profiles as profiles
      on profiles.id = membership.user_id
    left join public.point_events as events
      on events.user_id = membership.user_id
    where private.is_active_member(auth.uid())
      and private.is_public_gamification_visible(membership.user_id)
    group by profiles.id, profiles.display_name, profiles.avatar_url
  ), ranked as (
    select
      balances.user_id,
      balances.display_name,
      balances.avatar_url,
      balances.total_points,
      rank() over (
        order by balances.total_points desc, balances.display_name, balances.user_id
      )::bigint as leaderboard_rank
    from balances
  )
  select
    ranked.user_id,
    ranked.display_name,
    ranked.avatar_url,
    ranked.total_points,
    ranked.leaderboard_rank as rank
  from ranked
  order by ranked.leaderboard_rank, ranked.display_name, ranked.user_id;
$$;

comment on function public.get_leaderboard() is
  'Ranking Renomy. Widoczność wiersza pochodzi z private.is_public_gamification_visible: aktywny member tak, aktywny admin nie (zdobywa, ale nie jest pokazywany), obserwator i konto nieaktywne nie.';

revoke all on function public.get_leaderboard() from public, anon, authenticated;
grant execute on function public.get_leaderboard() to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Publiczna projekcja profilu gracza
-- ---------------------------------------------------------------------------

-- Ta sama zmiana predykatu. Człon `profiles.id = auth.uid()` zostaje i jest
-- tu kluczowy: admin musi nadal widzieć WŁASNE dane (klasa postaci, ramka
-- portretu) na swoim Profilu i w swoim Legendarium. Ukrywamy go przed innymi,
-- nie przed samym sobą.
--
-- Lista kolumn bez zmian — email i pola administracyjne pozostają poza
-- zasięgiem tej funkcji.
create or replace function public.get_public_player_profiles()
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  active_class_key text,
  active_portrait_frame_key text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    profiles.id,
    profiles.display_name,
    profiles.avatar_url,
    profiles.active_class_key,
    profiles.active_portrait_frame_key
  from public.profiles as profiles
  where private.is_active_member(auth.uid())
    and (
      private.is_public_gamification_visible(profiles.id)
      or profiles.id = auth.uid()
    );
$$;

comment on function public.get_public_player_profiles() is
  'Publiczna projekcja profilu gracza dla rankingu i Legendarium: nazwa, awatar, klasa postaci, ramka portretu. Jawna lista kolumn — email i pola administracyjne nie są tu osiągalne. Zakres wierszy: private.is_public_gamification_visible plus zawsze własny wiersz wołającego, żeby admin widział swoje dane na własnym Profilu.';

revoke all on function public.get_public_player_profiles()
from public, anon, authenticated;
grant execute on function public.get_public_player_profiles() to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Odznaki innych graczy
-- ---------------------------------------------------------------------------

-- Druga ścieżka, którą admin mógłby wrócić do publicznego Legendarium.
-- Odznaki przy wierszach rankingu czyta warstwa TS wprost z
-- public.user_achievements, a dotychczasowa polityka przepuszczała każdego
-- AKTYWNEGO CZŁONKA — bez filtru po roli. Sam ranking już admina nie pokaże,
-- ale dane nadal by wyciekały do zapytania.
--
-- Zmiany względem 20260705001900 są dwie i obie są celowe:
--   * `private.is_active_member(user_id)` -> `is_public_gamification_visible`,
--   * dostęp do WŁASNYCH odznak wyciągnięty przed ten warunek.
--
-- Drugi punkt jest konieczny, inaczej obserwator (i tak niewidoczny publicznie)
-- straciłby wgląd we własne wiersze. Admin czyta wszystko pierwszym członem
-- polityki, więc swoje odznaki widzi bez zmian.
drop policy if exists user_achievements_select_visible on public.user_achievements;

create policy user_achievements_select_visible
on public.user_achievements for select
using (
  private.is_admin()
  or (
    private.is_active_member()
    and (
      user_id = auth.uid()
      or (
        private.is_public_gamification_visible(user_id)
        and exists (
          select 1
          from public.achievement_definitions as definition
          where definition.achievement_key = user_achievements.achievement_key
            and definition.is_active = true
            and definition.is_secret = false
        )
      )
    )
  )
);
