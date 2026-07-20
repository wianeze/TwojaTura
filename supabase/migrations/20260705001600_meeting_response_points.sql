create or replace function public.award_meeting_rsvp_points(
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
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_meeting_id is null or not exists (
    select 1
    from public.meetings
    where id = p_meeting_id
  ) then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.meeting_availability
    where meeting_id = p_meeting_id
      and user_id = current_user_id
  ) then
    raise exception 'Saved RSVP is required before awarding points'
      using errcode = '22023';
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'meeting_rsvp',
    'meeting',
    p_meeting_id,
    'Odpowiedź RSVP na spotkanie',
    current_user_id
  );
end;
$$;

create or replace function public.award_meeting_vote_points(
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
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_meeting_id is null or not exists (
    select 1
    from public.meetings
    where id = p_meeting_id
  ) then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.meeting_game_votes
    where meeting_id = p_meeting_id
      and user_id = current_user_id
  ) then
    raise exception 'Saved game vote is required before awarding points'
      using errcode = '22023';
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'meeting_vote',
    'meeting',
    p_meeting_id,
    'Pierwszy głos na grę w spotkaniu',
    current_user_id
  );
end;
$$;

revoke all on function public.award_meeting_rsvp_points(uuid)
from public, anon, authenticated;

revoke all on function public.award_meeting_vote_points(uuid)
from public, anon, authenticated;

grant execute on function public.award_meeting_rsvp_points(uuid)
to authenticated;

grant execute on function public.award_meeting_vote_points(uuid)
to authenticated;
