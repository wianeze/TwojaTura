-- Flow kontynuacji musi przyjmować każdy istniejący wpis in_progress, także
-- ten utworzony automatycznie przez aktywny Stół. Wcześniejsza walidacja
-- odrzucała sam fakt, że bieżąca sesja ma live_started_at bez live_ended_at.
-- To blokowało zaplanowanie kolejnego spotkania, mimo że continued_play_id jest
-- wyłącznie wskaźnikiem na ten sam wpis Kroniki i niczego nie uruchamia.
--
-- `result_pending` nadal ma status `in_progress`: znacznik opisuje brak wyniku,
-- ale produktowo taki wpis również można dokończyć. Faktyczne WZNOWIENIE przy
-- Stole nadal blokuje tylko równolegle biegnącą sesję. Publiczne RPC
-- `resume_meeting_play` wywołuje ten helper, więc jego podmiana usuwa również
-- starszą blokadę akcji „Dokończ”, nie tylko filtr listy kandydatów.

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

  select
    play.status,
    play.meeting_id
  into
    v_status,
    v_start_meeting_id
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

  -- Spotkanie startowe nie jest własną kontynuacją — inaczej ta sama sesja
  -- pojawiłaby się w historii partii dwa razy.
  if p_meeting_id is not null and v_start_meeting_id = p_meeting_id then
    raise exception 'A meeting cannot continue a play that already starts at it'
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_valid_continued_play(uuid, uuid)
from public, anon, authenticated;
