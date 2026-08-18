-- Rozdziela odłożenie aktywnej sesji od finalizacji wyniku. Odłożenie zachowuje
-- ten sam wpis Kroniki i naliczony czas, ale zwalnia bieżący slot Stołu, dzięki
-- czemu na tym samym spotkaniu można świadomie wznowić inną odłożoną partię.

create or replace function public.pause_meeting_play(
  p_meeting_id uuid,
  p_play_id uuid,
  p_state_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_continued_play_id uuid;
  v_start_meeting_id uuid;
begin
  select meeting.continued_play_id
  into v_continued_play_id
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null
  for update;

  if not found then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  perform private.assert_can_run_meeting_play(p_meeting_id, actor_id);

  select play.meeting_id
  into v_start_meeting_id
  from public.plays as play
  where play.id = p_play_id
  for update;

  if not found then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  if v_start_meeting_id is distinct from p_meeting_id
    and v_continued_play_id is distinct from p_play_id then
    raise exception 'This play is not running at this meeting'
      using errcode = '23514';
  end if;

  -- Istniejący helper zapisuje czas sesji i pozostawia status in_progress.
  perform public.finish_meeting_play(
    p_play_id => p_play_id,
    p_result_pending => false,
    p_state_note => p_state_note
  );

  -- Wskaźnik opisuje partię aktualnie przypisaną do tego Stołu, a nie historię
  -- wpisu. Sam play, uczestnicy i duration_minutes pozostają nietknięte.
  if v_continued_play_id = p_play_id then
    update public.meetings
    set continued_play_id = null
    where id = p_meeting_id;
  end if;

  return p_play_id;
end;
$$;

revoke all on function public.pause_meeting_play(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.pause_meeting_play(uuid, uuid, text)
to authenticated;

-- Spotkanie może przełączyć się na inną ODŁOŻONĄ partię, o ile żadna partia
-- faktycznie teraz nie biegnie. Stary continued_play_id nie jest blokadą: po
-- wcześniejszych wersjach mógł zostać jako nieaktywny wskaźnik.
create or replace function public.resume_meeting_play(
  p_meeting_id uuid,
  p_play_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_meeting_status public.meeting_status;
  v_start_meeting_id uuid;
  v_live_started_at timestamptz;
  v_live_ended_at timestamptz;
  v_current_continued_play_id uuid;
  v_running_play_id uuid;
begin
  select meeting.status, meeting.continued_play_id
  into v_meeting_status, v_current_continued_play_id
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null
  for update;

  if not found then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  perform private.assert_can_run_meeting_play(p_meeting_id, actor_id);

  select play.meeting_id, play.live_started_at, play.live_ended_at
  into v_start_meeting_id, v_live_started_at, v_live_ended_at
  from public.plays as play
  where play.id = p_play_id
  for update;

  if not found then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  -- Idempotencja: ponowne kliknięcie dla partii już biegnącej na tym Stole.
  if v_live_started_at is not null and v_live_ended_at is null then
    if v_start_meeting_id = p_meeting_id
      or v_current_continued_play_id = p_play_id then
      return p_play_id;
    end if;

    raise exception 'This play is already running at another meeting'
      using errcode = '23514';
  end if;

  if not private.is_continuable_play(p_play_id) then
    raise exception 'Only a paused play in progress can be resumed'
      using errcode = '23514';
  end if;

  -- Bez względu na meeting_id wpisu nie wolno przełączyć Stołu, dopóki jego
  -- obecna partia naprawdę biegnie. Odłożony/stary wskaźnik nie blokuje.
  select running.id
  into v_running_play_id
  from public.plays as running
  where running.status = 'in_progress'::public.play_status
    and running.live_started_at is not null
    and running.live_ended_at is null
    and (
      running.meeting_id = p_meeting_id
      or running.id = v_current_continued_play_id
    )
  limit 1;

  if v_running_play_id is not null then
    raise exception 'Finish the running play before resuming another one'
      using errcode = '23514';
  end if;

  if v_start_meeting_id is distinct from p_meeting_id then
    perform private.assert_valid_continued_play(p_meeting_id, p_play_id);

    update public.meetings
    set continued_play_id = p_play_id
    where id = p_meeting_id;
  elsif v_current_continued_play_id is not null then
    -- Powrót do partii rozpoczętej na tym samym spotkaniu nie jest kontynuacją
    -- między spotkaniami; usuwa ewentualny stary wskaźnik.
    update public.meetings
    set continued_play_id = null
    where id = p_meeting_id;
  end if;

  update public.plays
  set
    live_started_at = now(),
    live_ended_at = null,
    result_pending = false
  where id = p_play_id;

  return p_play_id;
end;
$$;

revoke all on function public.resume_meeting_play(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.resume_meeting_play(uuid, uuid)
to authenticated;
