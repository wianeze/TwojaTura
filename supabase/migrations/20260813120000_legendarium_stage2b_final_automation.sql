-- Legendarium Stage 2B: finalny batch automatyzacji i repurpose.
--
-- Migracja jest forward-only. Nie uruchamia historycznego APPLY. Hot Take jest
-- celowo forward-only: przyznaje się wyłącznie w chwili INSERT/UPDATE oceny.

-- ---------------------------------------------------------------------------
-- 1. Katalog, statusy i zależności domenowe
-- ---------------------------------------------------------------------------

update public.achievement_definitions
set automation_status = case when is_secret then 'secret' else 'automatic' end,
    is_manual = false,
    condition_text = case achievement_key
      when 'candlekeep_sage' then
        'Weź udział w ukończonych partiach 10 różnych gier o trudności BGG co najmniej 3,5.'
      when 'hot_take' then
        'Oceń grę co najmniej 4 punkty inaczej niż średnia minimum 3 pozostałych graczy.'
      when 'glass_cannon' then
        'W 5 kolejnych ukończonych partiach konkurencyjnych zajmij wyłącznie pierwsze albo ostatnie miejsce.'
      when 'git_gud' then
        'W tej samej grze przegraj 3 kolejne swoje partie, a następną wygraj.'
      when 'no_save_found' then
        'Po 3 kolejnych porażkach w tej samej grze zagraj w nią ponownie po raz czwarty, niezależnie od wyniku.'
      when 'the_absolute' then
        'Wygraj grę rozegraną po jednogłośnym wyborze minimum 3 głosujących na spotkaniu.'
      when 'critical_success_question_mark' then
        'Wygraj ukończoną partię gry, którą wcześniej oceniłeś na 4 lub mniej.'
      when 'redemption_arc' then
        'Po 3 kolejnych ostatnich miejscach w partiach konkurencyjnych zajmij 1. miejsce w następnej takiej partii.'
      when 'hot_streak' then
        'Wygraj 5 kolejnych ukończonych partii.'
      else condition_text
    end
where achievement_key in (
  'candlekeep_sage', 'hot_take', 'glass_cannon', 'git_gud',
  'no_save_found', 'the_absolute', 'critical_success_question_mark',
  'redemption_arc', 'hot_streak'
);

-- Metadane gier są tablicami swobodnego tekstu i mogą pochodzić z BGG albo z
-- ręcznego formularza. Bez identyfikatorów/źródła nie są stabilnym kontraktem.
update public.achievement_definitions
set automation_status = case
      when is_secret then 'secret'
      else 'planned'
    end,
    is_manual = false
where achievement_key in (
  'bone_breaker', 'table_rogue', 'tavern_brawler', 'multiclass',
  'chosen_of_the_table', 'dice_speak'
);

update public.achievement_definitions
set reward_domain = 'play'::public.reward_domain
where achievement_key in ('redemption_arc');

insert into public.achievement_domain_dependencies (achievement_key, domain)
values
  ('candlekeep_sage', 'play'),
  ('hot_take', 'rating'),
  ('glass_cannon', 'play'),
  ('git_gud', 'play'),
  ('no_save_found', 'play'),
  ('the_absolute', 'meeting'),
  ('the_absolute', 'play'),
  ('critical_success_question_mark', 'rating'),
  ('critical_success_question_mark', 'play'),
  ('redemption_arc', 'play'),
  ('hot_streak', 'play')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Wspólne predykaty
-- ---------------------------------------------------------------------------

create or replace function private.play_has_real_ranking(p_play_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plays as play
    join public.play_participants as participant on participant.play_id = play.id
    where play.id = $1
      and play.status = 'completed'::public.play_status
      and play.mode = 'competitive'::public.play_mode
    group by play.id
    having count(*) >= 2
       and count(*) filter (where participant.placement is null) = 0
       and count(distinct participant.placement) >= 2
  );
$$;

revoke all on function private.play_has_real_ranking(uuid)
  from public, anon, authenticated;

create or replace function private.rating_is_hot_take(
  p_user_id uuid,
  p_game_id uuid,
  p_overall integer
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select count(*) >= 3
       and abs($3::numeric - avg(other_rating.overall::numeric)) >= 4.0
    from public.ratings as other_rating
    where other_rating.game_id = $2
      and other_rating.user_id <> $1
  ), false);
