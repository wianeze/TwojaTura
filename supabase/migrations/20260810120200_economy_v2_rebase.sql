-- Economy V2 — plan, podgląd i zastosowanie historycznego rebase'u (krok 3/3).
--
-- CEL. Saldo każdego użytkownika po zastosowaniu ma odpowiadać temu, ile
-- Renomy miałby, gdyby CAŁA jego dotychczasowa historia była od początku
-- liczona według cennika V2. Nominalna wartość dzisiejszego salda nie jest
-- chroniona — spadek z 500 do 120 jest oczekiwanym wynikiem, nie błędem.
--
-- TA MIGRACJA NICZEGO NIE PRZELICZA. Instaluje wyłącznie narzędzia. Masowa
-- korekta historycznych sald jest decyzją operatorską, a nie skutkiem ubocznym
-- deployu: najpierw pgTAP, potem PODGLĄD na danych, potem świadome APPLY.
--
-- TRZY WARSTWY, JEDNO ŹRÓDŁO OBLICZEŃ:
--
--   private.economy_v2_reward_plan()   — JEDYNE miejsce, w którym powstaje
--     odpowiedź „ile ta nagroda ma być warta i ile jest warta teraz”. Czysty
--     odczyt, bez skutków ubocznych.
--
--   public.preview_economy_v2_rebase() — agreguje plan do raportu per
--     użytkownik. Nie zapisuje ANI JEDNEGO wiersza.
--
--   private.apply_economy_v2_rebase()  — wykonuje dokładnie ten sam plan,
--     dopisując różnice do księgi.
--
-- Podgląd i zastosowanie nie mogą się rozjechać, bo czytają ten sam plan.
-- Pilnuje tego dodatkowo test pgTAP porównujący projected_balance_after z
-- rzeczywistym saldem po APPLY.
--
-- CZEGO TO NIE ROBI. Ani jednego DELETE i ani jednego UPDATE na
-- public.point_events. Księga zostaje append-only, historyczne zdarzenia
-- zostają czytelne co do wartości i daty, a korekta jest osobnym zdarzeniem
-- różnicowym na kolejnej rewizji tej samej nagrody.
--
-- ŚWIADOMIE POZA ZAKRESEM:
--   * odznaki — zachowują bieżące wartości (osobny audyt Legendarium),
--   * public.admin_point_adjustments — jawne decyzje administratora zostają
--     nietknięte, zgodnie z zasadą „nie niszcz historii dawnych korekt”.

-- ---------------------------------------------------------------------------
-- 1. Rejestr uruchomień
-- ---------------------------------------------------------------------------

create table public.economy_rebase_runs (
  version text primary key check (length(btrim(version)) > 0),
  applied_at timestamptz not null default now(),
  applied_by uuid references public.profiles (id) on delete set null,
  users_affected integer not null default 0,
  events_written integer not null default 0,
  points_delta bigint not null default 0,
  diagnostics jsonb not null default '{}'::jsonb
);

comment on table public.economy_rebase_runs is
  'Znacznik zastosowanych przeliczeń ekonomii Renomy. Obecność wiersza o danej wersji jest jedynym źródłem prawdy o tym, czy dane przeliczenie zostało wykonane. Economy V3 nie musi tego zgadywać.';

create table public.economy_rebase_user_totals (
  version text not null
    references public.economy_rebase_runs (version) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  balance_before bigint not null,
  balance_after bigint not null,
  breakdown jsonb not null default '{}'::jsonb,
  primary key (version, user_id)
);

alter table public.economy_rebase_runs enable row level security;
alter table public.economy_rebase_user_totals enable row level security;

create policy economy_rebase_runs_select_admin
on public.economy_rebase_runs for select
using (private.is_admin());

create policy economy_rebase_user_totals_select_admin
on public.economy_rebase_user_totals for select
using (private.is_admin());

grant select on public.economy_rebase_runs to authenticated;
grant select on public.economy_rebase_user_totals to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kubełki raportowe
-- ---------------------------------------------------------------------------

