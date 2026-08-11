-- Economy V2 — poprawka rebase'u dla historycznych kompensat `reversal:*`.
--
-- MIGRACJA FORWARD-ONLY. Migracje 20260810120000-120400 są już zastosowane na
-- produkcji (potwierdzone `migration list --linked`), więc poprawka trafia tu.
--
-- ===========================================================================
-- BŁĄD
-- ===========================================================================
--
-- public.delete_meeting przy miękkim usunięciu spotkania dopisuje kompensatę:
--
--     meeting_rsvp            +10   related_entity = ('meeting', X)
--     reversal:meeting_rsvp   -10   related_entity = ('meeting', X)   <- ta sama encja
--
-- Saldo historyczne tej nagrody wynosi więc 0 — i tak ma zostać.
--
-- private.economy_v2_reward_plan liczył jednak `current_points` po JEDNYM
-- action_type. Dla usuniętego spotkania widział „obecnie +10”, wartość docelową
-- 0, i zapisywał różnicę -10. Po zastosowaniu rebase’u saldo tej nagrody
-- wynosiło -10 zamiast 0: użytkownik zostawał ekonomicznie ukarany za to, że
-- stara nagroda została WCZEŚNIEJ PRAWIDŁOWO cofnięta.
--
-- To samo dotyczyło meeting_vote (-10) i meeting_created (-25 za spotkanie).
-- Skala rośnie liniowo z liczbą usuniętych spotkań.
--
-- ===========================================================================
-- RODZINA NAGRODY
-- ===========================================================================
--
-- Wartość docelowa musi być porównywana z saldem CAŁEJ ekonomicznej nagrody, a
-- nie z saldem jednego action_type. Rodzina to para:
--
--     <typ>  +  reversal:<typ>        (ta sama encja, ten sam użytkownik)
--
-- Które typy mają w ogóle kompensaty — sprawdzone, nie założone. Jedynym
-- producentem prefiksu `reversal:` w całym schemacie jest public.delete_meeting
-- (20260728120000, przepisane w 20260808120000 i 20260810120000). Jego lista
-- odwracanych typów to dokładnie:
--
--     meeting_hosted, meeting_created, meeting_rsvp, meeting_vote
--
-- Pozostałe typy (rating_created, shelf_*, play_*) nie mają dziś żadnego
-- producenta kompensat: partie cofa silnik nagród, dopisując zdarzenie pod TYM
-- SAMYM action_type na kolejnej rewizji, a nie pod prefiksem. Definicję rodziny
-- zapisujemy mimo to jednolicie — dla typów bez kompensat składnik sumuje się
-- do zera, a ewentualny przyszły producent nie zdoła wprowadzić tego błędu
-- ponownie.
--
-- ŚWIADOMIE POZA RODZINĄ: `admin_award:*` i `admin_reversal:*`. To jawne
-- decyzje administratora, celowo pozostawione poza automatycznym rebase — ta
-- migracja tego nie zmienia. Ich prefiks nie zaczyna się od `reversal:`, więc
-- nie wpadają do rodziny przypadkiem.
--
-- ===========================================================================
-- ZAKRES
-- ===========================================================================
--
-- Poprawka siedzi w JEDNYM miejscu: w planie, który jest wspólnym źródłem
-- obliczeń dla podglądu i zastosowania. Nie zmienia cennika, warunków
-- kwalifikacji, silnika nagród ani niczego w ekonomii — koryguje wyłącznie to,
-- względem czego liczona jest różnica.
--
-- Ani jednego DELETE i ani jednego UPDATE na public.point_events. Historyczne
-- pary (+nagroda, -kompensata) zostają nietknięte i audytowalne; poprawka
-- polega na tym, że rebase przestaje dopisywać do nich trzecie, zbędne
-- zdarzenie.

-- ---------------------------------------------------------------------------
-- 1. Saldo rodziny nagrody
-- ---------------------------------------------------------------------------

