-- Unfinished-game tracking in the Chronicle: a play can be saved as
-- 'in_progress' (min. 1 participant, no winner required, a non-empty
-- state_note explaining where the group left off) and later resumed and
-- completed via the same update RPC, without creating a new row. Points and
-- achievements must only ever be granted once a play reaches 'completed'.

create type public.play_status as enum ('in_progress', 'completed');

alter table public.plays
  add column status public.play_status not null default 'completed',
  add column state_note text;

alter table public.plays
  add constraint plays_in_progress_requires_state_note
  check (
    status <> 'in_progress'
    or nullif(btrim(state_note), '') is not null
  );

create index plays_status_idx on public.plays (status);

-- Winner requirement now only applies to completed plays; at least one
-- participant is still required regardless of status. The 2-argument
-- overload is dropped so callers cannot accidentally resolve to the old,
-- always-completed behaviour.
drop function if exists private.assert_valid_play_payload(integer, jsonb);

create function private.assert_valid_play_payload(
  p_duration_minutes integer,
  p_participants jsonb,
  p_status public.play_status default 'completed'
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  participant_count integer;
  winners_count integer;
begin
  if p_duration_minutes is not null and p_duration_minutes <= 0 then
    raise exception 'Play duration must be greater than zero'
      using errcode = '23514';
  end if;

  if jsonb_typeof(coalesce(p_participants, '[]'::jsonb)) <> 'array' then
    raise exception 'Participants payload must be a JSON array'
      using errcode = '22023';
  end if;

  select
    count(*),
    count(*) filter (where coalesce(participant.is_winner, false))
  into participant_count, winners_count
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  if participant_count = 0 then
    raise exception 'At least one participant is required'
      using errcode = '23514';
  end if;

  if p_status = 'completed' and winners_count = 0 then
    raise exception 'At least one winner is required for a completed play'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_valid_play_payload(
  integer, jsonb, public.play_status
) from public, anon, authenticated;

grant execute on function private.assert_valid_play_payload(
  integer, jsonb, public.play_status
) to authenticated;

-- create_play_with_participants / update_play_with_participants gain
-- p_status and p_state_note. The old 6-argument overloads are dropped so
-- there is exactly one signature per function (no silent fallback to an
-- implicit 'completed' overload).
drop function if exists public.create_play_with_participants(
  uuid, timestamptz, uuid, integer, text, jsonb
);
drop function if exists public.update_play_with_participants(
  uuid, uuid, timestamptz, uuid, integer, text, jsonb
);

create function public.create_play_with_participants(
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_play_id uuid;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  perform private.assert_valid_play_payload(
    p_duration_minutes,
    p_participants,
    p_status
  );

  insert into public.plays (
    game_id,
    meeting_id,
    created_by,
    played_at,
    duration_minutes,
    comment,
    status,
    state_note
  )
  values (
    p_game_id,
    p_meeting_id,
    actor_id,
    p_played_at,
    p_duration_minutes,
    p_comment,
    p_status,
    p_state_note
  )
  returning id into created_play_id;

  insert into public.play_participants (
    play_id,
    user_id,
    placement,
    score,
    is_winner
  )
  select
    created_play_id,
    participant.user_id,
    participant.placement,
    participant.score,
    coalesce(participant.is_winner, false)
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  return created_play_id;
end;
$$;

create function public.update_play_with_participants(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_play_id uuid;
  actor_id uuid := auth.uid();
begin
  if actor_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  perform private.assert_valid_play_payload(
    p_duration_minutes,
    p_participants,
    p_status
  );

  update public.plays
  set
    game_id = p_game_id,
    meeting_id = p_meeting_id,
    played_at = p_played_at,
    duration_minutes = p_duration_minutes,
    comment = p_comment,
    status = p_status,
    state_note = p_state_note
  where id = p_play_id
  returning id into updated_play_id;

  if updated_play_id is null then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  delete from public.play_participants
  where play_id = p_play_id;

  insert into public.play_participants (
    play_id,
    user_id,
    placement,
    score,
    is_winner
  )
  select
    p_play_id,
    participant.user_id,
    participant.placement,
    participant.score,
    coalesce(participant.is_winner, false)
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  return updated_play_id;
end;
$$;

revoke all on function public.create_play_with_participants(
  uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text
) from public, anon, authenticated;

revoke all on function public.update_play_with_participants(
  uuid, uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text
) from public, anon, authenticated;

grant execute on function public.create_play_with_participants(
  uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text
) to authenticated;

grant execute on function public.update_play_with_participants(
  uuid, uuid, timestamptz, uuid, integer, text, jsonb, public.play_status, text
) to authenticated;

-- Points: never award play_logged points while the play is still in_progress.
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
  v_play_status public.play_status;
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  select status into v_play_status
  from public.plays
  where id = p_play_id;

  if not found then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.plays
    where id = p_play_id
      and created_by = current_user_id
  ) then
    raise exception 'Only the play author can receive play_logged points'
      using errcode = '42501';
  end if;

  if v_play_status <> 'completed' then
    return query select false, 0, null::uuid;
    return;
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'play_logged',
    'play',
    p_play_id,
    'Zapis partii w Kronice',
    current_user_id
  );
end;
$$;

-- Achievements: every predicate that counts plays/play_participants must
-- ignore in_progress rows, otherwise progress bars and unlocks would run
-- ahead of a game that has not actually finished yet.
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
  current_user_id uuid := auth.uid();
  result record;
  total_awarded integer := 0;
  total_points integer := 0;
  keys text[] := array[]::text[];
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = current_user_id
      and participant.is_winner = true
      and play.status = 'completed'
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'critical_roll', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (select count(*) from public.meetings where created_by = current_user_id) >= 5 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'initiative_master', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.ratings
    where user_id = current_user_id
      and nullif(btrim(comment), '') is not null
  ) >= 10 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'party_bard', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.plays
    where created_by = current_user_id
      and status = 'completed'
  ) >= 25 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'coast_chronicler', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = current_user_id
      and play.status = 'completed'
    group by (play.played_at at time zone 'Europe/Warsaw')::date
    having count(*) >= 2
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'short_rest', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = current_user_id
      and play.status = 'completed'
      and (
        select count(*)
        from public.play_participants as party
        where party.play_id = participant.play_id
      ) >= 5
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'full_party', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = current_user_id
      and play.status = 'completed'
      and (
        select count(*)
        from public.play_participants as party
        where party.play_id = participant.play_id
      ) = 1
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'lone_wolf', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if exists (
    select 1
    from public.plays
    where created_by = current_user_id
      and meeting_id is null
      and status = 'completed'
  ) then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'side_quest', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.meeting_availability
    where user_id = current_user_id
      and is_available is not null
  ) >= 10 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'guidance', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.games
    where owner_id = current_user_id
      and archived_at is null
  ) >= 25 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'loot_goblin', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(*)
    from public.games
    where owner_id = current_user_id
      and archived_at is null
  ) >= 50 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'bag_of_holding', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(distinct game_id)
    from public.ratings
    where user_id = current_user_id
      and overall = 10
  ) >= 5 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'fanboy', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  if (
    select count(distinct game_id)
    from public.ratings
    where user_id = current_user_id
      and wants_to_play_again = true
  ) >= 20 then
    select * into result
    from private.award_achievement_once(
      current_user_id, 'one_more_turn', 'simple_achievement_check', current_user_id
    );
    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  return query select total_awarded, total_points, keys;
