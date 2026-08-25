-- Misje v1 — gameplayowe wyzwania wynikające z historii gracza.
--
-- ===========================================================================
-- CZYM MISJE **NIE** SĄ
-- ===========================================================================
--
-- Misje to NOWY system, rozłączny ze Zleceniami. Zlecenia (RSVP, głosowanie,
-- ocena, brakujący wynik) są warstwą operacyjną liczoną w Renomie i żyją w
-- całości po stronie TypeScriptu (src/features/dashboard/quests.ts). Ta
-- migracja niczego w nich nie zmienia i nie dotyka `point_events`.
--
-- ===========================================================================
-- ZAŁOŻENIA PRODUKTOWE, KTÓRE WYMUSZAJĄ TEN KSZTAŁT SCHEMATU
-- ===========================================================================
--
-- Grupa gra około RAZ W MIESIĄCU. Wszystko, co zakłada codzienny kontakt z
-- aplikacją (daily, weekly, streaki logowania, dobowe resety), jest tu
-- nieobecne celowo — nie jako brak funkcji, tylko jako decyzja:
--
--   * Misja jest OKAZJĄ, nie obowiązkiem,
--   * wygaśnięcie Misji NIE jest porażką — dlatego enum statusów nie ma
--     wartości 'failed' i nie istnieje żadna ścieżka karząca,
--   * 0 aktywnych Misji to poprawny stan, a nie usterka generatora,
--   * normalny stan to 1–2 aktywne Misje; twardy sufit to 3, przy czym
--     trzeci slot zostaje zarezerwowany na przyszłą Misję Spotkaniową i
--     generator zwykłych Misji nigdy po niego nie sięga,
--   * jedna gra = najwyżej JEDNA aktywna Misja, niezależnie od typu — inaczej
--     jeden wieczór przy jednym tytule zamykałby dwie Misje i płacił dwa razy,
--   * gra, której Misja WYGASŁA, odpoczywa 30 dni w każdym typie — przeczekanie
--     wyzwania nie może go zwracać nazajutrz pod inną nazwą. Po UKOŃCZENIU tej
--     blokady nie ma: ukończenie zmienia stan gry i nowe wyzwanie jest
--     zasłużoną kontynuacją historii, nie obejściem.
--
-- ===========================================================================
-- OSOBNA WALUTA
-- ===========================================================================
--
-- Renoma zostaje wyłącznie prestiżem: jest zdobywana i nigdy wydawana, a jej
-- ledgerem pozostaje `point_events`. Misje płacą DRUGĄ, rozłączną walutą —
-- TUKATAMI (asset `public/assets/Tukaty.png`, nazwa obecna już w
-- opublikowanych patch notes). Tukaty mają własny ledger, bo mieszanie dwóch
-- walut w jednej tabeli oznaczałoby, że każde zapytanie o saldo Renomy
-- musiałoby pamiętać o filtrze — a jedno zapomniane `where` psułoby ranking.
--
-- Sklepu ani wydawania Tukatów ta migracja nie wprowadza. Ledger jest jednak
-- od razu znakowo pojemny (`amount integer not null check (amount <> 0)`), więc
-- przyszłe obciążenia wejdą jako ujemne wiersze, bez zmiany schematu.

-- ---------------------------------------------------------------------------
-- 1. Słowniki
-- ---------------------------------------------------------------------------

create type public.mission_type as enum (
  'revenge',
  'resurrection',
  'first_chapter',
  'continue_story'
);

comment on type public.mission_type is
  'Typy Misji v1. Rewanż (przegrana partia rywalizacyjna), Wskrzeszenie (powrót po >= 180 dniach), Pierwszy Rozdział (gra z własnej Półki bez ani jednej partii), Dokończ Historię (porzucona gra, 60–179 dni). Misje Spotkaniowe i klasowe są świadomie poza v1.';

create type public.mission_status as enum ('active', 'completed', 'expired');

comment on type public.mission_status is
  'Cykl życia instancji Misji. Nie ma statusu ''failed'': niewykonana Misja po prostu wygasa, bez kary i bez śladu porażki w interfejsie.';

-- ---------------------------------------------------------------------------
-- 2. Tukaty — append-only ledger
-- ---------------------------------------------------------------------------

create table public.tukat_events (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete restrict,
  amount integer not null check (amount <> 0),
  source_type text not null check (length(btrim(source_type)) > 0),
  source_id uuid,
  reason text not null check (length(btrim(reason)) > 0),
  -- Klucz idempotencji jest JEDYNYM gwarantem „nagroda dokładnie raz”, który
  -- nie zależy od poprawności kodu wołającego. Dla Misji ma postać
  -- 'mission:<mission_id>' — druga wypłata za tę samą instancję jest
  -- niemożliwa nawet przy równoległych recompute'ach.
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  created_at timestamptz not null default now()
);

comment on table public.tukat_events is
  'Append-only ledger Tukatów — waluty Misji. Rozłączny z point_events, które pozostają ledgerem Renomy. Saldo = suma amount. Wiersze są niezmienne: UPDATE i DELETE blokuje trigger, a RLS nie daje nikomu prawa zapisu — dopisywać może wyłącznie private.award_tukats_once.';

create unique index tukat_events_idempotency_key_idx
  on public.tukat_events (idempotency_key);

create index tukat_events_user_history_idx
  on public.tukat_events (user_id, created_at desc);

alter table public.tukat_events enable row level security;

create policy tukat_events_select_own
on public.tukat_events for select to authenticated
using (user_id = auth.uid() or private.is_admin());

revoke all on table public.tukat_events from public, anon, authenticated;
grant select on table public.tukat_events to authenticated;

-- Append-only strukturalnie, nie tylko z uprawnień. RLS chroni przed
-- użytkownikiem, ale każda funkcja security definer omija RLS — a przyszły
-- Sklep będzie właśnie taką funkcją. Trigger sprawia, że „skasuj wypłatę”
-- jest niewykonalne bez świadomej migracji.
create or replace function private.reject_tukat_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'tukat_events is append-only'
    using errcode = '0A000';
