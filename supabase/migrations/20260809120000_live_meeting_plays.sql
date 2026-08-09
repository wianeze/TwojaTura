-- „GRAMY!” — partia grana NA ŻYWO przy stole.
--
-- Problem: Kronika umiała zapisać partię dopiero PO fakcie. Wieczór przy stole
-- nie miał w bazie żadnej reprezentacji, więc Stół nie mógł pokazać, że grupa
-- właśnie gra, ani policzyć czasu partii inaczej niż licznikiem w przeglądarce
-- (gasnącym przy odświeżeniu i różnym na każdym urządzeniu).
--
-- Model: ŻADNEJ nowej tabeli partii. Wpis Kroniki (public.plays) obsługuje cały
-- cykl życia rozgrywki, tak jak dotąd obsługiwał partię „w toku”:
--
--   start  → plays(status = 'in_progress', live_started_at = now())
--   koniec → update_play_with_participants(..., p_status => 'completed')
--
-- czyli DOKŁADNIE ta sama ścieżka zapisu wyniku, punktów i odznak co przy
-- ręcznym wpisie w Kronice. Ta migracja nie dotyka cennika punktów, predykatów
-- osiągnięć ani silnika przeliczania nagród — moment „game_completed”, do
-- którego można będzie później podpiąć nowe zdarzenia, to nadal przejście
-- partii w status 'completed' w private.recompute_play_rewards.
--
-- DLACZEGO NOWA KOLUMNA, A NIE NOWY STATUS. 'in_progress' ma już znaczenie:
-- „partia odłożona, wrócimy do niej na kolejnym spotkaniu” (patrz
-- meetings.continued_play_id). Partia grana teraz przy stole to inny stan tej
-- samej maszyny: też niedokończona, ale nie odłożona. Rozróżnia je
-- live_started_at, a nie kolejna wartość enuma — nowa wartość play_status
-- wymagałaby przejrzenia każdego predykatu osiągnięć i każdego `= 'completed'`
-- w bazie oraz w TS. Tu nie zmienia się ani jeden istniejący warunek.

-- 1. Kolumna ----------------------------------------------------------------

alter table public.plays
  add column live_started_at timestamptz;

comment on column public.plays.live_started_at is
  'Znacznik startu partii rozpoczętej „na żywo” przy stole (stan GRAMY! na Stole). Jedyne źródło prawdy dla licznika czasu — przeżywa odświeżenie strony i zmianę urządzenia. Partia jest AKTYWNA wtedy i tylko wtedy, gdy live_started_at is not null and status = ''in_progress''; po zakończeniu znacznik zostaje jako ślad, że partia była grana przy stole, a nie dopisana z pamięci.';

-- 2. Partia w toku bez notatki stanu — ale tylko ta grana na żywo ------------
--
-- Ograniczenie z 20260706000100 wymagało notatki od KAŻDEJ partii 'in_progress'
-- („na czym skończyliśmy”). Dla partii startowanej przy stole notatki jeszcze
-- z definicji nie ma — dopiero zaczynamy grać. Nowy warunek jest ściśle
-- słabszy od poprzedniego, więc żaden istniejący wiersz go nie łamie.

alter table public.plays
  drop constraint plays_in_progress_requires_state_note;

alter table public.plays
  add constraint plays_in_progress_requires_state_note
  check (
    status <> 'in_progress'
    or live_started_at is not null
    or nullif(btrim(state_note), '') is not null
  );

-- 3. Jedno spotkanie = najwyżej jedna aktywna partia -------------------------
--
-- Twarda bariera bazodanowa, nie umowa w kodzie: podwójne kliknięcie
-- „Zaczynamy grać”, dwa telefony przy stole albo ponowiony request nie mogą
-- zostawić dwóch równolegle biegnących partii tego samego wieczoru. Indeks
-- zwalnia się sam w chwili, w której partia przechodzi w 'completed'.

create unique index plays_single_live_per_meeting_idx
  on public.plays (meeting_id)
  where meeting_id is not null
    and live_started_at is not null
    and status = 'in_progress';

-- 4. Partia grana na żywo nie jest partią „do kontynuacji” -------------------
--
-- assert_valid_continued_play dopuszczała każdą partię 'in_progress'. Po tej
-- migracji ten zbiór obejmuje także rozgrywkę biegnącą właśnie przy stole, a
-- ta nie jest jeszcze niczym, do czego można „wrócić na kolejnym spotkaniu” —
-- najpierw musi się skończyć. Sygnatura i pozostałe reguły bez zmian.

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
  v_live_started_at timestamptz;
begin
  if p_play_id is null then
    return;
  end if;

  select play.status, play.meeting_id, play.live_started_at
  into v_status, v_start_meeting_id, v_live_started_at
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

  if v_live_started_at is not null then
    raise exception 'A play running live at the table cannot be continued yet'
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

-- 5. RPC: rozpoczęcie partii przy stole --------------------------------------
--
-- SECURITY DEFINER z tego samego powodu co pozostałe RPC partii
-- (20260729100500): funkcja woła private.recompute_play_rewards, do którego
-- authenticated nie ma grantu. Autoryzacja jest więc odwzorowana JAWNIE i
-- odpowiada polityce plays_insert_creator — autorem partii zostaje wołający.
--
-- IDEMPOTENCJA. Powtórzone wywołanie dla spotkania, które ma już aktywną
-- partię, zwraca jej id zamiast rzucać błędem albo zakładać drugi wpis. Dzięki
-- temu double-click i retry po timeoucie są bezpieczne, a klient nie musi
-- rozróżniać „utworzono” od „już było”.

