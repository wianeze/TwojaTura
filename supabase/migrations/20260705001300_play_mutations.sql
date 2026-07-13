create or replace function private.assert_valid_play_payload(
  p_duration_minutes integer,
  p_participants jsonb
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

  if winners_count = 0 then
    raise exception 'At least one winner is required'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_valid_play_payload(integer, jsonb)
from public, anon, authenticated;

grant execute on function private.assert_valid_play_payload(integer, jsonb)
to authenticated;

create or replace function public.create_play_with_participants(
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb
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
    p_participants
  );

  insert into public.plays (
    game_id,
    meeting_id,
    created_by,
    played_at,
    duration_minutes,
    comment
  )
  values (
    p_game_id,
    p_meeting_id,
    actor_id,
    p_played_at,
    p_duration_minutes,
    p_comment
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

create or replace function public.update_play_with_participants(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb
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
    p_participants
  );

  update public.plays
  set
    game_id = p_game_id,
    meeting_id = p_meeting_id,
    played_at = p_played_at,
    duration_minutes = p_duration_minutes,
    comment = p_comment
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

create or replace function public.get_play_profiles(p_user_ids uuid[])
returns table (
  id uuid,
  display_name text,
  avatar_url text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_active_member() then
    raise exception 'Active member required'
      using errcode = '42501';
  end if;

  return query
  select
    profile.id,
    profile.display_name,
    profile.avatar_url
  from public.profiles as profile
  where profile.id = any(coalesce(p_user_ids, '{}'::uuid[]))
    and (
      exists (
        select 1
        from public.app_members as membership
        where membership.user_id = profile.id
          and membership.is_active = true
      )
      or exists (
        select 1
        from public.plays as play
        where play.created_by = profile.id
      )
      or exists (
        select 1
        from public.play_participants as participant
        where participant.user_id = profile.id
      )
    );
end;
$$;

revoke all on function public.create_play_with_participants(
  uuid,
  timestamptz,
  uuid,
  integer,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.update_play_with_participants(
  uuid,
  uuid,
  timestamptz,
  uuid,
  integer,
  text,
  jsonb
) from public, anon, authenticated;

revoke all on function public.get_play_profiles(uuid[])
from public, anon, authenticated;

grant execute on function public.create_play_with_participants(
  uuid,
  timestamptz,
  uuid,
  integer,
  text,
  jsonb
) to authenticated;

grant execute on function public.update_play_with_participants(
  uuid,
  uuid,
  timestamptz,
  uuid,
  integer,
  text,
  jsonb
) to authenticated;

grant execute on function public.get_play_profiles(uuid[])
to authenticated;