-- Historyczne typy zwijają się do kubełka swojego następcy: 'meeting_created'
-- do 'meeting_hosted', 'play_logged' do 'play_participated'. Dzięki temu
-- breakdown pokazuje wartość DOCELOWĄ danego źródła, a nie ślad po migracji.
create or replace function private.economy_bucket(p_action_type text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_action_type = 'meeting_rsvp' then 'meeting_rsvp'
    when p_action_type = 'meeting_vote' then 'meeting_vote'
    when p_action_type = 'rating_created' then 'rating_created'
    when p_action_type in ('meeting_hosted', 'meeting_created')
      then 'meeting_hosted'
    when p_action_type like 'shelf\_%' then 'shelf_milestones'
    when p_action_type in ('play_participated', 'play_logged')
      then 'play_participated'
    when p_action_type like 'achievement\_unlocked:%' then 'achievements'
    when p_action_type like 'admin\_award:%'
      or p_action_type like 'admin\_reversal:%'
      then 'admin_adjustments'
    else 'other'
  end;
$$;

revoke all on function private.economy_bucket(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Plan — jedyne źródło obliczeń
-- ---------------------------------------------------------------------------

-- Zwraca po jednym wierszu na nagrodę, której saldo księgi różni się od
-- wartości docelowej Economy V2.
--
-- reward_kind rozstrzyga, KTO wykona zapis przy APPLY:
--   'play'   — private.apply_reward_delta, bo nagroda ma stan w
--              public.play_reward_states i musi zostać z nim spójna,
--   'ledger' — private.rebase_point_reward, czyli sam wpis różnicowy.
--
-- Odbiorcą nagrody dodatniej może być wyłącznie aktywny CZŁONEK: konta admina
-- i obserwatora nie gromadzą Renomy (ta sama zasada co w
-- private.award_points_once i private.apply_reward_delta). Zerowanie starych
-- nagród działa natomiast dla wszystkich — inaczej koncie ukrytemu zostałoby
-- 40 Renomy z V1.
create or replace function private.economy_v2_reward_plan()
returns table (
  user_id uuid,
  reward_kind text,
  action_type text,
  entity_type text,
  entity_id uuid,
  target_points integer,
  current_points integer,
  delta integer
)
language sql
stable
security definer
set search_path = ''
as $$
with rewardable as (
  select membership.user_id
  from public.app_members as membership
  where membership.is_active
    and membership.role = 'member'::public.membership_role
),

-- === Odpowiedź na spotkanie =================================================
rsvp_domain as (
  select distinct availability.user_id, availability.meeting_id as entity_id
  from public.meeting_availability as availability
  join public.meetings as meeting on meeting.id = availability.meeting_id
  where meeting.deleted_at is null
),
rsvp_pairs as (
  select user_id, entity_id from rsvp_domain
  union
  select distinct event.user_id, event.related_entity_id
  from public.point_events as event
  where event.action_type = 'meeting_rsvp'
    and event.related_entity_type = 'meeting'
),
rsvp_plan as (
  select
    pair.user_id,
    'meeting_rsvp'::text as action_type,
    'meeting'::text as entity_type,
    pair.entity_id,
    case
      when exists (
        select 1 from rsvp_domain as domain
        where domain.user_id = pair.user_id
          and domain.entity_id = pair.entity_id
      )
      and exists (select 1 from rewardable where rewardable.user_id = pair.user_id)
      then private.point_reward_for('meeting_rsvp')
      else 0
    end as target_points
  from rsvp_pairs as pair
),

-- === Głos na grę ============================================================
-- Migracja 20260730120000 PRZEMIANOWAŁA meeting_game_votes na
-- meeting_game_responses (alter table ... rename to), więc głosy sprzed tamtej
-- zmiany są dziś dokładnie tymi samymi wierszami. Jedna tabela wystarcza —
-- historyczny action_type 'meeting_vote' zostaje bez zmian.
vote_domain as (
  select distinct response.user_id, response.meeting_id as entity_id
  from public.meeting_game_responses as response
  join public.meetings as meeting on meeting.id = response.meeting_id
  where meeting.deleted_at is null
),
vote_pairs as (
  select user_id, entity_id from vote_domain
  union
  select distinct event.user_id, event.related_entity_id
  from public.point_events as event
  where event.action_type = 'meeting_vote'
    and event.related_entity_type = 'meeting'
),
vote_plan as (
  select
    pair.user_id,
    'meeting_vote'::text as action_type,
    'meeting'::text as entity_type,
    pair.entity_id,
    case
      when exists (
        select 1 from vote_domain as domain
        where domain.user_id = pair.user_id
          and domain.entity_id = pair.entity_id
      )
      and exists (select 1 from rewardable where rewardable.user_id = pair.user_id)
      then private.point_reward_for('meeting_vote')
      else 0
    end as target_points
  from vote_pairs as pair
),

-- === Ocena gry ==============================================================
rating_domain as (
  select distinct rating.user_id, rating.game_id as entity_id
  from public.ratings as rating
),
rating_pairs as (
  select user_id, entity_id from rating_domain
  union
  select distinct event.user_id, event.related_entity_id
  from public.point_events as event
  where event.action_type = 'rating_created'
    and event.related_entity_type = 'game'
),
rating_plan as (
  select
    pair.user_id,
    'rating_created'::text as action_type,
    'game'::text as entity_type,
    pair.entity_id,
    case
      when exists (
        select 1 from rating_domain as domain
        where domain.user_id = pair.user_id
          and domain.entity_id = pair.entity_id
      )
      and exists (select 1 from rewardable where rewardable.user_id = pair.user_id)
      then private.point_reward_for('rating_created')
      else 0
    end as target_points
  from rating_pairs as pair
),

-- === Organizacja spotkania ==================================================
-- „Faktycznie się odbyło” = status 'completed' i deleted_at is null. To jedyny
-- stan końcowy w tej domenie (enum: planned, confirmed, completed) i nadaje go
-- wyłącznie public.complete_meeting — organizator albo admin, po rozliczeniu
-- wszystkich biegnących partii. Spotkanie anulowane jest w tej aplikacji
-- spotkaniem usuniętym miękko, a niedomknięte zostaje na 'planned' albo
-- 'confirmed'. W obu przypadkach organizator dostaje 0.
hosted_domain as (
  select meeting.created_by as user_id, meeting.id as entity_id
  from public.meetings as meeting
  where meeting.deleted_at is null
    and meeting.status = 'completed'::public.meeting_status
),
hosted_pairs as (
  select user_id, entity_id from hosted_domain
  union
  select distinct event.user_id, event.related_entity_id
  from public.point_events as event
  where event.action_type = 'meeting_hosted'
    and event.related_entity_type = 'meeting'
),
hosted_plan as (
  select
    pair.user_id,
    'meeting_hosted'::text as action_type,
    'meeting'::text as entity_type,
    pair.entity_id,
    case
      when exists (
        select 1 from hosted_domain as domain
        where domain.user_id = pair.user_id
          and domain.entity_id = pair.entity_id
      )
      and exists (select 1 from rewardable where rewardable.user_id = pair.user_id)
      then private.point_reward_for('meeting_hosted')
      else 0
    end as target_points
  from hosted_pairs as pair
),

-- === Wycofanie historycznego meeting_created ================================
-- Typ przechodzi w stan legacy: zdarzenia zostają w księdze i są audytowalne,
-- ale ich wpływ ekonomiczny schodzi do zera. Właściwą nagrodę za ten sam
-- wieczór opisuje osobny wiersz w hosted_plan.
legacy_created_plan as (
  select distinct
    event.user_id,
    'meeting_created'::text as action_type,
    'meeting'::text as entity_type,
    event.related_entity_id as entity_id,
    0 as target_points
  from public.point_events as event
  where event.action_type = 'meeting_created'
    and event.related_entity_type = 'meeting'
),

-- === Milestone'y Półki ======================================================
-- Milestone RAZ ZDOBYTY NIE ZNIKA. Warunkiem docelowym jest więc alternatywa:
-- albo użytkownik spełnia próg dzisiaj, albo ma już dodatnie saldo tego
-- milestone'u w księdze. Bez drugiego członu archiwizacja gry odbierałaby
-- Renomę za próg, którego domena nigdy nie cofa.
shelf_thresholds as (
  select *
  from (
    values
      (1, 'shelf_first_game'),
      (5, 'shelf_5_games'),
      (10, 'shelf_10_games'),
      (15, 'shelf_15_games')
  ) as threshold(required_games, action_type)
),
shelf_plan as (
  select
    rewardable.user_id,
    shelf_thresholds.action_type::text,
    'profile'::text as entity_type,
    rewardable.user_id as entity_id,
    case
      when (
        select count(*)
        from public.games as game
        where game.owner_id = rewardable.user_id
          and game.archived_at is null
      ) >= shelf_thresholds.required_games
      or coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = rewardable.user_id
          and event.action_type = shelf_thresholds.action_type
          and event.related_entity_type = 'profile'
          and event.related_entity_id = rewardable.user_id
      ), 0) > 0
      then private.point_reward_for(shelf_thresholds.action_type)
      else 0
    end as target_points
  from rewardable
  cross join shelf_thresholds
),