end;
$$;

revoke all on function private.reject_tukat_event_mutation()
  from public, anon, authenticated;

create trigger tukat_events_append_only
before update or delete on public.tukat_events
for each row execute function private.reject_tukat_event_mutation();

-- Saldo. Dokładnie ten sam kształt i ta sama reguła widoczności co
-- public.user_point_balances dla Renomy (20260704000800) — jedna waluta, jeden
-- wzorzec odczytu.
create view public.tukat_balances
with (security_invoker = true)
as
select
  membership.user_id,
  coalesce(sum(event.amount), 0)::bigint as total_tukats
from public.app_members as membership
left join public.tukat_events as event
  on event.user_id = membership.user_id
where membership.is_active = true
  and (
    membership.user_id = auth.uid()
    or private.is_admin()
  )
group by membership.user_id;

comment on view public.tukat_balances is
  'Saldo Tukatów. Suma append-only ledgera tukat_events. Nie ma nic wspólnego z Renomą ani z user_point_balances.';

grant select on public.tukat_balances to authenticated;

create or replace function private.award_tukats_once(
  p_user_id uuid,
  p_amount integer,
  p_source_type text,
  p_source_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted uuid;
begin
  if p_user_id is null or p_amount is null or p_amount = 0 then
    return false;
  end if;

  -- Ta sama bramka kwalifikacyjna co dla Renomy i odznak
  -- (private.award_points_once, private.apply_reward_delta): obserwator i
  -- konto nieaktywne nie gromadzą niczego. Admin BĘDĄCY graczem gromadzi.
  if not private.is_gamification_eligible(p_user_id) then
    return false;
  end if;

  insert into public.tukat_events (
    user_id, amount, source_type, source_id, reason, idempotency_key
  )
  values (
    p_user_id, p_amount, p_source_type, p_source_id, p_reason, p_idempotency_key
  )
  on conflict (idempotency_key) do nothing
  returning id into v_inserted;

  return v_inserted is not null;
end;
$$;

comment on function private.award_tukats_once(
  uuid, integer, text, uuid, text, text
) is
  'Idempotentna wypłata Tukatów. Druga próba z tym samym idempotency_key nie robi nic i zwraca false. Nie dotyka point_events ani Renomy.';

revoke all on function private.award_tukats_once(
  uuid, integer, text, uuid, text, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Instancje Misji
-- ---------------------------------------------------------------------------

create table public.user_missions (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  mission_type public.mission_type not null,
  status public.mission_status not null default 'active',
  game_id uuid references public.games (id) on delete cascade,
  -- Zarezerwowane pod Misje Spotkaniowe (poza v1). Kolumna istnieje od razu,
  -- żeby przyszły typ nie wymagał migracji zmieniającej kształt tabeli.
  meeting_id uuid references public.meetings (id) on delete set null,
  generated_at timestamptz not null default now(),
  expires_at timestamptz not null,
  completed_at timestamptz,
  -- Nagroda ZAMROŻONA w chwili wygenerowania. Zmiana cennika nie może zmienić
  -- obietnicy, którą gracz już zobaczył na karcie.
  reward_amount integer not null check (reward_amount > 0),
  -- Tożsamość dla cooldownu: dziś zawsze game_id, bo wszystkie cztery typy są
  -- związane z konkretną grą. Osobna kolumna, a nie wyliczenie w locie, bo
  -- przyszła Misja Spotkaniowa będzie miała inną tożsamość.
  cooldown_key text not null check (length(btrim(cooldown_key)) > 0),
  -- Zamrożony warunek: tytuł gry, moment wyzwalacza, liczba dni przerwy.
  -- Dzięki temu karta i podgląd operatorski potrafią wytłumaczyć, DLACZEGO ta
  -- Misja powstała, nawet gdy dane źródłowe zmieniły się później.
  context jsonb not null default '{}'::jsonb,
  source_play_id uuid references public.plays (id) on delete set null,
  completed_play_id uuid references public.plays (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_missions_expires_after_generated check (
    expires_at > generated_at
  ),
  constraint user_missions_completed_state check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint user_missions_completed_needs_play check (
    status = 'completed' or completed_play_id is null
  ),
  -- Wszystkie cztery typy v1 dotyczą konkretnej gry. Warunek jest napisany
  -- „od strony typów”, więc przyszły typ spoza tej listy (Misja Spotkaniowa)
  -- nie będzie musiał go łamać.
  constraint user_missions_game_scoped_types check (
    game_id is not null
    or mission_type not in (
      'revenge'::public.mission_type,
      'resurrection'::public.mission_type,
      'first_chapter'::public.mission_type,
      'continue_story'::public.mission_type
    )
  )
);

comment on table public.user_missions is
  'Trwałe instancje Misji. Jedna Misja = jedna okazja dla jednego gracza. Zapisywać może wyłącznie silnik (funkcje security definer) — RLS daje użytkownikowi sam odczyt własnych wierszy, dokładnie jak przy point_events i user_achievements.';

comment on column public.user_missions.context is
  'Zamrożony kontekst warunku (tytuł gry, moment wyzwalacza, dni przerwy). Służy prezentacji i podglądowi operatorskiemu; silnik nigdy nie podejmuje na jego podstawie decyzji — te liczy zawsze ze świeżych danych.';

-- JEDNA aktywna Misja danego TYPU na gracza.
--
-- Realizacja reguły „nie generuj kilku Pierwszych Rozdziałów naraz tylko
-- dlatego, że ktoś ma dużą Półkę”. Przy targecie 2 aktywnych daje też naturalną
-- różnorodność: drugi slot trafia do innego typu.
create unique index user_missions_one_active_per_type_idx
  on public.user_missions (user_id, mission_type)
  where status = 'active';

-- JEDNA aktywna Misja na GRĘ.
--
-- Typy nie są rozłączne po grze: ta sama gra potrafi być jednocześnie
-- kandydatem na Rewanż (ostatnia partia przegrana) i na Dokończ Historię
-- (60–179 dni przerwy). Bez tego indeksu gracz mógłby dostać dwie zwykłe Misje
-- o tym samym tytule, a JEDNA rozegrana partia zamknęłaby obie i wypłaciła dwie
-- nagrody — dokładnie ten overlap pokazał lokalny podgląd (Kuba: Rewanż +
-- Dokończ Historię dla XCOM).
--
-- Rozstrzyga istniejący priorytet: Rewanż > Wskrzeszenie > Pierwszy Rozdział >
-- Dokończ Historię. Progi Wskrzeszenia i Dokończ Historię i tak są rozłączne,
-- więc realnie chodzi o pary z Rewanżem.
--
-- Warunek `game_id is not null` jest tu formalnością (NULL-e i tak nie kolidują
-- w indeksie unikalnym), ale zapisuje wprost intencję: przyszła Misja
-- Spotkaniowa nie jest związana z grą i nigdy nie ma konkurować o ten slot.
create unique index user_missions_one_active_per_game_idx
  on public.user_missions (user_id, game_id)
  where status = 'active' and game_id is not null;

create index user_missions_cooldown_lookup_idx
  on public.user_missions (user_id, mission_type, cooldown_key, status);

-- Ścieżka dostępu globalnego cooldownu gry: „czy ten gracz ma dla tej gry
-- WYGASŁĄ Misję świeższą niż 30 dni”. Indeks częściowy, bo pytanie dotyczy
-- wyłącznie wierszy 'expired'.
create index user_missions_expired_game_cooldown_idx
  on public.user_missions (user_id, game_id, expires_at desc)
  where status = 'expired' and game_id is not null;

create index user_missions_active_lookup_idx
  on public.user_missions (user_id, status, expires_at);

create trigger user_missions_set_updated_at
before update on public.user_missions
for each row execute function private.set_updated_at();

alter table public.user_missions enable row level security;

create policy user_missions_select_own
on public.user_missions for select to authenticated
using (user_id = auth.uid() or private.is_admin());

revoke all on table public.user_missions from public, anon, authenticated;
grant select on table public.user_missions to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Reguły: cennik, TTL, cooldown, priorytet
-- ---------------------------------------------------------------------------

create or replace function private.mission_active_target()
returns integer
language sql
immutable
set search_path = ''
as $$ select 2; $$;

comment on function private.mission_active_target() is
  'Docelowa liczba aktywnych zwykłych Misji. Generator przestaje dosypywać po osiągnięciu tej wartości — trzeci slot zostaje na przyszłą Misję Spotkaniową.';

create or replace function private.mission_active_hard_max()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3; $$;

comment on function private.mission_active_hard_max() is
  'Twardy sufit aktywnych Misji dowolnego rodzaju. Pilnuje go trigger na user_missions, nie tylko generator.';

revoke all on function private.mission_active_target() from public, anon, authenticated;
revoke all on function private.mission_active_hard_max() from public, anon, authenticated;

create or replace function private.mission_policy(
  p_mission_type public.mission_type default null
)
returns table (
  mission_type public.mission_type,
  ttl_days integer,
  cooldown_days integer,
  reward_amount integer,
  min_idle_days integer,
  max_idle_days integer,
  priority integer
)
language sql
immutable
set search_path = ''
as $$
  select
    policy.mission_type,
    policy.ttl_days,
    policy.cooldown_days,
    policy.reward_amount,
    policy.min_idle_days,
    policy.max_idle_days,
    policy.priority
  from (
    values
      ('revenge'::public.mission_type, 30, 30, 15, null::integer, null::integer, 1),
      ('resurrection'::public.mission_type, 45, 60, 15, 180, null::integer, 2),
      ('first_chapter'::public.mission_type, 45, 45, 10, null::integer, null::integer, 3),
      ('continue_story'::public.mission_type, 30, 30, 10, 60, 180, 4)
  ) as policy(
    mission_type, ttl_days, cooldown_days, reward_amount,
    min_idle_days, max_idle_days, priority
  )
  where p_mission_type is null or policy.mission_type = p_mission_type;
$$;

comment on function private.mission_policy(public.mission_type) is
  'Cennik i terminy Misji — jedyne źródło prawdy dla generatora, podglądu operatorskiego i testów. Priorytet: świeży Rewanż > Wskrzeszenie > Pierwszy Rozdział > Dokończ Historię. Progi przerwy Wskrzeszenia (>= 180 dni) i Dokończ Historię (60–179 dni) są ROZŁĄCZNE, więc dla tej samej gry Wskrzeszenie z definicji wyprzedza Dokończ Historię.';

revoke all on function private.mission_policy(public.mission_type)
  from public, anon, authenticated;

-- Twardy sufit aktywnych Misji, egzekwowany przez bazę.
create or replace function private.assert_mission_slot_available()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'active'::public.mission_status then
    return new;
  end if;

  if (
    select count(*)
    from public.user_missions as mission
    where mission.user_id = new.user_id
      and mission.status = 'active'::public.mission_status
      and mission.id <> new.id
  ) >= private.mission_active_hard_max() then
    raise exception 'Mission slot limit reached for user %', new.user_id
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function private.assert_mission_slot_available()
  from public, anon, authenticated;

create trigger user_missions_enforce_slot_limit
before insert or update of status on public.user_missions
for each row execute function private.assert_mission_slot_available();

-- ---------------------------------------------------------------------------
-- 5. Predykaty domenowe
-- ---------------------------------------------------------------------------

-- „Jednoznaczna porażka w partii rywalizacyjnej”.
--
-- Miejsca (placement) są w Kronice OPCJONALNE także dla partii rywalizacyjnej,
-- więc nie mogą być tu wymogiem — inaczej Rewanż nie powstawałby po większości
-- realnych wpisów. Jednoznaczność bierzemy stąd, że ktoś faktycznie wygrał, a
-- gracz był jednym z co najmniej dwóch uczestników i nie jest zwycięzcą.
--
-- Porażka kooperacyjna jest tu odcięta warunkiem mode = 'competitive' — w
-- kooperacji przegrywa DRUŻYNA, więc „rewanż na kimś” nie ma sensu.
create or replace function private.play_is_decisive_competitive_loss(
  p_play_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plays as play
    join public.play_participants as target
      on target.play_id = play.id
     and target.user_id = p_user_id
    where play.id = p_play_id
      and play.status = 'completed'::public.play_status
      and play.mode = 'competitive'::public.play_mode
      and coalesce(target.is_winner, false) = false
      and (
        select count(*)
        from public.play_participants as party
        where party.play_id = play.id
      ) >= 2
      and exists (
        select 1
        from public.play_participants as winner
        where winner.play_id = play.id
          and winner.is_winner
      )
  );
$$;

revoke all on function private.play_is_decisive_competitive_loss(uuid, uuid)
  from public, anon, authenticated;

create or replace function private.mission_cooldown_active(
  p_user_id uuid,
  p_mission_type public.mission_type,
  p_cooldown_key text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_missions as mission
    cross join lateral private.mission_policy(p_mission_type) as policy
    where mission.user_id = p_user_id
      and mission.mission_type = p_mission_type
      and mission.cooldown_key = p_cooldown_key
      and mission.status <> 'active'::public.mission_status
      -- Cooldown liczy się od ZAKOŃCZENIA lub WYGAŚNIĘCIA poprzedniej
      -- instancji, nie od jej wygenerowania.
      and coalesce(mission.completed_at, mission.expires_at)
          > now() - make_interval(days => policy.cooldown_days)
  );
$$;

comment on function private.mission_cooldown_active(
  uuid, public.mission_type, text
) is
  'Czy dla tej pary (gracz, typ, gra) trwa jeszcze cooldown po poprzedniej instancji. Liczony od completed_at albo expires_at — nigdy od generated_at.';

revoke all on function private.mission_cooldown_active(
  uuid, public.mission_type, text
) from public, anon, authenticated;

create or replace function private.mission_expired_game_cooldown_days()
returns integer
language sql
immutable
set search_path = ''
as $$ select 30; $$;

comment on function private.mission_expired_game_cooldown_days() is
  'Ile dni gra odpoczywa po WYGAŚNIĘCIU dowolnej zwykłej Misji jej dotyczącej. Osobna stała od cooldownów per (typ, gra) w private.mission_policy — tamte dotyczą powtórki tego samego wyzwania, ta dotyczy całego tytułu.';

revoke all on function private.mission_expired_game_cooldown_days()
  from public, anon, authenticated;

-- Globalny cooldown gry PO WYGAŚNIĘCIU — celowo NIE po ukończeniu.
--
-- Problem, który rozwiązuje: cooldowny w mission_policy są per (typ, gra), więc
-- wygasły Rewanż dla XCOM blokował wyłącznie kolejny Rewanż. Nazajutrz ta sama
-- gra mogła wrócić jako Dokończ Historię — czyli gracz, który zignorował
-- wyzwanie, dostawał je natychmiast pod inną nazwą. Ten sam tytuł potrafi
-- kwalifikować się do kilku typów naraz, więc bez tej reguły „przeczekanie”
-- Misji nic nie kosztuje.
--
-- Dlaczego NIE po ukończeniu: ukończenie ZMIENIA stan gry, a nowy stan ma prawo
-- zrodzić inne wyzwanie. Powrót do porzuconej gry domyka Dokończ Historię, a
-- jeśli przy okazji gracz przegra — Rewanż jest naturalną, zasłużoną
-- kontynuacją tej historii, nie obejściem cooldownu. Dlatego predykat patrzy
-- wyłącznie na status 'expired'.
create or replace function private.mission_game_expiry_cooldown_active(
  p_user_id uuid,
  p_game_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_game_id is not null and exists (
    select 1
    from public.user_missions as mission
    where mission.user_id = p_user_id
      and mission.game_id = p_game_id
      and mission.status = 'expired'::public.mission_status
      and mission.expires_at
          > now() - make_interval(
              days => private.mission_expired_game_cooldown_days()
            )
  );
$$;

comment on function private.mission_game_expiry_cooldown_active(uuid, uuid) is
  'Czy gra odpoczywa po wygaśnięciu dowolnej zwykłej Misji gracza jej dotyczącej. Blokuje KAŻDY typ, nie tylko ten, który wygasł. Świadomie nie reaguje na Misje ukończone — patrz komentarz przy definicji.';

revoke all on function private.mission_game_expiry_cooldown_active(uuid, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Generator — krok 1: kandydaci
-- ---------------------------------------------------------------------------

-- Deterministyczny pipeline. Żadnego random(): przy równych warunkach wynik
-- zależy wyłącznie od danych, więc podgląd operatorski i faktyczne
-- generowanie nie mogą się rozjechać.
--
-- Zwraca WSZYSTKICH kandydatów wraz z rangą w obrębie typu. Odsiew (aktywny
-- duplikat, cooldown, wolne sloty) robi dopiero private.generate_user_missions
-- — dzięki temu ta funkcja jest czysto odczytowa i nadaje się wprost do
-- podglądu operatorskiego.
create or replace function private.mission_candidates(p_user_id uuid)
returns table (
  mission_type public.mission_type,
  game_id uuid,
  source_play_id uuid,
  priority integer,
  rank_in_type integer,
  idle_days integer,
  reason text,
  context jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with last_play as (
    -- Ostatnia UKOŃCZONA partia gracza dla każdej gry.
    select distinct on (play.game_id)
      play.game_id,
      play.id as play_id,
      play.played_at,
      play.mode,
      participant.is_winner,
      floor(
        extract(epoch from (now() - play.played_at)) / 86400
      )::integer as idle_days
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = p_user_id
      and play.status = 'completed'::public.play_status
    order by
      play.game_id,
      play.played_at desc,
      play.created_at desc,
      play.id desc
  ),
  revenge as (
    select
      'revenge'::public.mission_type as mission_type,
      last_play.game_id,
      last_play.play_id as source_play_id,
      1 as priority,
      -- Najświeższa porażka pierwsza — „świeży Rewanż” z listy priorytetów.
      row_number() over (
        order by last_play.played_at desc, last_play.game_id
      )::integer as rank_in_type,
      last_play.idle_days,
      'Ostatnia ukończona partia rywalizacyjna gry „' || game.title
        || '” zakończyła się porażką gracza.' as reason,
      jsonb_build_object(
        'game_title', game.title,
        'source_played_at', last_play.played_at,
        'idle_days', last_play.idle_days
      ) as context
    from last_play
    join public.games as game
      on game.id = last_play.game_id
     and game.archived_at is null
    where private.play_is_decisive_competitive_loss(last_play.play_id, p_user_id)
  ),
  resurrection as (
    select
      'resurrection'::public.mission_type,
      last_play.game_id,
      last_play.play_id,
      2,
      -- Najdłużej porzucona gra pierwsza.
      row_number() over (
        order by last_play.played_at asc, last_play.game_id
      )::integer,
      last_play.idle_days,
      'Gracz nie zagrał w „' || game.title || '” od ' || last_play.idle_days
        || ' dni (próg Wskrzeszenia: 180).',
      jsonb_build_object(
        'game_title', game.title,
        'source_played_at', last_play.played_at,
        'idle_days', last_play.idle_days
      )
    from last_play
    join public.games as game
      on game.id = last_play.game_id
     and game.archived_at is null
    cross join lateral private.mission_policy(
      'resurrection'::public.mission_type
    ) as policy
    where last_play.idle_days >= policy.min_idle_days
  ),
  first_chapter as (
    select
      'first_chapter'::public.mission_type,
      game.id,
      null::uuid,
      3,
      -- Najnowszy nabytek Półki pierwszy: to gra, po którą realnie chce się
      -- sięgnąć, a nie przypadkowy tytuł sprzed lat.
      row_number() over (
        order by game.created_at desc, game.id
      )::integer,
      null::integer,
      'Gra „' || game.title
        || '” stoi na Półce gracza i nie ma ani jednej jego ukończonej partii.',
      jsonb_build_object(
        'game_title', game.title,
        'shelf_added_at', game.created_at
      )
    from public.games as game
    where game.owner_id = p_user_id
      and game.archived_at is null
      and not exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.game_id = game.id
          and play.status = 'completed'::public.play_status
      )
  ),
  continue_story as (
    select
      'continue_story'::public.mission_type,
      last_play.game_id,
      last_play.play_id,
      4,
      row_number() over (
        order by last_play.played_at asc, last_play.game_id
      )::integer,
      last_play.idle_days,
      'Gra „' || game.title || '” leży odłożona od ' || last_play.idle_days
        || ' dni (poniżej progu Wskrzeszenia).',
      jsonb_build_object(
        'game_title', game.title,
        'source_played_at', last_play.played_at,
        'idle_days', last_play.idle_days
      )
    from last_play
    join public.games as game
      on game.id = last_play.game_id
     and game.archived_at is null
    cross join lateral private.mission_policy(
      'continue_story'::public.mission_type
    ) as policy
    -- Przedział DOMKNIĘTY z dołu i OTWARTY z góry. Rozłączność z progiem
    -- Wskrzeszenia (>= 180) jest tu jedynym mechanizmem pierwszeństwa — przy
    -- 180 dniach kandydatem jest wyłącznie Wskrzeszenie.
    where last_play.idle_days >= policy.min_idle_days
      and last_play.idle_days < policy.max_idle_days
  )
  select * from revenge
  union all select * from resurrection
  union all select * from first_chapter
  union all select * from continue_story;
$$;

comment on function private.mission_candidates(uuid) is
  'Kandydaci na Misje dla gracza — krok 1 pipeline''u. Czysto odczytowa i deterministyczna (bez random()): ta sama funkcja zasila generator i operatorski podgląd, więc oba nie mogą użyć różnych reguł.';

revoke all on function private.mission_candidates(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Cykl życia: wygaszanie, ukończenie, generowanie
-- ---------------------------------------------------------------------------

create or replace function private.expire_user_missions(
  p_user_ids uuid[] default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  -- Bez kary, bez śladu porażki: wygasła Misja po prostu znika ze Stołu i
  -- zwalnia slot. Żadnego wpisu w ledgerze, żadnego statusu 'failed'.
  update public.user_missions
  set status = 'expired'::public.mission_status
  where status = 'active'::public.mission_status
    and expires_at <= now()
    and (p_user_ids is null or user_id = any(p_user_ids));

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function private.expire_user_missions(uuid[])
  from public, anon, authenticated;

-- Dowód ukończenia Misji.
--
-- Jednolita reguła dla wszystkich typów: UKOŃCZONA partia tej gry z udziałem
-- gracza, rozegrana PO wygenerowaniu Misji. Dla Rewanżu dodatkowo wygrana.
--
-- Świadomie `played_at`, a nie `created_at`: liczy się moment rozegrania, nie
-- moment wklepania do Kroniki. Dzięki temu dopisanie gracza do już zapisanej
-- partii (poprawka składu) też domyka Misję, a wsteczne uzupełnianie historii
-- sprzed pojawienia się Misji — nie.
create or replace function private.mission_completion_play(p_mission_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select play.id
  from public.user_missions as mission
  join public.plays as play on play.game_id = mission.game_id
  join public.play_participants as participant
    on participant.play_id = play.id
   and participant.user_id = mission.user_id
  where mission.id = p_mission_id
    and play.status = 'completed'::public.play_status
    and play.played_at > mission.generated_at
    and (
      mission.mission_type <> 'revenge'::public.mission_type
      or coalesce(participant.is_winner, false)
    )
  order by play.played_at, play.created_at, play.id
  limit 1;
$$;

revoke all on function private.mission_completion_play(uuid)
  from public, anon, authenticated;

create or replace function private.complete_user_missions(
  p_user_ids uuid[] default null,
  p_reason text default 'mission_completion'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mission record;
  v_play_id uuid;
  v_count integer := 0;
begin
  for v_mission in
    select mission.*
    from public.user_missions as mission
    where mission.status = 'active'::public.mission_status
      and (p_user_ids is null or mission.user_id = any(p_user_ids))
    order by mission.id
  loop
    v_play_id := private.mission_completion_play(v_mission.id);
    if v_play_id is null then
      continue;
    end if;

    -- Warunek `status = 'active'` w UPDATE jest pierwszą z dwóch niezależnych
    -- barier idempotencji: dwa równoległe recompute'y nie mogą obie zamknąć
    -- tej samej Misji. Drugą barierą jest unikalny idempotency_key ledgera.
    update public.user_missions
    set
      status = 'completed'::public.mission_status,
      completed_at = now(),
      completed_play_id = v_play_id
    where id = v_mission.id
      and status = 'active'::public.mission_status;

    if not found then
      continue;
    end if;

    perform private.award_tukats_once(
      v_mission.user_id,
      v_mission.reward_amount,
      'mission',
      v_mission.id,
      'Ukończona Misja: ' || v_mission.mission_type::text,
      'mission:' || v_mission.id::text
    );

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function private.complete_user_missions(uuid[], text)
  from public, anon, authenticated;

create or replace function private.generate_user_missions(
  p_user_id uuid,
  p_reason text default 'mission_generation'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_candidate record;
  v_policy record;
  v_active integer;
  v_target integer := private.mission_active_target();
  v_created integer := 0;
begin
  if p_user_id is null or not private.is_gamification_eligible(p_user_id) then
    return 0;
  end if;

  select count(*)
  into v_active
  from public.user_missions
  where user_id = p_user_id
    and status = 'active'::public.mission_status;

  if v_active >= v_target then
    return 0;
  end if;

  for v_candidate in
    select *
    from private.mission_candidates(p_user_id)
    order by priority, rank_in_type, game_id
  loop
    exit when v_active >= v_target;

    -- Jeden aktywny egzemplarz danego typu. Kolejni kandydaci tego samego typu
    -- są pomijani, więc duża Półka nie zaleje gracza Pierwszymi Rozdziałami.
    if exists (
      select 1
      from public.user_missions as mission
      where mission.user_id = p_user_id
        and mission.mission_type = v_candidate.mission_type
        and mission.status = 'active'::public.mission_status
    ) then
      continue;
    end if;

    -- Jedna aktywna Misja na GRĘ, niezależnie od typu.
    --
    -- Zapytanie widzi także instancje wstawione WCZEŚNIEJ W TYM SAMYM
    -- przebiegu pętli, więc reguła obowiązuje również między kandydatami
    -- proponowanymi razem. Ponieważ kandydaci idą w kolejności priorytetu,
    -- grę zajmuje ten typ, który stoi wyżej: dla pary Rewanż + Dokończ
    -- Historię zostaje sam Rewanż.
    if v_candidate.game_id is not null and exists (
      select 1
      from public.user_missions as mission
      where mission.user_id = p_user_id
        and mission.game_id = v_candidate.game_id
        and mission.status = 'active'::public.mission_status
    ) then
      continue;
    end if;

    -- Gra odpoczywa po WYGAŚNIĘCIU dowolnej swojej Misji — blokada obejmuje
    -- każdy typ, więc przeczekanie Rewanżu nie odblokowuje Dokończ Historię
    -- dla tego samego tytułu. Po UKOŃCZENIU tej blokady nie ma.
    if private.mission_game_expiry_cooldown_active(
      p_user_id,
      v_candidate.game_id
    ) then
      continue;
    end if;

    -- Cooldown jest per (typ, gra), więc pominięcie kandydata NIE blokuje
    -- innej gry w tym samym typie — dlatego pętla idzie dalej, zamiast
    -- porzucać cały typ.
    if private.mission_cooldown_active(
      p_user_id,
      v_candidate.mission_type,
      coalesce(v_candidate.game_id::text, 'global')
    ) then
      continue;
    end if;

    select * into v_policy
    from private.mission_policy(v_candidate.mission_type);

    insert into public.user_missions (
      user_id,
      mission_type,
      status,
      game_id,
      generated_at,
      expires_at,
      reward_amount,
      cooldown_key,
      context,
      source_play_id
    )
    values (
      p_user_id,
      v_candidate.mission_type,
      'active'::public.mission_status,
      v_candidate.game_id,
      now(),
      now() + make_interval(days => v_policy.ttl_days),
      v_policy.reward_amount,
      coalesce(v_candidate.game_id::text, 'global'),
      v_candidate.context || jsonb_build_object(
        'reason', v_candidate.reason,
        'generated_by', p_reason
      ),
      v_candidate.source_play_id
    );

    v_active := v_active + 1;
    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

comment on function private.generate_user_missions(uuid, text) is
  'Krok 3–4 pipeline''u: priorytet i utworzenie brakujących instancji. Nigdy nie przekracza private.mission_active_target() — trzeci slot zostaje na przyszłą Misję Spotkaniową. Pilnuje też, by jedna gra miała najwyżej jedną aktywną Misję: przy nakładających się typach wygrywa wyższy priorytet.';

revoke all on function private.generate_user_missions(uuid, text)
  from public, anon, authenticated;

-- Jedna, bezpieczna do wielokrotnego uruchamiania operacja: wygaś → sprawdź
-- ukończenia → uzupełnij wolne sloty. Drugi przebieg na niezmienionych danych
-- nie tworzy niczego i nie wypłaca niczego drugi raz.
create or replace function private.reconcile_user_missions(
  p_user_ids uuid[] default null,
  p_play_id uuid default null,
  p_reason text default 'mission_reconcile'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_changes integer := 0;
begin
  -- Blokady doradcze w ROSNĄCEJ kolejności user_id — ten sam wzorzec i to samo
  -- uzasadnienie co w private.recompute_play_rewards: dwie równoległe mutacje
  -- o krzyżujących się zbiorach graczy biorą blokady w tym samym porządku,
  -- więc nie mogą się zakleszczyć. Przestrzeń nazw jest inna niż nagrodowa
  -- ('mission:' w haszu), żeby Misje nie serializowały się z Renomą.
  for v_user_id in
    select membership.user_id
    from public.app_members as membership
    where (p_user_ids is null or membership.user_id = any(p_user_ids))
    order by membership.user_id
  loop
    perform pg_advisory_xact_lock(
      hashtextextended('mission:' || v_user_id::text, 0)
    );
  end loop;

  v_changes := private.expire_user_missions(p_user_ids);
  v_changes := v_changes + private.complete_user_missions(p_user_ids, p_reason);

  for v_user_id in
    select membership.user_id
    from public.app_members as membership
    where (p_user_ids is null or membership.user_id = any(p_user_ids))
      and private.is_gamification_eligible(membership.user_id)
    order by membership.user_id
  loop
    v_changes := v_changes + private.generate_user_missions(v_user_id, p_reason);
  end loop;

  return v_changes;
end;
$$;

comment on function private.reconcile_user_missions(uuid[], uuid, text) is
  'generate/reconcile — idempotentna operacja cyklu życia Misji. p_user_ids = null obejmuje wszystkich członków (ścieżka operatorska). p_play_id jest dziś wyłącznie kontekstem diagnostycznym: dowód ukończenia szuka się zawsze po świeżych danych, nie po pojedynczej partii.';

revoke all on function private.reconcile_user_missions(uuid[], uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 8. Wpięcie w mutacje partii (event-driven, bez crona)
-- ---------------------------------------------------------------------------
--
-- private.recompute_play_rewards jest wołane z KAŻDEJ ścieżki zmieniającej
-- partię: create/update/delete_play_with_participants, zakończenie partii przy
-- stole i przepływy kontynuacji. Doklejenie Misji tutaj oznacza, że żadna z
-- tych funkcji nie musi się zmienić — dokładnie ten sam zabieg, którym
-- Legendarium stage2b dopięło swoje odznaki (20260813120000).
--
-- Skutkiem ubocznym jest to, że reconcile obejmuje też autora wpisu i
-- gospodarza wieczoru, nawet gdy nie siedzieli przy stole. To bezpieczne:
-- generator liczy wyłącznie z WŁASNEJ historii danego gracza.

alter function private.recompute_play_rewards(uuid[], uuid, text)
  rename to recompute_play_rewards_before_missions_v1;

create or replace function private.recompute_play_rewards(
  p_user_ids uuid[],
  p_play_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_changes integer;
begin
  v_changes := private.recompute_play_rewards_before_missions_v1(
    p_user_ids,
    p_play_id,
    p_reason
  );

  return v_changes + private.reconcile_user_missions(
    p_user_ids,
    p_play_id,
    p_reason
  );
end;
$$;

revoke all on function private.recompute_play_rewards(uuid[], uuid, text)
  from public, anon, authenticated;
revoke all on function private.recompute_play_rewards_before_missions_v1(
  uuid[], uuid, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 9. RPC odczytowo-porządkowe dla Stołu
-- ---------------------------------------------------------------------------
--
-- Lekki reconcile wołany po wyrenderowaniu Stołu (next/server `after`), a nie
-- w trakcie renderu. Zakres: WYŁĄCZNIE własne Misje wołającego. Koszt to jeden
-- UPDATE wygaszający, przegląd własnych aktywnych Misji i jedno zapytanie o
-- kandydatów — przy grupie tej wielkości pomijalny.
create or replace function public.recompute_current_user_missions()
returns table (
  expired_count integer,
  completed_count integer,
  generated_count integer,
  active_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_expired integer := 0;
  v_completed integer := 0;
  v_generated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  -- Obserwator i konto nieaktywne nie dostają Misji — i nie dostają też
  -- błędu. Stół ma się im wyrenderować normalnie, po prostu bez tej sekcji.
  if not private.is_gamification_eligible(v_user_id) then
    return query select 0, 0, 0, 0;
    return;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('mission:' || v_user_id::text, 0)
  );

  v_expired := private.expire_user_missions(array[v_user_id]);
  v_completed := private.complete_user_missions(
    array[v_user_id],
    'dashboard_reconcile'
  );
  v_generated := private.generate_user_missions(v_user_id, 'dashboard_reconcile');

  return query
  select
    v_expired,
    v_completed,
    v_generated,
    (
      select count(*)::integer
      from public.user_missions as mission
      where mission.user_id = v_user_id
        and mission.status = 'active'::public.mission_status
    );
end;
$$;

comment on function public.recompute_current_user_missions() is
  'Lekki reconcile Misji wołającego: wygaś przeterminowane, domknij ukończone, uzupełnij wolne sloty. Idempotentne — drugi przebieg na tych samych danych nic nie zmienia i nic nie wypłaca.';

revoke all on function public.recompute_current_user_missions()
  from public, anon, authenticated;
grant execute on function public.recompute_current_user_missions()
  to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Operatorski PREVIEW (read-only) i osobny APPLY
-- ---------------------------------------------------------------------------
--
-- Ta migracja NIE generuje Misji dla istniejącej historii. Wdrożenie
-- produkcyjne wygląda tak: najpierw `select * from
-- public.preview_mission_generation()`, ręczna akceptacja wyniku, dopiero
-- potem świadome `select * from private.apply_mission_generation()`.

create or replace function private.mission_generation_plan()
returns table (
  user_id uuid,
  mission_type public.mission_type,
  game_id uuid,
  source_play_id uuid,
  priority integer,
  rank_in_type integer,
  idle_days integer,
  reason text,
  context jsonb,
  ttl_days integer,
  reward_amount integer,
  would_generate boolean,
  skip_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_member record;
  v_candidate record;
  v_policy record;
  v_active integer;
  v_target integer := private.mission_active_target();
  v_taken_types public.mission_type[];
  v_taken_games uuid[];
  v_skip text;
begin
  for v_member in
    select membership.user_id
    from public.app_members as membership
    where private.is_gamification_eligible(membership.user_id)
    order by membership.user_id
  loop
    select count(*)
    into v_active
    from public.user_missions as mission
    where mission.user_id = v_member.user_id
      and mission.status = 'active'::public.mission_status;

    select
      coalesce(
        array_agg(mission.mission_type),
        array[]::public.mission_type[]
      ),
      coalesce(
        array_agg(mission.game_id) filter (where mission.game_id is not null),
        array[]::uuid[]
      )
    into v_taken_types, v_taken_games
    from public.user_missions as mission
    where mission.user_id = v_member.user_id
      and mission.status = 'active'::public.mission_status;

    -- Aliasowanie wyniku jest tu KONIECZNE, a nie kosmetyczne: nazwy kolumn
    -- pokrywają się z parametrami OUT tej funkcji, więc gołe `order by
    -- priority` plpgsql rozstrzygnąłby jako odwołanie do zmiennej.
    for v_candidate in
      select *
      from private.mission_candidates(v_member.user_id) as candidate
      order by candidate.priority, candidate.rank_in_type, candidate.game_id
    loop
      select * into v_policy
      from private.mission_policy(v_candidate.mission_type);

      -- Zestaw warunków jest identyczny jak w generatorze, ale RAPORTUJEMY je w
      -- innej kolejności: najpierw powody dotyczące samego kandydata, a
      -- wyczerpanie slotów na końcu. `would_generate` jest od tej kolejności
      -- niezależne (każdy z warunków blokuje tak samo), więc nic to nie zmienia
      -- w wyniku — a operator dowiaduje się więcej. Inaczej kandydat zablokowany
      -- przez konflikt gry raportowałby tylko „limit”, ukrywając prawdziwy
      -- powód: to była druga Misja tego samego tytułu.
      if v_candidate.mission_type = any(v_taken_types) then
        v_skip := 'gracz ma już aktywną Misję tego typu';
      elsif v_candidate.game_id = any(v_taken_games) then
        v_skip := 'gracz ma już aktywną Misję dla tej gry (wygrał wyższy priorytet)';
      elsif private.mission_game_expiry_cooldown_active(
        v_member.user_id,
        v_candidate.game_id
      ) then
        v_skip := 'gra odpoczywa 30 dni po wygaśnięciu poprzedniej Misji tego tytułu';
      elsif private.mission_cooldown_active(
        v_member.user_id,
        v_candidate.mission_type,
        coalesce(v_candidate.game_id::text, 'global')
      ) then
        v_skip := 'trwa cooldown po poprzedniej instancji tej Misji';
      elsif v_active >= v_target then
        v_skip := 'limit aktywnych Misji (' || v_target || ') osiągnięty';
      else
        v_skip := null;
      end if;

      if v_skip is null then
        v_active := v_active + 1;
        v_taken_types := array_append(v_taken_types, v_candidate.mission_type);

        if v_candidate.game_id is not null then
          v_taken_games := array_append(v_taken_games, v_candidate.game_id);
        end if;
      end if;

      user_id := v_member.user_id;
      mission_type := v_candidate.mission_type;
      game_id := v_candidate.game_id;
      source_play_id := v_candidate.source_play_id;
      priority := v_candidate.priority;
      rank_in_type := v_candidate.rank_in_type;
      idle_days := v_candidate.idle_days;
      reason := v_candidate.reason;
      context := v_candidate.context;
      ttl_days := v_policy.ttl_days;
      reward_amount := v_policy.reward_amount;
      would_generate := v_skip is null;
      skip_reason := v_skip;
      return next;
    end loop;
  end loop;
end;
$$;

comment on function private.mission_generation_plan() is
  'Symulacja generatora dla całej grupy, bez zapisu. Używa DOKŁADNIE tych samych predykatów co private.generate_user_missions — podgląd i APPLY nie mogą użyć różnych reguł.';

revoke all on function private.mission_generation_plan()
  from public, anon, authenticated;

create or replace function public.preview_mission_generation()
returns table (
  user_id uuid,
  display_name text,
  mission_type public.mission_type,
  game_id uuid,
  game_title text,
  trigger_reason text,
  proposed_generated_at timestamptz,
  proposed_expires_at timestamptz,
  reward_tukats integer,
  priority integer,
  rank_in_type integer,
  decision text,
  skip_reason text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  return query
  select
    plan.user_id,
    profile.display_name,
    plan.mission_type,
    plan.game_id,
    game.title,
    plan.reason,
    now(),
    now() + make_interval(days => plan.ttl_days),
    plan.reward_amount,
    plan.priority,
    plan.rank_in_type,
    case when plan.would_generate then 'generate' else 'skip' end,
    plan.skip_reason
  from private.mission_generation_plan() as plan
  join public.profiles as profile on profile.id = plan.user_id
  left join public.games as game on game.id = plan.game_id
  order by
    profile.display_name,
    plan.priority,
    plan.rank_in_type,
    game.title;
end;
$$;

comment on function public.preview_mission_generation() is
  'READ-ONLY podgląd operatorski: kto, jaką Misję, na którą grę, z jakiego powodu, z jakim terminem i nagrodą — oraz dlaczego kandydat przegrał z innym. Nie zapisuje niczego.';

revoke all on function public.preview_mission_generation()
  from public, anon, authenticated;
grant execute on function public.preview_mission_generation() to authenticated;

create or replace function private.apply_mission_generation()
returns table (
  expired_count integer,
  completed_count integer,
  generated_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_expired integer := 0;
  v_completed integer := 0;
  v_generated integer := 0;
begin
  -- auth.uid() = null oznacza wywołanie z psql/migracji przez operatora.
  -- Z sesji aplikacyjnej wpuszczamy wyłącznie administratora.
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  v_expired := private.expire_user_missions(null);
  v_completed := private.complete_user_missions(null, 'mission_backfill');

  for v_user_id in
    select membership.user_id
    from public.app_members as membership
    where private.is_gamification_eligible(membership.user_id)
    order by membership.user_id
  loop
    v_generated := v_generated
      + private.generate_user_missions(v_user_id, 'mission_backfill');
  end loop;

  return query select v_expired, v_completed, v_generated;
end;
$$;

comment on function private.apply_mission_generation() is
  'Operatorski APPLY historycznego generowania Misji. NIE jest wołany przez żadną migrację — produkcja dopiero po ręcznej akceptacji public.preview_mission_generation().';

revoke all on function private.apply_mission_generation()
  from public, anon, authenticated;
