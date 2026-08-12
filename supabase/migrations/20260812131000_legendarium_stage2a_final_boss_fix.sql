-- Legendarium Stage 2A: Final Boss wymaga zwycięstw w trzech różnych
-- ciężkich grach. Jedna kooperacyjna partia może nadal spełnić Boss Defeated,
-- ale sama nie wystarcza już do odblokowania Final Boss.

update public.achievement_definitions
set condition_text =
  'Wygraj ukończone partie w 3 różnych grach, z których każda ma trudność BGG co najmniej 4,0.'
where achievement_key = 'final_boss';

alter function private.qualifies_for_achievement(uuid, text)
  rename to qualifies_for_achievement_before_final_boss_fix;

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

  if p_achievement_key = 'final_boss' then
    return (
      select count(distinct play.game_id)
      from public.play_participants as participant
      join public.plays as play on play.id = participant.play_id
      join public.games as game on game.id = play.game_id
      where participant.user_id = p_user_id
        and participant.is_winner = true
        and play.status = 'completed'::public.play_status
        and game.bgg_weight is not null
        and game.bgg_weight >= 4.0
    ) >= 3;
  end if;

  return private.qualifies_for_achievement_before_final_boss_fix(
    p_user_id,
    p_achievement_key
  );
end;
$$;

revoke all on function private.qualifies_for_achievement(uuid, text)
  from public, anon, authenticated;
revoke all on function private.qualifies_for_achievement_before_final_boss_fix(uuid, text)
  from public, anon, authenticated;

comment on function private.qualifies_for_achievement(uuid, text) is
  'Centralny predykat achievementów. Final Boss wymaga zwycięstw w 3 różnych ukończonych grach o BGG weight >= 4.0.';
