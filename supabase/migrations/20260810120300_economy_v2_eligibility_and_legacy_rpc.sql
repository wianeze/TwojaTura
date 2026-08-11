-- Economy V2 — przegląd bezpieczeństwa wdrożenia (krok 4/4).
--
-- Dwie niezależne poprawki, obie wynikające z audytu przed produkcyjnym
-- preview. Żadna nie zmienia cennika ani zasad ekonomii.
--
-- ===========================================================================
-- A. UPRAWNIENIA ADMINISTRACYJNE ≠ KONTO POZA GRYWALIZACJĄ
-- ===========================================================================
--
-- Dotychczas Renomę pomijały konta o roli 'admin' ORAZ 'observer'. Reguła
-- powstała razem z rolą obserwatora (20260708000200) pod hasłem „ukryte
-- konta” i była wtedy poprawna dla obu ról naraz.
--
-- Audyt modelu użytkowników pokazuje jednak, że dla admina to za mocne:
--
--   * public.admin_change_role pozwala awansować DOWOLNEGO członka na admina
--     i z powrotem — rola jest przełącznikiem uprawnień, a nie oznaczeniem
--     osobnego, technicznego konta zakładanego innym torem,
--   * nie istnieje żadne pole ani warunek mówiący „to konto serwisowe”;
--     jedyne, co odróżnia admina od gracza, to zakres uprawnień,
--   * w grupie tej wielkości administratorem jest jeden z grających.
--
-- Skutek starej reguły: gracz, który dostaje uprawnienia administracyjne,
-- przestaje zarabiać Renomę — i to bez żadnego śladu w interfejsie. Po
-- Economy V2 byłoby jeszcze gorzej, bo rebase policzyłby mu historię jako
-- zerową.
--
-- Rozdzielamy więc oba pojęcia. Nowy predykat opisuje WYŁĄCZNIE kwalifikację
-- do grywalizacji i jest zbudowany z istniejącej semantyki — dokładnie tak
-- samo jak private.current_user_can_write(), tylko dla dowolnego odbiorcy.
-- Obserwator (konto podglądowe, bez prawa zapisu) nadal Renomy nie zbiera.
--
-- Ten sam predykat dostaje public.get_leaderboard (sekcja 5) — inaczej admin
-- zbierałby Renomę, której nigdzie nie widać.
--
-- Publiczny wygląd gracza w rankingu domyka sekcja 6 — wąska projekcja
-- profilu zamiast rozluźniania polityki na public.profiles, która trzyma też
-- adres e-mail.
--
-- ŚWIADOMIE POZA ZAKRESEM: same polityki SELECT na profiles/app_members
-- zostają bez zmian. Admin nie staje się przez to „zwykłym” wierszem w
-- listach członków — publiczne są wyłącznie dane, których potrzebuje ranking.
--
-- ===========================================================================
-- B. ZGODNOŚĆ WSTECZNA RPC NA CZAS DEPLOYU
-- ===========================================================================
--
-- Migracje bazy i deploy aplikacji nie dzieją się w tej samej sekundzie.
-- Między nimi wdrożona (stara) wersja frontu nadal odpytuje bazę. Inwentarz
-- wywołań `.rpc(...)` z aktualnego HEAD pokazuje jedno realne zderzenie:
--
--   public.award_meeting_created_points — wołane po KAŻDYM utworzeniu
--   spotkania (features/meetings/actions.ts). Po kroku 1/3 funkcja nie
--   istnieje, więc użytkownik dostałby komunikat „Spotkanie zostało zapisane,
--   ale nie udało się naliczyć punktów”.
--
--   public.award_play_logged_points — w HEAD nie jest już wołane, ale
--   przywracamy shim jako tanie zabezpieczenie przed starszym, zbuforowanym
--   klientem.
--
-- Obie funkcje wracają jako DEPRECATED wrappery. Żadna nie może przyznać
-- starej wartości: cennik ich typów nie zna, więc nawet gdyby ktoś próbował,
-- private.point_reward_for odrzuciłby akcję.

