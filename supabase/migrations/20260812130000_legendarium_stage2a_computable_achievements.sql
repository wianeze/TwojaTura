-- Legendarium — Etap 2A: achievementy wyliczalne z istniejących danych.
--
-- Migracja instaluje predykaty, bieżący recompute oraz operatorski PREVIEW/APPLY.
-- Nie uruchamia historycznego backfillu ani APPLY automatycznie.

-- ---------------------------------------------------------------------------
-- 1. Katalog i zależności domenowe
-- ---------------------------------------------------------------------------

update public.achievement_definitions
set automation_status = case when is_secret then 'secret' else 'automatic' end,
    is_manual = false,
    condition_text = case achievement_key
      when 'tadpole_enjoyer' then
        'Ukończ partię gry, którą wcześniej oceniłeś lub oceniłaś na 5/10 albo mniej.'
      when 'save_scummer' then
        'Weź udział w 3 ukończonych partiach tej samej gry w ciągu 7 dni.'
      when 'vicious_mockery' then
        'Dodaj 3 oceny nie większe niż 3/10 wraz z komentarzem.'
      when 'legendary_artifact' then
        'Weź udział w ukończonej partii gry wydanej przed 2000 rokiem.'
      when 'resurrection' then
        'Wróć do tej samej gry po przerwie wynoszącej co najmniej 365 dni.'
      when 'oathbreaker' then
        'Zagraj ponownie w grę po wcześniejszym oznaczeniu, że nie chcesz w nią zagrać ponownie.'
      when 'skill_issue' then
        'Zajmij ostatnie miejsce w 3 kolejnych, jednoznacznie sklasyfikowanych partiach konkurencyjnych.'
      when 'friendly_fire' then
        'Weź udział w 3 przegranych, ukończonych partiach kooperacyjnych.'
      when 'time_traveler' then
        'Weź udział w ukończonych partiach gier z 4 różnych dekad wydania.'
      when 'final_boss' then
        'Wygraj ukończoną partię gry z trudnością BGG co najmniej 4,0.'
      when 'boss_defeated' then
        'Wygraj ukończoną partię kooperacyjną gry z trudnością BGG co najmniej 3,5.'
      else condition_text
    end
where achievement_key in (
  'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
  'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
  'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
);

insert into public.achievement_domain_dependencies (achievement_key, domain)
values
  ('tadpole_enjoyer', 'play'),
  ('tadpole_enjoyer', 'rating'),
  ('save_scummer', 'play'),
  ('vicious_mockery', 'rating'),
  ('legendary_artifact', 'play'),
  ('resurrection', 'play'),
  ('oathbreaker', 'play'),
  ('oathbreaker', 'rating'),
  ('skill_issue', 'play'),
  ('friendly_fire', 'play'),
  ('time_traveler', 'play'),
  ('final_boss', 'play'),
  ('boss_defeated', 'play')
on conflict do nothing;

update public.achievement_definitions
set reward_domain = case
  when achievement_key = 'vicious_mockery' then 'rating'::public.reward_domain
  else 'play'::public.reward_domain
end
where achievement_key in (
  'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
  'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
  'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
);

-- ---------------------------------------------------------------------------
-- 2. Predykaty
-- ---------------------------------------------------------------------------

