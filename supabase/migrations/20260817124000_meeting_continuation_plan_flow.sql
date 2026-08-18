-- Formularz spotkania może od razu zaproponować dokończenie odłożonej
-- partii, ale sama propozycja nie jest jeszcze wyborem przy Stole.
-- meetings.continued_play_id pozostaje wyłącznie wskaźnikiem partii faktycznie
-- wybranej przez resume_meeting_play.

create function public.create_meeting_plan_with_invitations(
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_invited_user_ids uuid[],
  p_description text default null,
  p_location text default null,
  p_proposed_continued_play_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_meeting_id uuid;
begin
  -- Istniejące RPC pozostaje źródłem prawdy dla walidacji spotkania,
  -- zaproszeń, RSVP organizatora i powiadomień. Przekazujemy jawnie null,
  -- ponieważ propozycja nie może aktywować kontynuacji.
  v_meeting_id := public.create_meeting_with_invitations(
    p_title => p_title,
    p_starts_at => p_starts_at,
    p_ends_at => p_ends_at,
    p_invited_user_ids => p_invited_user_ids,
    p_description => p_description,
    p_location => p_location,
    p_continued_play_id => null
  );

  if p_proposed_continued_play_id is not null then
    perform 1
    from public.propose_meeting_continuation(
      v_meeting_id,
      p_proposed_continued_play_id
    );
  end if;

  return v_meeting_id;
end;
$$;

revoke all on function public.create_meeting_plan_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text, uuid
) from public, anon;
grant execute on function public.create_meeting_plan_with_invitations(
  text, timestamptz, timestamptz, uuid[], text, text, uuid
) to authenticated;

create function public.update_meeting_plan_with_invitations(
  p_meeting_id uuid,
  p_title text,
  p_starts_at timestamptz,
  p_ends_at timestamptz,
  p_invited_user_ids uuid[],
  p_description text default null,
  p_location text default null,
  p_proposed_continued_play_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_current_continued_play_id uuid;
  v_meeting_id uuid;
begin
  -- Edycja planu nie może wyczyścić legacy/aktywnego powiązania tylko dlatego,
  -- że pole formularza oznacza teraz propozycję. Uprawnienia i istnienie
  -- spotkania nadal sprawdza wywoływane niżej właściwe RPC aktualizacji.
  select meeting.continued_play_id
  into v_current_continued_play_id
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null;

  v_meeting_id := public.update_meeting_with_invitations(
    p_meeting_id => p_meeting_id,
    p_title => p_title,
    p_starts_at => p_starts_at,
    p_ends_at => p_ends_at,
    p_invited_user_ids => p_invited_user_ids,
    p_description => p_description,
    p_location => p_location,
    p_continued_play_id => v_current_continued_play_id
  );

  if p_proposed_continued_play_id is not null then
    perform 1
    from public.propose_meeting_continuation(
      p_meeting_id,
      p_proposed_continued_play_id
    );
  end if;

  return v_meeting_id;
end;
$$;

revoke all on function public.update_meeting_plan_with_invitations(
  uuid, text, timestamptz, timestamptz, uuid[], text, text, uuid
) from public, anon;
grant execute on function public.update_meeting_plan_with_invitations(
  uuid, text, timestamptz, timestamptz, uuid[], text, text, uuid
) to authenticated;

-- Odłożenie kończy tylko bieżący pomiar czasu. Wskaźnik wybranej kontynuacji
-- zostaje przy spotkaniu: dzięki temu historia i blokada fałszywego zlecenia
-- „Dodaj wpis do Kroniki” nie znikają. Picker Stołu nie traktuje już tego
-- wskaźnika jako trybu wyłączającego pozostałe opcje.
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

  perform public.finish_meeting_play(
    p_play_id => p_play_id,
    p_result_pending => false,
    p_state_note => p_state_note
  );

  return p_play_id;
end;
$$;

revoke all on function public.pause_meeting_play(uuid, uuid, text)
from public, anon, authenticated;
grant execute on function public.pause_meeting_play(uuid, uuid, text)
to authenticated;