-- === Udział w partii ========================================================
-- Kwalifikacja wynika z kanonicznego stanu partii, nie z plays.rewards_managed
-- (patrz private.play_is_historically_rewardable). Kandydaci to uczestnicy
-- partii kwalifikujących się dzisiaj plus nagrody dziś aktywne, żeby dało się
-- je cofnąć.
play_candidates as (
  select participant.user_id, participant.play_id
  from public.play_participants as participant
  join rewardable on rewardable.user_id = participant.user_id
  where private.play_is_historically_rewardable(participant.play_id)
  union
  select state.user_id, state.reward_key::uuid as play_id
  from public.play_reward_states as state
  join rewardable on rewardable.user_id = state.user_id
  where state.reward_type = 'play_points'
    and state.is_active
),
play_plan as (
  select
    candidate.user_id,
    'play_participated'::text as action_type,
    'play'::text as entity_type,
    candidate.play_id as entity_id,
    case
      when exists (
        select 1
        from public.play_participants as participant
        where participant.play_id = candidate.play_id
          and participant.user_id = candidate.user_id
      )
      and private.play_is_historically_rewardable(candidate.play_id)
      then private.point_reward_for('play_participated')
      else 0
    end as target_points
  from play_candidates as candidate
),

-- === Domiatanie zdarzeń partii poza zasięgiem silnika =======================
-- private.apply_reward_delta pomija konta ukryte i nie tworzy stanu dla
-- nagrody, która nigdy nie była aktywna. Zdarzenia takich par nie zostałyby
-- więc nigdy skorygowane i zostałoby po nich 40 Renomy z V1. Zerujemy je
-- wprost, po stronie księgi.
play_orphan_plan as (
  select
    ledger.user_id,
    ledger.action_type,
    'play'::text as entity_type,
    ledger.entity_id,
    0 as target_points
  from (
    select
      event.user_id,
      event.action_type,
      event.related_entity_id as entity_id,
      sum(event.points) as net_points
    from public.point_events as event
    where event.action_type in ('play_logged', 'play_participated')
      and event.related_entity_type = 'play'
    group by event.user_id, event.action_type, event.related_entity_id
    having sum(event.points) <> 0
  ) as ledger
  where not exists (
    select 1
    from play_candidates as candidate
    where candidate.user_id = ledger.user_id
      and candidate.play_id = ledger.entity_id
  )
),