create or replace function private.reward_family_net(
  p_user_id uuid,
  p_action_type text,
  p_entity_type text,
  p_entity_id uuid
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(event.points), 0)::integer
  from public.point_events as event
  where event.user_id = p_user_id
    and event.action_type in (p_action_type, 'reversal:' || p_action_type)
    and event.related_entity_type = p_entity_type
    and event.related_entity_id = p_entity_id;
$$;

comment on function private.reward_family_net(uuid, text, text, uuid) is
  'Saldo księgi dla całej ekonomicznej nagrody: dodatni action_type razem z jego kompensatą `reversal:<typ>` na tej samej encji. Jedyny producent kompensat to public.delete_meeting (typy spotkaniowe); dla pozostałych typów drugi składnik jest pusty. Nie obejmuje admin_award:*/admin_reversal:* — te są celowo poza automatycznym rebase.';

revoke all on function private.reward_family_net(uuid, text, text, uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Kubełki raportowe rozpoznają kompensaty
-- ---------------------------------------------------------------------------

-- `reversal:X` trafia do kubełka X, a nie do „other”. Dzięki temu breakdown
-- pokazuje ekonomiczny stan docelowy źródła (nagroda i jej cofnięcie znoszą się
-- w tym samym wierszu), zamiast zostawiać osierocone ujemne saldo w koszu.
--
-- To zmiana RAPORTOWA. Właściwa poprawka salda jest w sekcji 3 — sam kubełek
-- niczego by nie naprawił.
create or replace function private.economy_bucket(p_action_type text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when normalized = 'meeting_rsvp' then 'meeting_rsvp'
    when normalized = 'meeting_vote' then 'meeting_vote'
    when normalized = 'rating_created' then 'rating_created'
    when normalized in ('meeting_hosted', 'meeting_created')
      then 'meeting_hosted'
    when normalized like 'shelf\_%' then 'shelf_milestones'
    when normalized in ('play_participated', 'play_logged')
      then 'play_participated'
    when normalized like 'achievement\_unlocked:%' then 'achievements'
    -- `admin_reversal:` NIE zaczyna się od `reversal:`, więc normalizacja go
    -- nie tyka i trafia tu w całości, razem z `admin_award:`.
    when normalized like 'admin\_award:%'
      or normalized like 'admin\_reversal:%'
      then 'admin_adjustments'
    else 'other'
  end
  from (
    select case
      when p_action_type like 'reversal:%'
        then substr(p_action_type, length('reversal:') + 1)
      else p_action_type
    end as normalized
  ) as stripped;
$$;

revoke all on function private.economy_bucket(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Plan — jedyne źródło obliczeń dla PODGLĄDU i APPLY
-- ---------------------------------------------------------------------------

-- Ciało przepisane z 20260810120300. Zmiany są dwie i obie dotyczą wyłącznie
-- tego, WZGLĘDEM CZEGO liczymy różnicę:
--
--   * `current_points` dla nagród księgowych liczy teraz saldo RODZINY
--     (private.reward_family_net) zamiast salda jednego action_type,
--   * zbiory par obejmują też pary widoczne wyłącznie przez kompensatę.
--
-- Wartości docelowe, warunki kwalifikacji i podział na reward_kind bez zmian.
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
  where private.is_gamification_eligible(membership.user_id)
),

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
  where event.action_type in ('meeting_rsvp', 'reversal:meeting_rsvp')
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

-- Migracja 20260730120000 PRZEMIANOWAŁA meeting_game_votes na
-- meeting_game_responses, więc głosy sprzed tamtej zmiany są dziś dokładnie
-- tymi samymi wierszami. Jedna tabela wystarcza.
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
  where event.action_type in ('meeting_vote', 'reversal:meeting_vote')
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

rating_domain as (
  select distinct rating.user_id, rating.game_id as entity_id
  from public.ratings as rating
),
rating_pairs as (
  select user_id, entity_id from rating_domain
  union
  select distinct event.user_id, event.related_entity_id
  from public.point_events as event
  where event.action_type in ('rating_created', 'reversal:rating_created')
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

-- „Faktycznie się odbyło” = status 'completed' i deleted_at is null.
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
  where event.action_type in ('meeting_hosted', 'reversal:meeting_hosted')
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

-- Typ legacy: zdarzenia zostają w księdze i są audytowalne, ale ich wpływ
-- ekonomiczny schodzi do zera. Jeżeli spotkanie zostało usunięte, para
-- (+25, -25) już się znosi i plan nie ma tu nic do zrobienia.
legacy_created_plan as (
  select distinct
    event.user_id,
    'meeting_created'::text as action_type,
    'meeting'::text as entity_type,
    event.related_entity_id as entity_id,
    0 as target_points
  from public.point_events as event
  where event.action_type in ('meeting_created', 'reversal:meeting_created')
    and event.related_entity_type = 'meeting'
),

-- Milestone RAZ ZDOBYTY NIE ZNIKA — stąd alternatywa w warunku.
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
      or private.reward_family_net(
        rewardable.user_id, shelf_thresholds.action_type,
        'profile', rewardable.user_id
      ) > 0
      then private.point_reward_for(shelf_thresholds.action_type)
      else 0
    end as target_points
  from rewardable
  cross join shelf_thresholds
),

-- Kwalifikacja wynika z kanonicznego stanu partii, nie z rewards_managed.
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

-- Zdarzenia partii poza zasięgiem silnika (konta niekwalifikujące się,
-- nagrody bez stanu) — zerowane wprost po stronie księgi.
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
      -- Nagroda za partię ma własną rodzinę: historyczne 'play_logged' i
      -- bieżące 'play_participated'. Cofnięcia idą tu przez silnik, pod tym
      -- samym action_type na kolejnej rewizji — nie przez prefiks 'reversal:'.
      when combined.reward_kind = 'play'
        then coalesce((
          select sum(event.points)
          from public.point_events as event
          where event.user_id = combined.user_id
            and event.action_type in ('play_participated', 'play_logged')
            and event.related_entity_type = 'play'
            and event.related_entity_id = combined.entity_id
        ), 0)
      -- Nagrody księgowe: saldo rodziny <typ> + reversal:<typ>.
      else private.reward_family_net(
        combined.user_id, combined.action_type,
        combined.entity_type, combined.entity_id
      )
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
where scored.target_points <> scored.current_points
order by scored.user_id, scored.action_type, scored.entity_id;
$$;

revoke all on function private.economy_v2_reward_plan()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Diagnostyka runu
-- ---------------------------------------------------------------------------

-- Ciało przepisane z 20260810120200. Jedyna zmiana to dodatkowy licznik w
-- `diagnostics`: ile historycznych kompensat rebase świadomie zostawił w
-- spokoju, zamiast dopisywać do nich kolejne zdarzenie.
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
  v_reversal_families integer;
  v_reversal_points integer;
  v_summary jsonb;
begin
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

  execute 'drop table if exists t_economy_v2_plan';
  execute $sql$
    create temporary table t_economy_v2_plan on commit drop as
    select * from private.economy_v2_reward_plan()
  $sql$;

  for v_row in
    select * from t_economy_v2_plan order by reward_kind, user_id, action_type, entity_id
  loop
    if v_row.reward_kind = 'play' then
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

  -- Historyczne pary (+nagroda, -kompensata), które rebase zostawił w spokoju,
  -- bo ich saldo rodziny już wynosi tyle, ile ma wynosić.
  select count(*), coalesce(sum(net_points), 0)
  into v_reversal_families, v_reversal_points
  from (
    select
      event.user_id,
      event.related_entity_id,
      substr(event.action_type, length('reversal:') + 1) as base_action,
      sum(event.points) as net_points
    from public.point_events as event
    where event.action_type like 'reversal:%'
    group by event.user_id, event.related_entity_id, event.action_type
  ) as compensated;

  v_diagnostics := jsonb_build_object(
    'legacy_reward_engine_plays', v_legacy_plays,
    'legacy_reward_engine_participations', v_legacy_participations,
    'admin_adjustment_points_untouched', v_admin_points,
    'legacy_reversals_neutralized', v_reversal_families,
    'legacy_reversal_points', v_reversal_points
  );

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