$$;

revoke all on function private.rating_is_hot_take(uuid, uuid, integer)
  from public, anon, authenticated;

alter function private.qualifies_for_achievement(uuid, text)
  rename to qualifies_for_achievement_before_legendarium_stage2b;

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

  -- Stage 2B jest sticky: prawidłowo zdobytej odznaki nie odbieramy po
  -- późniejszej zmianie ratingu lub historii domenowej.
  if p_achievement_key in (
    'candlekeep_sage', 'hot_take', 'glass_cannon', 'git_gud',
    'no_save_found', 'the_absolute', 'critical_success_question_mark',
    'redemption_arc', 'hot_streak'
  ) and exists (
    select 1
    from public.user_achievements as earned
    where earned.user_id = p_user_id
      and earned.achievement_key = p_achievement_key
  ) then
    return true;
  end if;

  case p_achievement_key
    when 'candlekeep_sage' then
      return (
        select count(distinct play.game_id)
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        join public.games as game on game.id = play.game_id
        where participant.user_id = p_user_id
          and play.status = 'completed'::public.play_status
          and game.bgg_weight >= 3.5
      ) >= 10;

    when 'hot_take' then
      -- Brak historycznej osi zmian ratingów: tylko trigger poniżej może
      -- utworzyć nowy unlock. Predykat chroni już zdobyty sticky badge.
      return false;

    when 'glass_cannon' then
      return exists (
        select 1
        from (
          select
            result.is_extreme,
            lag(result.is_extreme, 1) over chronology as previous_extreme,
            lag(result.is_extreme, 2) over chronology as second_previous_extreme,
            lag(result.is_extreme, 3) over chronology as third_previous_extreme,
            lag(result.is_extreme, 4) over chronology as fourth_previous_extreme
          from (
            select
              play.id,
              play.played_at,
              play.created_at,
              participant.placement = 1
                or participant.placement = (
                  select max(other_participant.placement)
                  from public.play_participants as other_participant
                  where other_participant.play_id = play.id
                ) as is_extreme
            from public.play_participants as participant
            join public.plays as play on play.id = participant.play_id
            where participant.user_id = p_user_id
              and private.play_has_real_ranking(play.id)
          ) as result
          window chronology as (
            order by result.played_at, result.created_at, result.id
          )
        ) as streak
        where streak.is_extreme
          and streak.previous_extreme
          and streak.second_previous_extreme
          and streak.third_previous_extreme
          and streak.fourth_previous_extreme
      );

    when 'git_gud' then
      return exists (
        select 1
        from (
          select
            participant.is_winner as won,
            lag(participant.is_winner, 1) over chronology as previous_won,
            lag(participant.is_winner, 2) over chronology as second_previous_won,
            lag(participant.is_winner, 3) over chronology as third_previous_won
          from public.play_participants as participant
          join public.plays as play on play.id = participant.play_id
          where participant.user_id = p_user_id
            and play.status = 'completed'::public.play_status
            and (play.mode = 'competitive'::public.play_mode or play.team_result is not null)
          window chronology as (
            partition by play.game_id
            order by play.played_at, play.created_at, play.id
          )
        ) as sequence
        where sequence.won
          and sequence.previous_won = false
          and sequence.second_previous_won = false
          and sequence.third_previous_won = false
      );

    when 'no_save_found' then
      return exists (
        select 1
        from (
          select
            lag(participant.is_winner, 1) over chronology as previous_won,
            lag(participant.is_winner, 2) over chronology as second_previous_won,
            lag(participant.is_winner, 3) over chronology as third_previous_won
          from public.play_participants as participant
          join public.plays as play on play.id = participant.play_id
          where participant.user_id = p_user_id
            and play.status = 'completed'::public.play_status
            and (play.mode = 'competitive'::public.play_mode or play.team_result is not null)
          window chronology as (
            partition by play.game_id
            order by play.played_at, play.created_at, play.id
          )
        ) as sequence
        where sequence.previous_won = false
          and sequence.second_previous_won = false
          and sequence.third_previous_won = false
      );

    when 'the_absolute' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        join public.meetings as meeting on meeting.id = play.meeting_id
        where participant.user_id = p_user_id
          and participant.is_winner = true
          and play.status = 'completed'::public.play_status
          and meeting.deleted_at is null
          and exists (
            select 1
            from public.meeting_game_responses as response
            where response.meeting_id = play.meeting_id
              and response.wants_to_play = true
              and private.is_gamification_eligible(response.user_id)
            group by response.meeting_id
            having count(distinct response.user_id) >= 3
               and count(distinct response.game_id) = 1
               and min(response.game_id::text) = play.game_id::text
          )
      );

    when 'critical_success_question_mark' then
      return exists (
        select 1
        from public.ratings as rating
        join public.plays as play on play.game_id = rating.game_id
        join public.play_participants as participant
          on participant.play_id = play.id
         and participant.user_id = rating.user_id
        where rating.user_id = p_user_id
          and rating.overall <= 4
          and rating.updated_at < play.played_at
          and participant.is_winner = true
          and play.status = 'completed'::public.play_status
      );

    when 'redemption_arc' then
      return exists (
        select 1
        from (
          select
            result.is_first,
            lag(result.is_last, 1) over chronology as previous_last,
            lag(result.is_last, 2) over chronology as second_previous_last,
            lag(result.is_last, 3) over chronology as third_previous_last
          from (
            select
              play.id,
              play.played_at,
              play.created_at,
              participant.placement = 1 as is_first,
              participant.placement = (
                select max(other_participant.placement)
                from public.play_participants as other_participant
                where other_participant.play_id = play.id
              ) as is_last
            from public.play_participants as participant
            join public.plays as play on play.id = participant.play_id
            where participant.user_id = p_user_id
              and private.play_has_real_ranking(play.id)
          ) as result
          window chronology as (
            order by result.played_at, result.created_at, result.id
          )
        ) as sequence
        where sequence.is_first
          and sequence.previous_last
          and sequence.second_previous_last
          and sequence.third_previous_last
      );

    when 'hot_streak' then
      return exists (
        select 1
        from (
          select
            participant.is_winner as won,
            lag(participant.is_winner, 1) over chronology as previous_won,
            lag(participant.is_winner, 2) over chronology as second_previous_won,
            lag(participant.is_winner, 3) over chronology as third_previous_won,
            lag(participant.is_winner, 4) over chronology as fourth_previous_won
          from public.play_participants as participant
          join public.plays as play on play.id = participant.play_id
          where participant.user_id = p_user_id
            and play.status = 'completed'::public.play_status
            and (play.mode = 'competitive'::public.play_mode or play.team_result is not null)
          window chronology as (
            order by play.played_at, play.created_at, play.id
          )
        ) as streak
        where streak.won
          and streak.previous_won
          and streak.second_previous_won
          and streak.third_previous_won
          and streak.fourth_previous_won
      );

    else
      return private.qualifies_for_achievement_before_legendarium_stage2b(
        p_user_id,
        p_achievement_key
      );
  end case;