-- === Złożenie planu ==========================================================
combined as (
  select 'ledger'::text as reward_kind, * from rsvp_plan
  union all
  select 'ledger'::text, * from vote_plan
  union all
  select 'ledger'::text, * from rating_plan
  union all
  select 'ledger'::text, * from hosted_plan
  union all
  select 'ledger'::text, * from legacy_created_plan
  union all
  select 'ledger'::text, * from shelf_plan
  union all
  select 'play'::text, * from play_plan
  union all
  select 'ledger'::text, * from play_orphan_plan
),
scored as (
  select
    combined.user_id,
    combined.reward_kind,
    combined.action_type,
    combined.entity_type,
    combined.entity_id,
    combined.target_points,
    case
      when combined.reward_kind = 'play'
        then coalesce((
          select sum(event.points)
          from public.point_events as event
          where event.user_id = combined.user_id
            and event.action_type in ('play_participated', 'play_logged')
            and event.related_entity_type = 'play'
            and event.related_entity_id = combined.entity_id
        ), 0)
      else coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = combined.user_id
          and event.action_type = combined.action_type
          and event.related_entity_type = combined.entity_type
          and event.related_entity_id = combined.entity_id
      ), 0)
    end::integer as current_points
  from combined
)
select
  scored.user_id,
  scored.reward_kind,
  scored.action_type,
  scored.entity_type,
  scored.entity_id,
  scored.target_points,
  scored.current_points,
  (scored.target_points - scored.current_points)::integer as delta
