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
    from public.meetings
    where id = p_meeting_id
      and created_by = current_user_id
  ) then
    raise exception 'Only the meeting author can receive meeting_created points'
      using errcode = '42501';
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'meeting_created',
    'meeting',
    p_meeting_id,
    'Utworzenie spotkania',
    current_user_id
  );
end;
$$;

revoke all on function public.award_meeting_created_points(uuid)
from public, anon, authenticated;

grant execute on function public.award_meeting_created_points(uuid)
to authenticated;
