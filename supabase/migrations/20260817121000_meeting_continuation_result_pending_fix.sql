-- Forward-only domknięcie flow kontynuacji. Wpis `result_pending` nadal ma
-- status `in_progress`, więc można zarówno przypisać go do przyszłego
-- spotkania, jak i wznowić przy Stole. Znacznik opisuje brak rozliczenia, a
-- nie zakończenie wpisu Kroniki.

create or replace function private.is_continuable_play(p_play_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and play.status = 'in_progress'::public.play_status
      and (play.live_started_at is null or play.live_ended_at is not null)
  );
$$;

revoke all on function private.is_continuable_play(uuid)
from public, anon, authenticated;

create or replace function private.assert_valid_continued_play(
  p_meeting_id uuid,
  p_play_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status public.play_status;
  v_start_meeting_id uuid;
begin
  if p_play_id is null then
    return;
  end if;

  select play.status, play.meeting_id
  into v_status, v_start_meeting_id
  from public.plays as play
  where play.id = p_play_id;

  if not found then
    raise exception 'Continued play does not exist'
      using errcode = '23503';
  end if;

  if v_status <> 'in_progress'::public.play_status then
    raise exception 'Only a play in progress can be continued at another meeting'
      using errcode = '23514';
  end if;

  if p_meeting_id is not null and v_start_meeting_id = p_meeting_id then
    raise exception 'A meeting cannot continue a play that already starts at it'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_valid_continued_play(uuid, uuid)
from public, anon, authenticated;
