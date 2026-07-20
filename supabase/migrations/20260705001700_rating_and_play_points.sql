create or replace function public.award_rating_created_points(
  p_game_id uuid
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

  if p_game_id is null or not exists (
    select 1
    from public.games
    where id = p_game_id
  ) then
    raise exception 'Game does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.ratings
    where game_id = p_game_id
      and user_id = current_user_id
  ) then
    raise exception 'Own rating is required before awarding points'
      using errcode = '22023';
  end if;

  return query
  select *
  from private.award_points_once(
    current_user_id,
    'rating_created',
    'game',
    p_game_id,
    'Pierwsza ocena gry',
    current_user_id
  );
end;
$$;

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
    from public.plays
    where id = p_play_id
  ) then
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

revoke all on function public.award_rating_created_points(uuid)
from public, anon, authenticated;

revoke all on function public.award_play_logged_points(uuid)
from public, anon, authenticated;

grant execute on function public.award_rating_created_points(uuid)
to authenticated;

grant execute on function public.award_play_logged_points(uuid)
to authenticated;