-- ---------------------------------------------------------------------------
-- 1. Kwalifikacja do grywalizacji
-- ---------------------------------------------------------------------------

create or replace function private.is_gamification_eligible(
  user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_active_member($1) and not private.is_observer($1);
$$;

comment on function private.is_gamification_eligible(uuid) is
  'Czy konto gromadzi Renomę i odznaki. Rola administratora NIE wyklucza — to zakres uprawnień, nie oznaczenie konta technicznego. Wyklucza wyłącznie obserwatora (konto podglądowe bez prawa zapisu) oraz konta nieaktywne. Jedyne źródło prawdy dla award_points_once, apply_reward_delta i planu Economy V2 — dzięki temu PODGLĄD i APPLY nie mogą użyć różnych reguł.';

revoke all on function private.is_gamification_eligible(uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Wpięcie predykatu w obie ścieżki przyznawania
-- ---------------------------------------------------------------------------

-- Ciało przepisane z 20260810120000 (lista typów spotkaniowych) — zmienia się
-- wyłącznie warunek odbiorcy.
create or replace function private.award_points_once(
  p_user_id uuid,
  p_action_type text,
  p_related_entity_type text,
  p_related_entity_id uuid,
  p_description text default null,
  p_created_by uuid default auth.uid()
)
returns table (
  awarded boolean,
  points integer,
  point_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  awarded_points integer;
  inserted_event_id uuid;
  event_created_by uuid;
begin
  if p_user_id is null then
    raise exception 'Point recipient is required' using errcode = '22023';
  end if;

  if p_related_entity_type is null
    or length(btrim(p_related_entity_type)) = 0
    or p_related_entity_id is null then
    raise exception 'Related entity type and id are required'
      using errcode = '22023';
  end if;

  if not private.is_active_member(p_user_id) then
    raise exception 'Point recipient must be an active member'
      using errcode = '42501';
  end if;

  -- Obserwator ogląda, nie gra. Admin gra jak każdy inny.
  if not private.is_gamification_eligible(p_user_id) then
    return query select false, 0, null::uuid;
    return;
  end if;

  if btrim(p_related_entity_type) = 'meeting'
    and p_action_type in (
      'meeting_hosted', 'meeting_created', 'meeting_rsvp', 'meeting_vote'
    )
    and exists (
      select 1
      from public.meetings
      where id = p_related_entity_id
        and deleted_at is not null
    ) then
    raise exception 'Active meeting is required before awarding points'
      using errcode = '22023';
  end if;

  awarded_points := private.point_reward_for(p_action_type);
  event_created_by := coalesce(p_created_by, p_user_id);

  insert into public.point_events (
    user_id,
    points,
    action_type,
    description,
    related_entity_type,
    related_entity_id,
    created_by
  )
  values (
    p_user_id,
    awarded_points,
    p_action_type,
    p_description,
    btrim(p_related_entity_type),
    p_related_entity_id,
    event_created_by
  )
  on conflict do nothing
  returning id into inserted_event_id;

  return query
  select
    inserted_event_id is not null,
    awarded_points,
    inserted_event_id;
end;
$$;

revoke all on function private.award_points_once(uuid, text, text, uuid, text, uuid)
from public, anon, authenticated;

-- Silnik nagród — ta sama zmiana warunku, reszta ciała bez zmian względem
-- 20260810120100.
create or replace function private.apply_reward_delta(
  p_user_id uuid,
  p_reward_type public.reward_type,
  p_reward_key text,
  p_should_be_active boolean,
  p_play_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state record;
  v_points integer;
  v_net integer;
  v_delta integer;
  v_next_revision integer;
  v_action_type text;
  v_entity_type text;
  v_entity_id uuid;
  v_description text;
  v_history_action public.achievement_history_action;
  v_actor uuid := coalesce(auth.uid(), p_user_id);
begin
  if not private.is_gamification_eligible(p_user_id) then
    return false;
  end if;

  if p_reward_type = 'play_points' then
    v_action_type := 'play_participated';
    v_entity_type := 'play';
    v_entity_id := p_reward_key::uuid;
    v_description := 'Udział w partii';
  else
    v_action_type := 'achievement_unlocked:' || p_reward_key;
    v_entity_type := 'profile';
    v_entity_id := p_user_id;
    v_description := coalesce(
      (
        select 'Odznaka: ' || definition.name
        from public.achievement_definitions as definition
        where definition.achievement_key = p_reward_key
      ),
      'Odznaka'
    );
  end if;

  select state.is_active, state.revision
  into v_state
  from public.play_reward_states as state
  where state.user_id = p_user_id
    and state.reward_type = p_reward_type
    and state.reward_key = p_reward_key
  for update;

  -- ==== ŚCIEŻKA A: brak stanu i nagroda nie powinna być aktywna ============
  if not found then
    if not p_should_be_active then
      return false;
    end if;

    -- ==== ŚCIEŻKA B: pierwsze przyznanie ==================================
    v_points := private.reward_points_for(p_reward_type, p_reward_key);
    v_net := private.reward_ledger_net(p_user_id, p_reward_type, p_reward_key);
    v_delta := v_points - v_net;

    insert into public.play_reward_states (
      user_id, reward_type, reward_key, is_active, revision, last_play_id
    )
    values (p_user_id, p_reward_type, p_reward_key, true, 0, p_play_id);

    if v_delta <> 0 then
      insert into public.point_events (
        user_id, points, action_type, description,
        related_entity_type, related_entity_id, created_by, reward_revision
      )
      values (
        p_user_id, v_delta, v_action_type, v_description,
        v_entity_type, v_entity_id, v_actor, 0
      )
      on conflict do nothing;
    end if;

    if p_reward_type = 'achievement' then
      insert into public.user_achievements (
        user_id, achievement_key, awarded_by, source_event_type, source_entity_id
      )
      values (
        p_user_id, p_reward_key, v_actor, 'reward_recompute', p_play_id
      )
      on conflict on constraint user_achievements_pkey do nothing;

      insert into public.achievement_history (
        user_id, achievement_key, action, revision, reason,
        triggered_by_play_id, created_by
      )
      values (
        p_user_id, p_reward_key, 'granted', 0, p_reason, p_play_id, v_actor
      );
    end if;

    return true;
  end if;

  -- ==== ŚCIEŻKA C: przynależność bez zmian, ale wartość mogła się zmienić ==
  if v_state.is_active = p_should_be_active then
    v_net := private.reward_ledger_net(p_user_id, p_reward_type, p_reward_key);
    v_points := case
      when p_should_be_active
        then private.reward_points_for(p_reward_type, p_reward_key)
      else 0
    end;
    v_delta := v_points - v_net;

    if v_delta = 0 then
      return false;
    end if;

    v_next_revision := v_state.revision + 1;

    insert into public.point_events (
      user_id, points, action_type, description,
      related_entity_type, related_entity_id, created_by, reward_revision
    )
    values (
      p_user_id, v_delta, v_action_type, p_reason,
      v_entity_type, v_entity_id, v_actor, v_next_revision
    );

    update public.play_reward_states as state
    set revision = v_next_revision,
        last_play_id = coalesce(p_play_id, state.last_play_id)
    where state.user_id = p_user_id
      and state.reward_type = p_reward_type
      and state.reward_key = p_reward_key;

    return true;
  end if;

  -- ==== ŚCIEŻKA D: zmiana przynależności ==================================
  v_next_revision := v_state.revision + 1;
  v_net := private.reward_ledger_net(p_user_id, p_reward_type, p_reward_key);

  if p_should_be_active then
    v_delta := private.reward_points_for(p_reward_type, p_reward_key) - v_net;
    v_history_action := 'regranted';
  else
    if v_net < 0 then
      raise exception
        'Niespójność księgi nagród dla %/%: saldo % jest ujemne.',
        p_reward_type, p_reward_key, v_net
        using errcode = '23514';
    end if;

    v_delta := -v_net;
    v_history_action := 'revoked';
  end if;

  if v_delta <> 0 then
    insert into public.point_events (
      user_id, points, action_type, description,
      related_entity_type, related_entity_id, created_by, reward_revision
    )
    values (
      p_user_id, v_delta, v_action_type,
      case when p_should_be_active then v_description else p_reason end,
      v_entity_type, v_entity_id, v_actor, v_next_revision
    );
  end if;

  if p_reward_type = 'achievement' then
    if p_should_be_active then
      insert into public.user_achievements (
        user_id, achievement_key, awarded_by, source_event_type, source_entity_id
      )
      values (
        p_user_id, p_reward_key, v_actor, 'reward_recompute', p_play_id
      )
      on conflict on constraint user_achievements_pkey do nothing;
    else
      perform private.revoke_achievement(p_user_id, p_reward_key);
    end if;

    insert into public.achievement_history (
      user_id, achievement_key, action, revision, reason,
      triggered_by_play_id, created_by
    )
    values (
      p_user_id, p_reward_key, v_history_action, v_next_revision,
      p_reason, p_play_id, v_actor
    );
  end if;

  update public.play_reward_states as state
  set is_active = p_should_be_active,
      revision = v_next_revision,
      last_play_id = p_play_id
  where state.user_id = p_user_id
    and state.reward_type = p_reward_type
    and state.reward_key = p_reward_key;

  return true;
end;
$$;

revoke all on function private.apply_reward_delta(
  uuid, public.reward_type, text, boolean, uuid, text
) from public, anon, authenticated;

-- Odznaki przyznaje ten sam silnik nagród, więc muszą znać tę samą regułę.
-- Ciało przepisane z 20260708000300, zmienia się wyłącznie warunek odbiorcy.
create or replace function private.award_achievement_once(
  p_user_id uuid,
  p_achievement_key text,
  p_source_event_type text default null,
  p_source_entity_id uuid default null,
  p_note text default null,
  p_awarded_by uuid default auth.uid()
)
returns table (
  awarded boolean,
  achievement_key text,
  awarded_at timestamptz,
  points_awarded integer,
  point_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  definition_name text;
  definition_points integer;
  inserted_at timestamptz;
  inserted_event_id uuid;
  event_created_by uuid;
begin
  if p_user_id is null then
    raise exception 'Achievement recipient is required' using errcode = '22023';
  end if;

  if not private.is_active_member(p_user_id) then
    raise exception 'Achievement recipient must be an active member'
      using errcode = '42501';
  end if;

  -- Ten sam pojedynczy punkt kontrolny co w private.award_points_once i ta
  -- sama reguła: uprawnienia administracyjne NIE wykluczają z grywalizacji,
  -- obserwator nadal tak. Bez tego admin zbierałby Renomę za partie
  -- (private.apply_reward_delta), ale nie dostawałby za nie odznak — a
  -- przyznaje je ten sam silnik.
  if not private.is_gamification_eligible(p_user_id) then
    return query select false, p_achievement_key, null::timestamptz, 0, null::uuid;
    return;
  end if;

  select definition.name, definition.points
  into definition_name, definition_points
  from public.achievement_definitions as definition
  where definition.achievement_key = p_achievement_key
    and definition.is_active = true;

  if not found then
    raise exception 'Achievement definition is missing or inactive: %', p_achievement_key
      using errcode = '22023';
  end if;

  event_created_by := coalesce(p_awarded_by, p_user_id);

  insert into public.user_achievements (
    user_id,
    achievement_key,
    awarded_by,
    source_event_type,
    source_entity_id,
    note
  )
  values (
    p_user_id,
    p_achievement_key,
    event_created_by,
    p_source_event_type,
    p_source_entity_id,
    p_note
  )
  on conflict on constraint user_achievements_pkey do nothing
  returning user_achievements.awarded_at into inserted_at;

  if inserted_at is not null and definition_points > 0 then
    insert into public.point_events (
      user_id,
      points,
      action_type,
      description,
      related_entity_type,
      related_entity_id,
      created_by
    )
    values (
      p_user_id,
      definition_points,
      'achievement_unlocked:' || p_achievement_key,
      'Odznaka: ' || definition_name,
      'profile',
      p_user_id,
      event_created_by
    )
    on conflict do nothing
    returning id into inserted_event_id;
  end if;

  return query
  select
    inserted_at is not null,
    p_achievement_key,
    inserted_at,
    case when inserted_event_id is not null then definition_points else 0 end,
    inserted_event_id;
end;
$$;

revoke all on function private.award_achievement_once(uuid, text, text, uuid, text, uuid)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Plan Economy V2 czyta ten sam predykat
-- ---------------------------------------------------------------------------

-- Wcześniej plan filtrował odbiorców po `role = 'member'`, czyli powielał
-- starą regułę w trzecim miejscu. Teraz PODGLĄD i APPLY korzystają dokładnie
-- z tej samej funkcji co bieżące przyznawanie — rozjazd między nimi przestaje
-- być możliwy z definicji, a nie tylko dzięki testowi.
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

-- Typ przechodzi w stan legacy: zdarzenia zostają w księdze i są audytowalne,
-- ale ich wpływ ekonomiczny schodzi do zera.
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
where scored.target_points <> scored.current_points
order by scored.user_id, scored.action_type, scored.entity_id;
$$;

revoke all on function private.economy_v2_reward_plan()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. DEPRECATED: wrappery zgodności wstecznej
-- ---------------------------------------------------------------------------

-- Wołane przez wdrożoną (starą) wersję aplikacji zaraz po utworzeniu
-- spotkania. Przekierowujemy na aktualną ścieżkę zamiast zwracać ślepy no-op:
-- w chwili tworzenia spotkanie ma status 'planned', więc wynikiem i tak jest
-- (false, 0, null), ale gdyby stary klient trafił tu dla wieczoru już
-- domkniętego, organizator dostanie POPRAWNE 5 Renomy zamiast niczego.
--
-- Czego ta funkcja NIE robi: nie zna typu 'meeting_created', więc nie ma
-- fizycznej możliwości przyznania dawnych 25 — private.point_reward_for
-- odrzuciłoby taką akcję.
create or replace function public.award_meeting_created_points(
  p_meeting_id uuid
)
returns table (
  awarded boolean,
  points integer,
  point_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  select *
  from public.award_meeting_hosted_points(p_meeting_id);
end;
$$;

comment on function public.award_meeting_created_points(uuid) is
  'DEPRECATED (Economy V2). Wyłącznie zgodność wsteczna dla wdrożonej wersji frontu, która woła tę funkcję po utworzeniu spotkania. Deleguje do public.award_meeting_hosted_points i NIE MOŻE przyznać dawnych 25 Renomy. Do usunięcia osobną migracją po wdrożeniu aplikacji korzystającej z award_meeting_hosted_points.';

revoke all on function public.award_meeting_created_points(uuid)
from public, anon, authenticated;
grant execute on function public.award_meeting_created_points(uuid)
to authenticated;

-- W aktualnym HEAD nikt tego już nie woła (nagrody za partię nalicza
-- przeliczanie wewnątrz create/update_play_with_participants), ale starszy
-- zbuforowany klient mógłby. Zamiast no-opu przekierowujemy na przeliczanie
-- uczestników: jest idempotentne i sprowadza księgę wyłącznie do stanu
-- poprawnego, więc nie da się nim niczego nafarmić.
--
-- Zwracamy (false, 0, null): nagroda nie należy się WOŁAJĄCEMU za operację w
-- UI, a stary klient traktował `awarded = false` jako nieszkodliwy no-op.
create or replace function public.award_play_logged_points(
  p_play_id uuid
)
returns table (
  awarded boolean,
  points integer,
  point_event_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_play_id is null or not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
  ) then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  perform private.recompute_play_rewards(
    private.play_reward_stakeholders(p_play_id),
    p_play_id,
    'Zgodność wsteczna: przeliczenie nagród za udział'
  );

  return query select false, 0, null::uuid;
end;
$$;

comment on function public.award_play_logged_points(uuid) is
  'DEPRECATED (Economy V2). Wyłącznie zgodność wsteczna dla starszych klientów. Nie przyznaje dawnych 40 Renomy autorowi wpisu — deleguje do idempotentnego przeliczenia nagród za UDZIAŁ. Do usunięcia osobną migracją po wdrożeniu aplikacji Economy V2.';

revoke all on function public.award_play_logged_points(uuid)
from public, anon, authenticated;
grant execute on function public.award_play_logged_points(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Leaderboard czyta tę samą regułę kwalifikacji
-- ---------------------------------------------------------------------------
--
-- public.get_leaderboard filtrowało `role = 'member'` — czwartą, ręcznie
-- powieloną kopię reguły „kto bierze udział w grywalizacji”. Po zmianie z
-- sekcji 1 admin zbiera Renomę i odznaki, więc pomijanie go w rankingu byłoby
-- wprost niespójne: punkty rosną, ale nigdzie ich nie widać.
--
-- Ciało przepisane z 20260708000300. Zmienia się WYŁĄCZNIE warunek
-- kwalifikacji: kolejność (rank po total_points desc, display_name, user_id),
-- sposób liczenia Renomy i kształt wyniku zostają bez zmian.
--
-- Warunek `membership.is_active` znika jako osobny człon, bo zawiera go już
-- private.is_gamification_eligible (przez private.is_active_member).
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
      and private.is_gamification_eligible(membership.user_id)
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
  'Ranking Renomy. Kwalifikacja pochodzi z private.is_gamification_eligible — tej samej reguły co przyznawanie punktów i odznak. Aktywny member i aktywny admin są widoczni; obserwator i konto nieaktywne nie.';

revoke all on function public.get_leaderboard() from public, anon, authenticated;
grant execute on function public.get_leaderboard() to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Publiczna projekcja profilu gracza na potrzeby rankingu
-- ---------------------------------------------------------------------------
--
-- Po sekcji 5 aktywny admin rankuje, ale jego wiersz wyglądał ubogo: bez klasy
-- postaci i bez ramki portretu. Powód jest wąski i warto go nazwać dokładnie,
-- bo reszta danych publicznych jest już dostępna:
--
--   display_name, avatar_url  — zwraca public.get_leaderboard (security
--                               definer), więc RLS ich nie dotyczy,
--   odznaki                   — user_achievements_select_visible pozwala
--                               każdemu aktywnemu członkowi czytać niesekretne
--                               odznaki innych aktywnych członków, BEZ filtru
--                               po roli,
--   active_class_key,         — czytane wprost z public.profiles, a polityka
--   active_portrait_frame_key   profiles_select_active_group przepuszcza tylko
--                               wiersze private.is_visible_member (role
--                               'member'). To jedyna luka.
--
-- ŚWIADOMIE NIE ROZLUŹNIAMY POLITYKI NA public.profiles. Tabela trzyma także
-- `email`; poszerzenie polityki wystawiłoby go razem z resztą kolumn. Zamiast
-- tego dajemy wąską projekcję: security definer z jawną listą kolumn, która
-- fizycznie nie ma jak zwrócić adresu e-mail ani żadnego pola administracyjnego.
--
-- Zakres wierszy to dokładnie ta sama reguła co ranking i przyznawanie nagród
-- (private.is_gamification_eligible), plus zawsze własny wiersz wołającego —
-- ten i tak jest dla niego widoczny przez `id = auth.uid()` w polityce
-- profiles, więc nie poszerza to niczyjego dostępu, a chroni Legendarium
-- obserwatora przed zgubieniem własnych danych.
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
      private.is_gamification_eligible(profiles.id)
      or profiles.id = auth.uid()
    );
$$;

comment on function public.get_public_player_profiles() is
  'Publiczna projekcja profilu gracza dla rankingu i Legendarium: nazwa, awatar, klasa postaci, ramka portretu. Jawna lista kolumn — email i pola administracyjne nie są tu osiągalne. Zakres wierszy: private.is_gamification_eligible (ta sama reguła co ranking i nagrody) plus własny wiersz wołającego.';

revoke all on function public.get_public_player_profiles()
from public, anon, authenticated;
grant execute on function public.get_public_player_profiles() to authenticated;