from scored
-- Zero znaczy „już zgodne z V2”. To jest właśnie idempotencja: przy drugim
-- uruchomieniu plan jest pusty.
where scored.target_points <> scored.current_points
order by scored.user_id, scored.action_type, scored.entity_id;
$$;

revoke all on function private.economy_v2_reward_plan()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. PODGLĄD — wyłącznie odczyt
-- ---------------------------------------------------------------------------

-- Nie zapisuje ani jednego wiersza: brak INSERT/UPDATE, funkcja zadeklarowana
-- jako `stable`, więc Postgres odrzuci każdą próbę mutacji w jej ciele. Nie
-- oznacza też Economy V2 jako wykonanej — public.economy_rebase_runs zostaje
-- nietknięte.
create or replace function public.preview_economy_v2_rebase()
returns table (
  user_id uuid,
  display_name text,
  balance_before bigint,
  projected_balance_after bigint,
  delta bigint,
  breakdown jsonb
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
  with plan as (
    select * from private.economy_v2_reward_plan()
  ),
  member_balance as (
    select
      membership.user_id,
      coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = membership.user_id
      ), 0)::bigint as balance_before
    from public.app_members as membership
    where membership.is_active
  ),
  -- Stan bieżący rozbity na kubełki raportowe.
  current_buckets as (
    select
      event.user_id,
      private.economy_bucket(event.action_type) as bucket,
      sum(event.points)::bigint as points
    from public.point_events as event
    group by event.user_id, private.economy_bucket(event.action_type)
  ),
  -- Korekty planu rozbite na te same kubełki.
  plan_buckets as (
    select
      plan.user_id,
      private.economy_bucket(plan.action_type) as bucket,
      sum(plan.delta)::bigint as points
    from plan
    group by plan.user_id, private.economy_bucket(plan.action_type)
  ),
  -- Wartość DOCELOWA każdego źródła: stan bieżący plus korekta.
  projected_buckets as (
    select
      coalesce(current_buckets.user_id, plan_buckets.user_id) as user_id,
      coalesce(current_buckets.bucket, plan_buckets.bucket) as bucket,
      coalesce(current_buckets.points, 0) + coalesce(plan_buckets.points, 0)
        as points
    from current_buckets
    full outer join plan_buckets
      on plan_buckets.user_id = current_buckets.user_id
      and plan_buckets.bucket = current_buckets.bucket
  ),
  plan_totals as (
    select plan.user_id, sum(plan.delta)::bigint as total_delta
    from plan
    group by plan.user_id
  )
  select
    member_balance.user_id,
    profile.display_name,
    member_balance.balance_before,
    member_balance.balance_before + coalesce(plan_totals.total_delta, 0),
    coalesce(plan_totals.total_delta, 0),
    coalesce((
      select jsonb_object_agg(bucket.bucket, bucket.points)
      from projected_buckets as bucket
      where bucket.user_id = member_balance.user_id
    ), '{}'::jsonb)
  from member_balance
  join public.profiles as profile on profile.id = member_balance.user_id
  left join plan_totals on plan_totals.user_id = member_balance.user_id
  order by
    member_balance.balance_before + coalesce(plan_totals.total_delta, 0) desc,
    profile.display_name;
end;
$$;

revoke all on function public.preview_economy_v2_rebase()
  from public, anon, authenticated;