end;
$$;

revoke all on function private.qualifies_for_achievement(uuid, text)
  from public, anon, authenticated;
revoke all on function private.qualifies_for_achievement_before_legendarium_stage2b(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Hot Take forward-only przy zapisie konkretnego ratingu
-- ---------------------------------------------------------------------------

create or replace function private.award_hot_take_after_rating_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if private.is_gamification_eligible(new.user_id)
     and private.rating_is_hot_take(new.user_id, new.game_id, new.overall) then
    perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
    perform private.apply_reward_delta(
      new.user_id,
      'achievement',
      'hot_take',
      true,
      null,
      'legendarium_stage2b_rating_write'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.award_hot_take_after_rating_write()
  from public, anon, authenticated;

drop trigger if exists ratings_award_hot_take_after_write on public.ratings;
create trigger ratings_award_hot_take_after_write
after insert or update of overall on public.ratings
for each row execute function private.award_hot_take_after_rating_write();

-- ---------------------------------------------------------------------------
-- 4. Live recompute po zmianie wyniku/uczestników Kroniki
-- ---------------------------------------------------------------------------

create or replace function private.recompute_legendarium_stage2b_achievements(
  p_user_ids uuid[] default null,
  p_play_id uuid default null,
  p_reason text default 'legendarium_stage2b_recompute'
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
              'candlekeep_sage', 'glass_cannon', 'git_gud', 'no_save_found',
              'the_absolute', 'critical_success_question_mark',
              'redemption_arc', 'hot_streak'
            )
            and state.is_active
        )
      )
    order by membership.user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));

    foreach v_key in array array[
      'candlekeep_sage', 'glass_cannon', 'git_gud', 'no_save_found',
      'the_absolute', 'critical_success_question_mark',
      'redemption_arc', 'hot_streak'
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

revoke all on function private.recompute_legendarium_stage2b_achievements(uuid[], uuid, text)
  from public, anon, authenticated;

alter function private.recompute_play_rewards(uuid[], uuid, text)
  rename to recompute_play_rewards_before_legendarium_stage2b;

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
  v_changes := private.recompute_play_rewards_before_legendarium_stage2b(
    p_user_ids,
    p_play_id,
    p_reason
  );

  return v_changes + private.recompute_legendarium_stage2b_achievements(
    p_user_ids,
    p_play_id,
    p_reason
  );
end;
$$;

revoke all on function private.recompute_play_rewards(uuid[], uuid, text)
  from public, anon, authenticated;
revoke all on function private.recompute_play_rewards_before_legendarium_stage2b(uuid[], uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Read-only PREVIEW i prywatny, niewywoływany automatycznie APPLY
-- ---------------------------------------------------------------------------

create or replace function private.legendarium_stage2b_reconciliation_plan()
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
  with stage2b_keys(achievement_key) as (
    values
      ('candlekeep_sage'), ('hot_take'), ('glass_cannon'), ('git_gud'),
      ('no_save_found'), ('the_absolute'), ('critical_success_question_mark'),
      ('redemption_arc'), ('hot_streak')
  ), candidates as (
    select membership.user_id, definition.achievement_key, definition.points
    from public.app_members as membership
    cross join stage2b_keys as key
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
      private.is_gamification_eligible(candidate.user_id) as is_eligible,
      exists (
        select 1 from public.user_achievements as earned
        where earned.user_id = candidate.user_id
          and earned.achievement_key = candidate.achievement_key
      ) as current_unlocked,
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
    states.current_unlocked or (
      states.is_eligible
      and private.qualifies_for_achievement(
        states.user_id,
        states.achievement_key
      )
    ),
    states.current_points,
    case
      when not states.is_eligible then states.current_points
      when states.current_unlocked or private.qualifies_for_achievement(
        states.user_id,
        states.achievement_key
      ) then states.points
      else 0
    end,
    (case
      when not states.is_eligible then states.current_points
      when states.current_unlocked or private.qualifies_for_achievement(
        states.user_id,
        states.achievement_key
      ) then states.points
      else 0
    end)
      - states.current_points
  from states;
$$;

revoke all on function private.legendarium_stage2b_reconciliation_plan()
  from public, anon, authenticated;

create or replace function public.preview_legendarium_stage2b_reconciliation()
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
  from private.legendarium_stage2b_reconciliation_plan() as plan
  join public.profiles as profile on profile.id = plan.user_id
  join public.achievement_definitions as definition
    on definition.achievement_key = plan.achievement_key
  where plan.current_unlocked is distinct from plan.target_unlocked
     or plan.delta <> 0
  order by profile.display_name, plan.achievement_key;
end;
$$;

revoke all on function public.preview_legendarium_stage2b_reconciliation()
  from public, anon, authenticated;
grant execute on function public.preview_legendarium_stage2b_reconciliation()
  to authenticated;

create or replace function private.apply_legendarium_stage2b_reconciliation()
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
    'candlekeep_sage', 'hot_take', 'glass_cannon', 'git_gud',
    'no_save_found', 'the_absolute', 'critical_success_question_mark',
    'redemption_arc', 'hot_streak'
  )
  on conflict do nothing;

  v_achievement_changes := private.recompute_legendarium_stage2b_achievements(
    null,
    null,
    'legendarium_stage2b_backfill'
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
      'candlekeep_sage', 'hot_take', 'glass_cannon', 'git_gud',
      'no_save_found', 'the_absolute', 'critical_success_question_mark',
      'redemption_arc', 'hot_streak'
    )
      and private.is_gamification_eligible(earned.user_id)
      and private.qualifies_for_achievement(earned.user_id, earned.achievement_key)
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

comment on function private.apply_legendarium_stage2b_reconciliation() is
  'Operatorski, idempotentny APPLY Stage 2B. Migracja nie wywołuje go automatycznie.';

revoke all on function private.apply_legendarium_stage2b_reconciliation()
  from public, anon, authenticated;