create or replace function private.has_three_consecutive_real_last_places(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with ranked_history as (
    select
      play.id,
      play.played_at,
      play.created_at,
      target.placement = ranking.last_placement as is_last
    from public.play_participants as target
    join public.plays as play on play.id = target.play_id
    cross join lateral (
      select
        count(*) as participant_count,
        count(*) filter (where participant.placement is not null) as placed_count,
        count(distinct participant.placement) as distinct_places,
        max(participant.placement) as last_placement
      from public.play_participants as participant
      where participant.play_id = play.id
    ) as ranking
    where target.user_id = p_user_id
      and play.status = 'completed'::public.play_status
      and play.mode = 'competitive'::public.play_mode
      and target.placement is not null
      and ranking.participant_count >= 2
      and ranking.placed_count = ranking.participant_count
      and ranking.distinct_places >= 2
  ), streaks as (
    select
      is_last,
      lag(is_last, 1) over chronology as previous_is_last,
      lag(is_last, 2) over chronology as second_previous_is_last
    from ranked_history
    window chronology as (order by played_at, created_at, id)
  )
  select exists (
    select 1
    from streaks
    where is_last
      and previous_is_last
      and second_previous_is_last
  );
$$;

revoke all on function private.has_three_consecutive_real_last_places(uuid)
  from public, anon, authenticated;

alter function private.qualifies_for_achievement(uuid, text)
  rename to qualifies_for_achievement_before_legendarium_stage2a;

create or replace function private.qualifies_for_achievement(
  p_user_id uuid,
  p_achievement_key text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or p_achievement_key is null then
    return false;
  end if;

  case p_achievement_key
    when 'tadpole_enjoyer' then
      return exists (
        select 1
        from public.ratings as rating
        join public.plays as play on play.game_id = rating.game_id
        join public.play_participants as participant
          on participant.play_id = play.id
         and participant.user_id = rating.user_id
        where rating.user_id = p_user_id
          and rating.overall <= 5
          and rating.updated_at < play.played_at
          and play.status = 'completed'::public.play_status
      );

    when 'save_scummer' then
      return exists (
        select 1
        from public.play_participants as first_participation
        join public.plays as first_play on first_play.id = first_participation.play_id
        join public.plays as window_play
          on window_play.game_id = first_play.game_id
         and window_play.status = 'completed'::public.play_status
         and window_play.played_at >= first_play.played_at
         and window_play.played_at <= first_play.played_at + interval '7 days'
        join public.play_participants as window_participation
          on window_participation.play_id = window_play.id
         and window_participation.user_id = p_user_id
        where first_participation.user_id = p_user_id
          and first_play.status = 'completed'::public.play_status
        group by first_play.id
        having count(distinct window_play.id) >= 3
      );

    when 'vicious_mockery' then
      return (
        select count(*)
        from public.ratings as rating
        where rating.user_id = p_user_id
          and rating.overall <= 3
          and nullif(btrim(rating.comment), '') is not null
      ) >= 3;

    when 'legendary_artifact' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        join public.games as game on game.id = play.game_id
        where participant.user_id = p_user_id
          and play.status = 'completed'::public.play_status
          and game.release_year < 2000
      );

    when 'resurrection' then
      return exists (
        select 1
        from (
          select
            play.played_at,
            lag(play.played_at) over (
              partition by play.game_id
              order by play.played_at, play.created_at, play.id
            ) as previous_played_at
          from public.play_participants as participant
          join public.plays as play on play.id = participant.play_id
          where participant.user_id = p_user_id
            and play.status = 'completed'::public.play_status
        ) as history
        where history.previous_played_at is not null
          and history.played_at - history.previous_played_at >= interval '365 days'
      );

    when 'oathbreaker' then
      -- ratings nie przechowuje historii zmian. Wiarygodny jest wyłącznie
      -- aktualny stan NIE, którego ostatnia aktualizacja poprzedza partię.
      return exists (
        select 1
        from public.ratings as rating
        join public.plays as play on play.game_id = rating.game_id
        join public.play_participants as participant
          on participant.play_id = play.id
         and participant.user_id = rating.user_id
        where rating.user_id = p_user_id
          and rating.wants_to_play_again = false
          and rating.updated_at < play.played_at
          and play.status = 'completed'::public.play_status
      );

    when 'skill_issue' then
      return private.has_three_consecutive_real_last_places(p_user_id);

    when 'friendly_fire' then
      return (
        select count(distinct play.id)
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.status = 'completed'::public.play_status
          and play.mode = 'cooperative'::public.play_mode
          and play.team_result = 'loss'::public.play_team_result
      ) >= 3;

    when 'time_traveler' then
      return (
        select count(distinct (game.release_year / 10))
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        join public.games as game on game.id = play.game_id
        where participant.user_id = p_user_id
          and play.status = 'completed'::public.play_status
          and game.release_year is not null
      ) >= 4;

    when 'final_boss' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        join public.games as game on game.id = play.game_id
        where participant.user_id = p_user_id
          and participant.is_winner = true
          and play.status = 'completed'::public.play_status
          and game.bgg_weight >= 4.0
      );

    when 'boss_defeated' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        join public.games as game on game.id = play.game_id
        where participant.user_id = p_user_id
          and play.status = 'completed'::public.play_status
          and play.mode = 'cooperative'::public.play_mode
          and play.team_result = 'win'::public.play_team_result
          and game.bgg_weight >= 3.5
      );

    else
      return private.qualifies_for_achievement_before_legendarium_stage2a(
        p_user_id,
        p_achievement_key
      );
  end case;
