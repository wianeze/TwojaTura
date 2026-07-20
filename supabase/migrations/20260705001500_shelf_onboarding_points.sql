create or replace function public.award_shelf_onboarding_points()
returns table (
  awarded_count integer,
  awarded_points integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  active_game_count integer;
  milestone record;
  award_result record;
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  select count(*)::integer
  into active_game_count
  from public.games
  where owner_id = current_user_id
    and archived_at is null;

  awarded_count := 0;
  awarded_points := 0;

  for milestone in
    select *
    from (
      values
        (1, 'shelf_first_game', 'Pierwsza gra na Półce'),
        (5, 'shelf_5_games', '5 gier na wspólnej Półce'),
        (10, 'shelf_10_games', '10 gier na wspólnej Półce'),
        (15, 'shelf_15_games', '15 gier na wspólnej Półce')
    ) as milestones(required_games, action_type, description)
    where active_game_count >= required_games
    order by required_games
  loop
    select *
    into award_result
    from private.award_points_once(
      current_user_id,
      milestone.action_type,
      'profile',
      current_user_id,
      milestone.description,
      current_user_id
    );

    if award_result.awarded then
      awarded_count := awarded_count + 1;
      awarded_points := awarded_points + award_result.points;
    end if;
  end loop;

  return next;
end;
$$;

revoke all on function public.award_shelf_onboarding_points()
from public, anon, authenticated;

grant execute on function public.award_shelf_onboarding_points()
to authenticated;