end;
$$;

create or replace function private.count_real_last_places(p_user_id uuid)
returns integer
language sql
stable
set search_path = ''
as $$
  select count(*)::integer
  from public.play_participants as participant
  join public.plays as play on play.id = participant.play_id
  where participant.user_id = p_user_id
    and play.status = 'completed'
    and private.is_real_last_place(participant.play_id, participant.user_id);
$$;

create or replace function public.award_play_result_achievements(
  p_play_id uuid
)
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_user_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result record;
  participant record;
  total_awarded integer := 0;
  total_points integer := 0;
  recipients uuid[] := array[]::uuid[];
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

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and (play.created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can award play result achievements'
      using errcode = '42501';
  end if;

  -- A play that has not been completed yet cannot contribute a result-based
  -- achievement (win/last-place streaks, "real" last place).
  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and play.status = 'completed'
  ) then
    return query select total_awarded, total_points, recipients;
    return;
  end if;

  for participant in
    select current_participant.user_id
    from public.play_participants as current_participant
    where current_participant.play_id = p_play_id
      and private.is_active_member(current_participant.user_id)
      and private.is_real_last_place(
        current_participant.play_id,
        current_participant.user_id
      )
  loop
    if private.count_real_last_places(participant.user_id) >= 3 then
      select * into result
      from private.award_achievement_once(
        participant.user_id,
        'natural_one',
        'play_result',
        p_play_id,
        null,
        current_user_id
      );

      if result.awarded then
        total_awarded := total_awarded + 1;
        total_points := total_points + result.points_awarded;
        recipients := array_append(recipients, participant.user_id);
      end if;
    end if;
  end loop;

  -- Cooperative results such as 1/1/1 remain wins. This branch intentionally
  -- keeps the existing placement = 1 OR is_winner rule unchanged. History is
  -- restricted to completed plays so a stray in_progress row cannot break or
  -- prematurely extend the streak.
  for participant in
    select current_participant.user_id
    from public.play_participants as current_participant
    join public.plays as current_play
      on current_play.id = current_participant.play_id
    where current_participant.play_id = p_play_id
      and current_play.status = 'completed'
      and private.is_active_member(current_participant.user_id)
      and (
        select count(*) = 3 and bool_and(recent_result.won)
        from (
          select
            history_participant.placement = 1
              or history_participant.is_winner as won
          from public.play_participants as history_participant
          join public.plays as history_play
            on history_play.id = history_participant.play_id
          where history_participant.user_id = current_participant.user_id
            and history_play.status = 'completed'
            and (
              history_play.played_at,
              history_play.created_at,
              history_play.id
            ) <= (
              current_play.played_at,
              current_play.created_at,
              current_play.id
            )
          order by
            history_play.played_at desc,
            history_play.created_at desc,
            history_play.id desc
          limit 3
        ) as recent_result
      )
  loop
    select * into result
    from private.award_achievement_once(
      participant.user_id,
      'dark_urge',
      'play_result_streak',
      p_play_id,
      null,
      current_user_id
    );

    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      recipients := array_append(recipients, participant.user_id);
    end if;
  end loop;

  return query select total_awarded, total_points, recipients;
end;
$$;

create or replace function public.award_meeting_achievements(
  p_play_id uuid
)
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
  current_user_id uuid := auth.uid();
  meeting_host_id uuid;
  completed_meeting_count integer;
  result record;
  total_awarded integer := 0;
  total_points integer := 0;
  keys text[] := array[]::text[];
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_play_id is null then
    raise exception 'Play is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and (play.created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can award meeting achievements'
      using errcode = '42501';
  end if;

  select meeting.created_by
  into meeting_host_id
  from public.plays as play
  join public.meetings as meeting on meeting.id = play.meeting_id
  where play.id = p_play_id;

  if meeting_host_id is null then
    return query select total_awarded, total_points, keys;
    return;
  end if;

  select count(*)
  into completed_meeting_count
  from public.meetings as meeting
  where meeting.created_by = meeting_host_id
    and exists (
      select 1
      from public.plays as play
      where play.meeting_id = meeting.id
        and play.status = 'completed'
    );

  if completed_meeting_count >= 5 then
    select * into result
    from private.award_achievement_once(
      meeting_host_id,
      'camp_host',
      'meeting_completion',
      meeting_host_id,
      null,
      current_user_id
    );

    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  return query select total_awarded, total_points, keys;
end;
$$;