end;
$$;

revoke all on function private.qualifies_for_achievement(uuid, text)
  from public, anon, authenticated;
revoke all on function private.qualifies_for_achievement_before_legendarium_stage2a(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bieżący recompute po ocenie i operatorski recompute historyczny
-- ---------------------------------------------------------------------------

alter function public.award_current_user_simple_achievements()
  rename to award_current_user_simple_achievements_before_legendarium_stage2a;
alter function public.award_current_user_simple_achievements_before_legendarium_stage2a()
  set schema private;

revoke all on function private.award_current_user_simple_achievements_before_legendarium_stage2a()
  from public, anon, authenticated;

create or replace function public.award_current_user_simple_achievements()
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_keys text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_base record;
  v_key text;
  v_before_unlocked boolean;
  v_after_unlocked boolean;
  v_before_points integer;
  v_after_points integer;
  v_count integer := 0;
  v_points integer := 0;
  v_keys text[] := array[]::text[];
begin
  if v_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_active_member(v_user_id) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  select * into v_base
  from private.award_current_user_simple_achievements_before_legendarium_stage2a();

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

  v_count := coalesce(v_base.awarded_count, 0);
  v_points := coalesce(v_base.points_awarded, 0);
  v_keys := coalesce(v_base.awarded_keys, array[]::text[]);

  foreach v_key in array array[
    'tadpole_enjoyer', 'vicious_mockery', 'oathbreaker'
  ]::text[]
  loop
    v_before_unlocked := exists (
      select 1
      from public.user_achievements as earned
      where earned.user_id = v_user_id
        and earned.achievement_key = v_key
    );
    v_before_points := private.reward_ledger_net(v_user_id, 'achievement', v_key);

    perform private.apply_reward_delta(
      v_user_id,
      'achievement',
      v_key,
      private.qualifies_for_achievement(v_user_id, v_key),
      null,
      'legendarium_stage2a_rating_recompute'
    );

    v_after_unlocked := exists (
      select 1
      from public.user_achievements as earned
      where earned.user_id = v_user_id
        and earned.achievement_key = v_key
    );
    v_after_points := private.reward_ledger_net(v_user_id, 'achievement', v_key);

    if not v_before_unlocked and v_after_unlocked then
      v_count := v_count + 1;
      v_points := v_points + greatest(v_after_points - v_before_points, 0);
      v_keys := array_append(v_keys, v_key);
    end if;
  end loop;

  return query select v_count, v_points, v_keys;
end;
$$;

revoke all on function public.award_current_user_simple_achievements()
  from public, anon, authenticated;
grant execute on function public.award_current_user_simple_achievements()
  to authenticated;

create or replace function private.recompute_legendarium_stage2a_achievements(
  p_user_ids uuid[] default null,
  p_play_id uuid default null,
  p_reason text default 'legendarium_stage2a_recompute'
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_key text;
  v_changes integer := 0;
begin
  for v_user_id in
    select membership.user_id
    from public.app_members as membership
    where private.is_gamification_eligible(membership.user_id)
      and (
        p_user_ids is null
        or membership.user_id = any(p_user_ids)
        or exists (
          select 1
          from public.play_reward_states as state
          where state.user_id = membership.user_id
            and state.reward_type = 'achievement'
            and state.reward_key in (
              'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
              'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
              'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
            )
            and state.is_active
        )
      )
    order by membership.user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

    foreach v_key in array array[
      'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
      'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
      'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
    ]::text[]
    loop
      if private.apply_reward_delta(
        v_user_id,
        'achievement',
        v_key,
        private.qualifies_for_achievement(v_user_id, v_key),
        p_play_id,
        p_reason
      ) then
        v_changes := v_changes + 1;
      end if;
    end loop;
  end loop;

  return v_changes;
end;
$$;

revoke all on function private.recompute_legendarium_stage2a_achievements(uuid[], uuid, text)
  from public, anon, authenticated;

-- Każda kontrolowana zmiana uczestników/wyników Kroniki przechodzi już przez
-- ten wspólny helper. Wrapper zachowuje dotychczasowe nagrody i dopina Etap 2A
-- bez nowego publicznego RPC.
alter function private.recompute_play_rewards(uuid[], uuid, text)
  rename to recompute_play_rewards_before_legendarium_stage2a;

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
  v_changes := private.recompute_play_rewards_before_legendarium_stage2a(
    p_user_ids,
    p_play_id,
    p_reason
  );

  return v_changes + private.recompute_legendarium_stage2a_achievements(
    p_user_ids,
    p_play_id,
    p_reason
  );
end;
$$;

revoke all on function private.recompute_play_rewards(uuid[], uuid, text)
  from public, anon, authenticated;
revoke all on function private.recompute_play_rewards_before_legendarium_stage2a(uuid[], uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Read-only PREVIEW i niewywoływany automatycznie APPLY
-- ---------------------------------------------------------------------------

create or replace function private.legendarium_stage2a_reconciliation_plan()
returns table (
  user_id uuid,
  achievement_key text,
  current_unlocked boolean,
  target_unlocked boolean,
  current_points integer,
  target_points integer,
  delta integer
)
language sql
stable
security definer
set search_path = ''
as $$
  with stage2_keys(achievement_key) as (
    values
      ('tadpole_enjoyer'), ('save_scummer'), ('vicious_mockery'),
      ('legendary_artifact'), ('resurrection'), ('oathbreaker'),
      ('skill_issue'), ('friendly_fire'), ('time_traveler'),
      ('final_boss'), ('boss_defeated')
  ), candidates as (
    select membership.user_id, definition.achievement_key, definition.points
    from public.app_members as membership
    cross join stage2_keys as key
    join public.achievement_definitions as definition
      on definition.achievement_key = key.achievement_key
    where definition.is_active = true
      and (
        private.is_gamification_eligible(membership.user_id)
        or exists (
          select 1 from public.user_achievements as earned
          where earned.user_id = membership.user_id
            and earned.achievement_key = definition.achievement_key
        )
        or exists (
          select 1 from public.point_events as event
          where event.user_id = membership.user_id
            and event.action_type = 'achievement_unlocked:' || definition.achievement_key
            and event.related_entity_type = 'profile'
            and event.related_entity_id = membership.user_id
        )
      )
  ), states as (
    select
      candidate.*,
      exists (
        select 1 from public.user_achievements as earned
        where earned.user_id = candidate.user_id
          and earned.achievement_key = candidate.achievement_key
      ) as current_unlocked,
      private.is_gamification_eligible(candidate.user_id)
        and private.qualifies_for_achievement(
          candidate.user_id,
          candidate.achievement_key
        ) as target_unlocked,
      private.reward_ledger_net(
        candidate.user_id,
        'achievement',
        candidate.achievement_key
      ) as current_points
    from candidates as candidate
  )
  select
    states.user_id,
    states.achievement_key,
    states.current_unlocked,
    states.target_unlocked,
    states.current_points,
    case when states.target_unlocked then states.points else 0 end,
    (case
      when states.target_unlocked then states.points
      else 0
    end)
      - states.current_points
  from states;
$$;

revoke all on function private.legendarium_stage2a_reconciliation_plan()
  from public, anon, authenticated;

create or replace function public.preview_legendarium_stage2a_reconciliation()
returns table (
  user_id uuid,
  display_name text,
  achievement_key text,
  achievement_name text,
  proposed_change text,
  current_renown integer,
  projected_renown integer,
  renown_delta integer,
  reason text
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
    plan.achievement_key,
    definition.name,
    case
      when not plan.current_unlocked and plan.target_unlocked then 'unlock'
      when plan.current_unlocked and not plan.target_unlocked then 'revoke'
      else 'renown_adjustment'
    end,
    plan.current_points,
    plan.target_points,
    plan.delta,
    definition.condition_text
  from private.legendarium_stage2a_reconciliation_plan() as plan
  join public.profiles as profile on profile.id = plan.user_id
  join public.achievement_definitions as definition
    on definition.achievement_key = plan.achievement_key
  where plan.current_unlocked is distinct from plan.target_unlocked
     or plan.delta <> 0
  order by profile.display_name, plan.achievement_key;
end;
$$;

revoke all on function public.preview_legendarium_stage2a_reconciliation()
  from public, anon, authenticated;
grant execute on function public.preview_legendarium_stage2a_reconciliation()
  to authenticated;

create or replace function private.apply_legendarium_stage2a_reconciliation()
returns table (
  achievement_changes integer,
  renown_events integer,
  renown_delta bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_plan record;
  v_achievement_changes integer := 0;
  v_renown_events integer := 0;
  v_renown_delta bigint := 0;
  v_current_points integer;
begin
  if auth.uid() is not null and not private.is_admin() then
    raise exception 'Administrator access is required' using errcode = '42501';
  end if;

  insert into public.play_reward_states (
    user_id, reward_type, reward_key, is_active, revision, last_play_id
  )
  select
    earned.user_id,
    'achievement'::public.reward_type,
    earned.achievement_key,
    true,
    coalesce((
      select max(event.reward_revision)
      from public.point_events as event
      where event.user_id = earned.user_id
        and event.action_type = 'achievement_unlocked:' || earned.achievement_key
        and event.related_entity_type = 'profile'
        and event.related_entity_id = earned.user_id
    ), 0),
    null
  from public.user_achievements as earned
  where earned.achievement_key in (
    'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
    'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
    'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
  )
  on conflict do nothing;

  v_achievement_changes := private.recompute_legendarium_stage2a_achievements(
    null,
    null,
    'legendarium_stage2a_backfill'
  );

  for v_plan in
    select
      earned.user_id,
      earned.achievement_key,
      definition.points as target_points
    from public.user_achievements as earned
    join public.achievement_definitions as definition
      on definition.achievement_key = earned.achievement_key
    where earned.achievement_key in (
      'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
      'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
      'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
    )
      and private.qualifies_for_achievement(
        earned.user_id,
        earned.achievement_key
      )
  loop
    v_current_points := private.reward_ledger_net(
      v_plan.user_id,
      'achievement',
      v_plan.achievement_key
    );

    if private.reconcile_achievement_renown(
      v_plan.user_id,
      v_plan.achievement_key,
      v_plan.target_points
    ) then
      v_renown_events := v_renown_events + 1;
      v_renown_delta := v_renown_delta
        + v_plan.target_points
        - v_current_points;
    end if;
  end loop;

  return query select v_achievement_changes, v_renown_events, v_renown_delta;
end;
$$;

comment on function private.apply_legendarium_stage2a_reconciliation() is
  'Operatorski, idempotentny APPLY Etapu 2A. Migracja nie wywołuje go automatycznie.';

revoke all on function private.apply_legendarium_stage2a_reconciliation()
  from public, anon, authenticated;