grant execute on function public.preview_economy_v2_rebase() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Zapis pojedynczej korekty księgowej
-- ---------------------------------------------------------------------------

-- Sprowadza saldo księgi dla jednej nagrody (user + action_type + encja) do
-- wartości docelowej, dopisując RÓŻNICĘ na kolejnej rewizji.
--
-- Rewizja jest istotna nie tylko dla unikalności: public.admin_reverse_point_
-- event odmawia odwrócenia zdarzenia, dla którego istnieje późniejsza ujemna
-- kompensata tej samej nagrody. Gdyby korekta poszła pod własnym action_type,
-- ten bezpiecznik przestałby ją widzieć i admin mógłby odjąć historyczne 10
-- Renomy jeszcze raz, po tym jak rebase zredukował je już do 2.
create or replace function private.rebase_point_reward(
  p_user_id uuid,
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid,
  p_delta integer,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_max_revision integer;
begin
  if p_delta = 0 then
    return 0;
  end if;

  select max(event.reward_revision)
  into v_max_revision
  from public.point_events as event
  where event.user_id = p_user_id
    and event.action_type = p_action_type
    and event.related_entity_type = p_entity_type
    and event.related_entity_id = p_entity_id;

  insert into public.point_events (
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by,
    reward_revision
  )
  values (
    p_user_id,
    p_delta,
    p_action_type,
    p_reason,
    p_entity_type,
    p_entity_id,
    p_user_id,
    coalesce(v_max_revision, -1) + 1
  );

  return p_delta;
end;
$$;

revoke all on function private.rebase_point_reward(
  uuid, text, text, uuid, integer, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. APPLY — świadome zastosowanie planu
-- ---------------------------------------------------------------------------

-- Wykonuje DOKŁADNIE ten sam plan, który pokazał podgląd. Idempotentne nie
-- przez znacznik, tylko przez konstrukcję: po pierwszym przebiegu plan jest
-- pusty, więc drugie uruchomienie nie zapisuje niczego.
create or replace function private.apply_economy_v2_rebase()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version constant text := 'economy_v2';
  v_reason constant text := 'Przeliczenie Economy V2';
  v_row record;
  v_events integer := 0;
  v_points bigint := 0;
  v_users integer := 0;
  v_diagnostics jsonb;
  v_legacy_plays integer;
  v_legacy_participations integer;
  v_admin_points integer;
  v_summary jsonb;
begin
  -- Migawka „PRZED” musi powstać zanim cokolwiek dopiszemy do księgi.
  -- EXECUTE zamiast zwykłego CREATE: bez tego drugie wywołanie w tej samej
  -- transakcji (tak testuje się idempotencję) trafiłoby w plan z cache'u
  -- odwołujący się do nieistniejącej już tabeli.
  execute 'drop table if exists t_economy_v2_before';
  execute $sql$
    create temporary table t_economy_v2_before on commit drop as
    select
      membership.user_id,
      coalesce((
        select sum(event.points)
        from public.point_events as event
        where event.user_id = membership.user_id
      ), 0)::bigint as balance_before
    from public.app_members as membership
    where membership.is_active = true
  $sql$;

  -- Plan materializujemy PRZED pierwszym zapisem. Bez tego kolejne iteracje
  -- czytałyby księgę już zmienioną przez poprzednie i różnice by się rozjechały
  -- względem tego, co pokazał podgląd.
  execute 'drop table if exists t_economy_v2_plan';
  execute $sql$
    create temporary table t_economy_v2_plan on commit drop as
    select * from private.economy_v2_reward_plan()
  $sql$;

  for v_row in
    select * from t_economy_v2_plan order by reward_kind, user_id, action_type, entity_id
  loop
    if v_row.reward_kind = 'play' then
      -- Nagroda ma stan w public.play_reward_states, więc zapis musi przejść
      -- przez silnik: on utrzyma rewizję, kompensatę i spójność stanu.
      if private.apply_reward_delta(
        v_row.user_id,
        'play_points',
        v_row.entity_id::text,
        v_row.target_points > 0,
        null,
        v_reason
      ) then
        v_events := v_events + 1;
      end if;
    else
      if private.rebase_point_reward(
        v_row.user_id, v_row.action_type, v_row.entity_type, v_row.entity_id,
        v_row.delta, v_reason
      ) <> 0 then
        v_events := v_events + 1;
      end if;
    end if;
  end loop;

  -- Diagnostyka: ile partii nadal nosi legacy reward-engine state. Po Economy
  -- V2 ta flaga NICZEGO nie bramkuje (patrz private.play_is_historically_
  -- rewardable), więc liczba jest wyłącznie informacyjna.
  select count(*)
  into v_legacy_plays
  from public.plays as play
  where play.status = 'completed'
    and not play.rewards_managed;

  select count(*)
  into v_legacy_participations
  from public.play_participants as participant
  join public.plays as play on play.id = participant.play_id
  where play.status = 'completed'
    and not play.rewards_managed;

  select coalesce(sum(event.points), 0)
  into v_admin_points
  from public.point_events as event
  where event.action_type like 'admin\_award:%'
     or event.action_type like 'admin\_reversal:%';

  v_diagnostics := jsonb_build_object(
    'legacy_reward_engine_plays', v_legacy_plays,
    'legacy_reward_engine_participations', v_legacy_participations,
    'admin_adjustment_points_untouched', v_admin_points
  );

  -- Sumaryczna zmiana liczona z sald, a nie z licznika pętli: nagrody za
  -- partie przechodzą przez private.apply_reward_delta, które zwraca wyłącznie
  -- informację „coś się zmieniło”, bez wartości korekty.
  select coalesce(sum(
    coalesce((
      select sum(event.points)
      from public.point_events as event
      where event.user_id = snapshot.user_id
    ), 0) - snapshot.balance_before
  ), 0)
  into v_points
  from t_economy_v2_before as snapshot;

  select count(*) into v_users from t_economy_v2_before;

  insert into public.economy_rebase_runs (
    version, applied_by, users_affected, events_written, points_delta, diagnostics
  )
  values (v_version, auth.uid(), v_users, v_events, v_points, v_diagnostics)
  on conflict (version) do nothing;

  -- Migawkę zapisujemy tylko przy pierwszym zastosowaniu: ma dokumentować
  -- rzeczywisty skok, a nie zerową różnicę z ponownego uruchomienia.
  insert into public.economy_rebase_user_totals (
    version, user_id, balance_before, balance_after, breakdown
  )
  select
    v_version,
    snapshot.user_id,
    snapshot.balance_before,
    coalesce((
      select sum(event.points)
      from public.point_events as event
      where event.user_id = snapshot.user_id
    ), 0)::bigint,
    coalesce((
      select jsonb_object_agg(bucket.source, bucket.points)
      from (
        select
          private.economy_bucket(event.action_type) as source,
          sum(event.points)::bigint as points
        from public.point_events as event
        where event.user_id = snapshot.user_id
        group by private.economy_bucket(event.action_type)
      ) as bucket
    ), '{}'::jsonb)
  from t_economy_v2_before as snapshot
  on conflict (version, user_id) do nothing;

  v_summary := jsonb_build_object(
    'version', v_version,
    'users', v_users,
    'events_written', v_events,
    'points_delta', v_points,
    'diagnostics', v_diagnostics
  );

  raise notice 'Economy V2 rebase: %', v_summary;

  return v_summary;
end;
$$;

revoke all on function private.apply_economy_v2_rebase()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 7. Świadomy brak automatycznego uruchomienia
-- ---------------------------------------------------------------------------
--
-- Ta migracja NIE woła private.apply_economy_v2_rebase(). Nowa ekonomia
-- zaczyna obowiązywać dla przyszłych zdarzeń natychmiast po jej zastosowaniu;
-- historyczne salda pozostają nietknięte do momentu świadomej decyzji.
--
-- Kolejność operatorska:
--   1. pnpm db:verify                        (migracje + pgTAP + typy)
--   2. select * from public.preview_economy_v2_rebase();   -- jako admin
--   3. akceptacja liczb
--   4. select private.apply_economy_v2_rebase();           -- psql, superuser