create function public.start_meeting_play(
  p_meeting_id uuid,
  p_game_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_meeting_status public.meeting_status;
  v_meeting_created_by uuid;
  v_play_id uuid;
begin
  if actor_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  -- Blokada wiersza spotkania serializuje równoległe starty. Unikalny indeks
  -- częściowy jest drugą barierą — działa nawet dla ścieżek omijających to RPC.
  select meeting.status, meeting.created_by
  into v_meeting_status, v_meeting_created_by
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null
  for update;

  if not found then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if v_meeting_status = 'completed'::public.meeting_status then
    raise exception 'Meeting is already finished'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.games as game
    where game.id = p_game_id
      and game.archived_at is null
  ) then
    raise exception 'Game does not exist'
      using errcode = '23503';
  end if;

  select play.id
  into v_play_id
  from public.plays as play
  where play.meeting_id = p_meeting_id
    and play.status = 'in_progress'::public.play_status
    and play.live_started_at is not null;

  if v_play_id is not null then
    return v_play_id;
  end if;

  insert into public.plays (
    game_id,
    meeting_id,
    created_by,
    played_at,
    status,
    live_started_at,
    mode,
    rewards_managed
  )
  values (
    p_game_id,
    p_meeting_id,
    actor_id,
    now(),
    'in_progress'::public.play_status,
    now(),
    -- Tryb i wynik ustala dopiero formularz zakończenia partii — ten sam, co
    -- w Kronice. Tu zostaje domyślny 'competitive', bo partia w toku i tak nie
    -- może nieść team_result (plays_incomplete_has_no_team_result).
    'competitive'::public.play_mode,
    true
  )
  returning id into v_play_id;

  -- Skład: kto klika + organizator + wszyscy z RSVP „będę”. Obserwatorzy nie
  -- grają. Zbiór nigdy nie jest pusty — wołający ma prawo zapisu, więc sam
  -- przechodzi ten filtr. Listę można poprawić przy zapisie wyniku, w istniejącym
  -- polu uczestników formularza partii.
  insert into public.play_participants (play_id, user_id, is_winner)
  select distinct v_play_id, candidate.user_id, false
  from (
    select actor_id as user_id
    union
    select v_meeting_created_by
    union
    select availability.user_id
    from public.meeting_availability as availability
    where availability.meeting_id = p_meeting_id
      and availability.is_available = true
  ) as candidate
  where candidate.user_id is not null
    and exists (
      select 1
      from public.app_members as membership
      where membership.user_id = candidate.user_id
        and membership.is_active = true
        and membership.role <> 'observer'::public.membership_role
    );

  perform private.recompute_play_rewards(
    private.play_reward_stakeholders(v_play_id),
    v_play_id,
    'Zapis partii w Kronice'
  );

  return v_play_id;
end;
$$;

revoke all on function public.start_meeting_play(uuid, uuid)
from public, anon, authenticated;
grant execute on function public.start_meeting_play(uuid, uuid) to authenticated;

-- 6. RPC: zakończenie spotkania ----------------------------------------------
--
-- Zamyka wieczór: spotkanie przestaje przejmować sekcję Stołu i wraca w niej
-- kolejne spotkanie. Krąg uprawnionych jest ten sam co w polityce
-- meetings_update_creator_or_admin, żeby „Zakończ spotkanie” nie było furtką
-- omijającą RLS. Zwraca false, gdy spotkanie już było zakończone — drugie
-- kliknięcie nie jest błędem.

create function public.complete_meeting(
  p_meeting_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_created_by uuid;
  v_status public.meeting_status;
begin
  if actor_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  select meeting.created_by, meeting.status
  into v_created_by, v_status
  from public.meetings as meeting
  where meeting.id = p_meeting_id
    and meeting.deleted_at is null
  for update;

  if not found then
    raise exception 'Meeting does not exist'
      using errcode = '23503';
  end if;

  if not (private.is_admin(actor_id) or v_created_by = actor_id) then
    raise exception 'Only the organizer or an admin can finish this meeting'
      using errcode = '42501';
  end if;

  -- Nie wolno zostawić biegnącej partii bez wyniku: po zakończeniu spotkania
  -- nic już jej nie pokaże na Stole, a Kronika miałaby wpis-widmo.
  if exists (
    select 1
    from public.plays as play
    where play.meeting_id = p_meeting_id
      and play.status = 'in_progress'::public.play_status
      and play.live_started_at is not null
  ) then
    raise exception 'Finish the running play before closing the meeting'
      using errcode = '23514';
  end if;

  if v_status = 'completed'::public.meeting_status then
    return false;
  end if;

  update public.meetings
  set status = 'completed'::public.meeting_status
  where id = p_meeting_id;

  return true;
end;
$$;

revoke all on function public.complete_meeting(uuid)
from public, anon, authenticated;
grant execute on function public.complete_meeting(uuid) to authenticated;
