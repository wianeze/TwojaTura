-- Korekta stanu „GRAMY!” po testach przy stole (poprawka do 20260809120000).
--
-- Cztery rzeczy okazały się w praktyce za sztywne:
--
--  1. UPRAWNIENIA. Partię mógł rozpocząć każdy piszący, ale zakończyć już tylko
--     jej autor. Przy stole telefon krąży — kto kliknął start, bywa kimś innym
--     niż ten, kto ogłasza koniec. Teraz decyduje UCZESTNICTWO W SPOTKANIU, nie
--     autorstwo wiersza.
--
--  2. KONIEC GRANIA ≠ WYNIK. „Zakończ partię” prowadziło prosto do formularza
--     Kroniki i wymuszało zwycięzcę. Wieczór planszówkowy tak nie działa:
--     najpierw kończymy grać, wynik uzupełniamy później.
--
--  3. POMYŁKOWY START. Kliknięcie złej okładki dawało partię, której nie dało
--     się usunąć inaczej niż przez wpisanie fikcyjnego wyniku.
--
--  4. ODKŁADANIE I KONTYNUACJA. Kronika od dawna umie partię odłożoną
--     (in_progress + state_note) i kontynuowaną na kolejnym wieczorze
--     (meetings.continued_play_id). Poprzednia migracja tego nie widziała i
--     wręcz BLOKOWAŁA kontynuację każdej partii ze znacznikiem live. Tu wraca
--     to na właściwe tory: „GRAMY!” korzysta z istniejącego mechanizmu
--     kontynuacji zamiast zakładać, że wybór gry zawsze zaczyna coś nowego.
--
-- MODEL STANÓW. Nadal jeden wiersz public.plays na całą rozgrywkę, nadal bez
-- nowej tabeli i bez nowej wartości play_status. Dochodzą dwie kolumny:
-- live_ended_at (koniec bieżącej sesji przy stole) i result_pending
-- (rozgrywka dobiegła końca, brakuje tylko wyniku).
--
--   | stan                          | status      | live_started_at | live_ended_at | result_pending |
--   |-------------------------------|-------------|-----------------|---------------|----------------|
--   | gramy TERAZ                   | in_progress | ustawione       | NULL          | false          |
--   | zagrane, wynik do uzupełnienia| in_progress | ustawione       | ustawione     | TRUE           |
--   | odłożona przy stole           | in_progress | ustawione       | ustawione     | false          |
--   | odłożona z Kroniki (bez zmian)| in_progress | NULL            | NULL          | false          |
--   | wynik uzupełniony             | completed   | dowolne         | dowolne       | false          |
--
-- Dlaczego result_pending, a nie samo live_ended_at: „skończyliśmy grać” i
-- „przerywamy, wrócimy do tego” wyglądają w danych identycznie (sesja się
-- skończyła, wyniku nie ma), a znaczą coś przeciwnego — pierwsza czeka na
-- wynik, druga na kolejną sesję. Bez jawnego znacznika nie da się ich
-- rozróżnić inaczej niż przeciążając state_note, co zabroniłoby odkładania
-- partii bez pisania notatki.
--
-- Punkty i odznaki nadal wchodzą DOKŁADNIE w jednym miejscu: przy przejściu w
-- 'completed' przez update_play_with_participants. Żaden ze stanów pośrednich
-- niczego nie nalicza.
--
-- CZAS. duration_minutes staje się ŁĄCZNYM czasem rozgrywki: każda zamknięta
-- sesja przy stole dokłada do niego swoje minuty. Czas bieżącej sesji liczy się
-- z live_started_at, więc kontynuacja pokazuje jednocześnie „dzisiaj” i
-- „łącznie”, nie gubiąc historii.

-- 1. Kolumny -----------------------------------------------------------------

alter table public.plays
  add column live_ended_at timestamptz,
  add column result_pending boolean not null default false;

comment on column public.plays.live_ended_at is
  'Koniec ostatniej sesji przy stole. Ustawiony przy status = in_progress oznacza, że nikt już nie gra: albo czekamy na wynik (result_pending), albo partia jest odłożona do kontynuacji.';

comment on column public.plays.result_pending is
  'Rozgrywka dobiegła końca, brakuje tylko wyniku. Odróżnia „zagrane, wpiszemy później” od partii odłożonej, do której grupa wróci. Nigdy true dla partii ukończonej.';

alter table public.plays
  add constraint plays_live_ended_after_started check (
    live_ended_at is null
    or (live_started_at is not null and live_ended_at >= live_started_at)
  );

-- Wynik może być „do uzupełnienia” wyłącznie dla partii, w którą już zagrano do
-- końca przy stole i która nie została jeszcze rozliczona.
alter table public.plays
  add constraint plays_result_pending_requires_finished_session check (
    result_pending = false
    or (status = 'in_progress' and live_ended_at is not null)
  );

-- 2. Blokada „jednej aktywnej partii” dotyczy tylko FAKTYCZNIE trwającej ------
--
-- Poprzedni indeks liczył każdą partię in_progress ze znacznikiem startu, więc
-- Frostpunk czekający na wynik (albo odłożony) blokował rozpoczęcie Heat tego
-- samego wieczoru. Teraz slot zwalnia się w chwili zakończenia sesji.

drop index if exists public.plays_single_live_per_meeting_idx;

create unique index plays_single_live_per_meeting_idx
  on public.plays (meeting_id)
  where meeting_id is not null
    and live_started_at is not null
    and live_ended_at is null
    and status = 'in_progress';

-- Uwaga: partia wznowiona jako kontynuacja ma meeting_id spotkania STARTOWEGO,
-- więc powyższy indeks nie pilnuje jej na spotkaniu-kontynuacji. Tej reguły nie
-- da się wyrazić jednym indeksem częściowym (dotyczy dwóch tabel), dlatego
-- domykają ją start_meeting_play i resume_meeting_play — obie blokują wiersz
-- spotkania (for update) i odmawiają, gdy jakakolwiek partia tego wieczoru
-- nadal biegnie. Samo „jedno spotkanie kontynuuje najwyżej jedną partię”
-- wymusza z kolei to, że continued_play_id jest kolumną, a nie tabelą.

-- 3. Kto jest uczestnikiem spotkania ------------------------------------------
--
-- Ta sama definicja, którą widzi użytkownik na karcie spotkania („Kto będzie?”
-- = organizator + zaproszeni), poszerzona o osoby, które same potwierdziły
-- obecność. Świadomie NIE obejmuje wszystkich aktywnych członków: uprawnienie
-- ma być związane z konkretnym wieczorem, a nie z samym posiadaniem konta.

create function private.is_meeting_participant(
  p_meeting_id uuid,
  p_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_meeting_id is not null
    and p_user_id is not null
    and (
      exists (
        select 1
        from public.meetings as meeting
        where meeting.id = p_meeting_id
          and meeting.deleted_at is null
          and meeting.created_by = p_user_id
      )
      or exists (
        select 1
        from public.meeting_invitations as invitation
        where invitation.meeting_id = p_meeting_id
          and invitation.user_id = p_user_id
      )
      or exists (
        select 1
        from public.meeting_availability as availability
        where availability.meeting_id = p_meeting_id
          and availability.user_id = p_user_id
          and availability.is_available = true
      )
    );
$$;

revoke all on function private.is_meeting_participant(uuid, uuid)
from public, anon, authenticated;

-- Strażnik akcji wykonywanych PRZED powstaniem partii (start, wznowienie).
create function private.assert_can_run_meeting_play(
  p_meeting_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  if p_meeting_id is null then
    raise exception 'Only a meeting play can be managed at the table'
      using errcode = '23514';
  end if;

  if not (
    private.is_admin(p_actor_id)
    or private.is_meeting_participant(p_meeting_id, p_actor_id)
  ) then
    raise exception 'Only a participant of this meeting can manage its plays'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_can_run_meeting_play(uuid, uuid)
from public, anon, authenticated;

-- Strażnik akcji na ISTNIEJĄCEJ partii przy stole. Liczy się uczestnictwo w
-- spotkaniu startowym ALBO w którymkolwiek spotkaniu kontynuującym tę partię —
-- inaczej kontynuacja u kogoś innego byłaby nieobsługiwalna przez tych, którzy
-- przy tym stole faktycznie siedzą.
create function private.can_manage_meeting_play(
  p_play_id uuid,
  p_actor_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_actor_id is not null
    and exists (
      select 1
      from public.plays as play
      where play.id = p_play_id
        and (
          private.is_meeting_participant(play.meeting_id, p_actor_id)
          or exists (
            select 1
            from public.meetings as continuation
            where continuation.continued_play_id = play.id
              and continuation.deleted_at is null
              and private.is_meeting_participant(continuation.id, p_actor_id)
          )
        )
    );
$$;

revoke all on function private.can_manage_meeting_play(uuid, uuid)
from public, anon, authenticated;

create function private.assert_can_manage_meeting_play(
  p_play_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_actor_id is null or not private.current_user_can_write() then
    raise exception 'Active membership with write access is required'
      using errcode = '42501';
  end if;

  if not (
    private.is_admin(p_actor_id)
    or private.can_manage_meeting_play(p_play_id, p_actor_id)
  ) then
    raise exception 'Only a participant of this meeting can manage its plays'
      using errcode = '42501';
  end if;
end;
$$;

revoke all on function private.assert_can_manage_meeting_play(uuid, uuid)
from public, anon, authenticated;

-- 4. Partia możliwa do kontynuacji --------------------------------------------
--
-- Jedna definicja dla wszystkich ścieżek: formularza spotkania, pickera przy
-- stole i walidacji wskaźnika kontynuacji. Ukończona partia jest historią i
-- NIGDY tu nie trafia; partia czekająca na wynik też nie — jej rozgrywka już
-- się skończyła, brakuje wyłącznie rozliczenia.

create function private.is_continuable_play(p_play_id uuid)
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
      and play.result_pending = false
      and (play.live_started_at is null or play.live_ended_at is not null)
  );
$$;

revoke all on function private.is_continuable_play(uuid)
from public, anon, authenticated;

-- Poprzednia migracja odrzucała kontynuację każdej partii ze znacznikiem live —
-- także prawidłowo odłożonej. Blokadą zostaje wyłącznie sesja FAKTYCZNIE
-- trwająca oraz partia czekająca na wynik.
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
  v_live_ended_at timestamptz;
  v_result_pending boolean;
begin
  if p_play_id is null then
    return;
  end if;

  select
    play.status,
    play.meeting_id,
    play.live_started_at,
    play.live_ended_at,
    play.result_pending
  into
    v_status,
    v_start_meeting_id,
    v_live_started_at,
    v_live_ended_at,
    v_result_pending
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

  if v_live_started_at is not null and v_live_ended_at is null then
    raise exception 'A play running live at the table cannot be continued yet'
      using errcode = '23514';
  end if;

  if v_result_pending then
    raise exception 'A play waiting for its result is finished and cannot be continued'
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

-- 5. Start partii: uczestnik zamiast „ktokolwiek piszący” ---------------------

create or replace function public.start_meeting_play(
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

  perform private.assert_can_run_meeting_play(p_meeting_id, actor_id);

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

  -- Idempotencja: liczy się wyłącznie partia FAKTYCZNIE trwająca. Wcześniejsze
  -- partie czekające na wynik ani odłożone nie blokują kolejnej gry.
  select play.id
  into v_play_id
  from public.plays as play
  where play.meeting_id = p_meeting_id
    and play.status = 'in_progress'::public.play_status
    and play.live_started_at is not null
    and play.live_ended_at is null;

  if v_play_id is null then
    select continued.continued_play_id
    into v_play_id
    from public.meetings as continued
    join public.plays as play on play.id = continued.continued_play_id
    where continued.id = p_meeting_id
      and play.status = 'in_progress'::public.play_status
      and play.live_started_at is not null
      and play.live_ended_at is null;
  end if;

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
    'competitive'::public.play_mode,
    true
  )
  returning id into v_play_id;

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

-- 6. Zamknięcie sesji przy stole ----------------------------------------------
--
-- Jedna funkcja obsługuje dwa wyjścia z „GRAMY!”, bo mechanicznie robią to
-- samo — zatrzymują zegar i doliczają minuty do łącznego czasu rozgrywki.
-- Różni je wyłącznie to, co znaczą dalej:
--
--   p_result_pending = true   „Zakończ partię”  — rozgrywka skończona,
--                             brakuje wyniku; partia czeka na rozliczenie,
--   p_result_pending = false  „Odłóż partię”    — rozgrywka trwa dalej,
--                             wrócimy do niej na kolejnej sesji.
--
-- Świadomie NIE woła recompute_play_rewards: dopóki partia nie jest
-- 'completed', nie ma czego naliczać, a wywołanie silnika sugerowałoby, że coś
-- się tu rozlicza. Wynik uzupełnia później update_play_with_participants —
-- dokładnie ta sama ścieżka co przy ręcznym wpisie w Kronice.

create function public.finish_meeting_play(
  p_play_id uuid,
  p_result_pending boolean default true,
  p_state_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_status public.play_status;
  v_live_started_at timestamptz;
  v_live_ended_at timestamptz;
  v_state_note text;
begin
  select play.status, play.live_started_at, play.live_ended_at, play.state_note
  into v_status, v_live_started_at, v_live_ended_at, v_state_note
  from public.plays as play
  where play.id = p_play_id
  for update;

  if not found then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  perform private.assert_can_manage_meeting_play(p_play_id, actor_id);

  if v_live_started_at is null then
    raise exception 'Only a play started at the table can be finished this way'
      using errcode = '23514';
  end if;

  -- Idempotencja: powtórzone kliknięcie („zakończ” dwa razy, retry po
  -- timeoucie) nie przesuwa czasu zakończenia ani nie dolicza minut drugi raz.
  if v_live_ended_at is not null or v_status = 'completed'::public.play_status then
    return p_play_id;
  end if;

  update public.plays
  set
    live_ended_at = now(),
    result_pending = p_result_pending,
    -- Łączny czas rozgrywki: każda zamknięta sesja dokłada swoje minuty, więc
    -- kontynuacja nie kasuje historii. Pełne minuty, minimum jedna
    -- (assert_valid_play_payload odrzuca czas trwania <= 0).
    duration_minutes = coalesce(duration_minutes, 0) + greatest(
      1,
      round(extract(epoch from (now() - live_started_at)) / 60.0)::integer
    ),
    state_note = coalesce(nullif(btrim(p_state_note), ''), v_state_note)
  where id = p_play_id;

  return p_play_id;
end;
$$;

revoke all on function public.finish_meeting_play(uuid, boolean, text)
from public, anon, authenticated;
grant execute on function public.finish_meeting_play(uuid, boolean, text)
to authenticated;

-- 7. Wznowienie odłożonej partii ----------------------------------------------
--
-- Kontynuacja jedzie na ISTNIEJĄCYM mechanizmie: plays.meeting_id zostaje
-- kotwicą startu (nieprzepinaną), a spotkanie, na którym wracamy do gry,
-- dostaje meetings.continued_play_id. Wpis w Kronice zostaje jeden, więc punkty
-- i odznaki nadal naliczą się dokładnie raz.

create function public.resume_meeting_play(
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

  if v_meeting_status = 'completed'::public.meeting_status then
    raise exception 'Meeting is already finished'
      using errcode = '23514';
  end if;

  select play.meeting_id, play.live_started_at, play.live_ended_at
  into v_start_meeting_id, v_live_started_at, v_live_ended_at
  from public.plays as play
  where play.id = p_play_id
  for update;

  if not found then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  -- Idempotencja: partia już wznowiona na tym wieczorze to nie błąd.
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

  select play.id
  into v_running_play_id
  from public.plays as play
  where play.meeting_id = p_meeting_id
    and play.status = 'in_progress'::public.play_status
    and play.live_started_at is not null
    and play.live_ended_at is null;

  if v_running_play_id is not null then
    raise exception 'Finish the running play before resuming another one'
      using errcode = '23514';
  end if;

  -- Spotkanie startowe nie zostaje własną kontynuacją: wznowienie partii tam,
  -- gdzie się zaczęła, to po prostu kolejna sesja tego samego wieczoru.
  if v_start_meeting_id is distinct from p_meeting_id then
    if v_current_continued_play_id is not null
      and v_current_continued_play_id <> p_play_id then
      raise exception 'This meeting already continues another play'
        using errcode = '23514';
    end if;

    if v_current_continued_play_id is null then
      perform private.assert_valid_continued_play(p_meeting_id, p_play_id);

      update public.meetings
      set continued_play_id = p_play_id
      where id = p_meeting_id;
    end if;
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
grant execute on function public.resume_meeting_play(uuid, uuid) to authenticated;

-- 8. Anulowanie pomyłkowego startu -------------------------------------------
--
-- Kliknąłem nie tę okładkę. Partia ma zniknąć bez śladu: bez wpisu w Kronice,
-- bez punktów, bez wpływu na statystyki. Dlatego twardy DELETE, a nie status
-- „anulowana” — wiersz, którego nie ma, nie może przypadkiem wejść do żadnego
-- predykatu osiągnięć ani do żadnego zestawienia.
--
-- Bardzo wąski zakres: wyłącznie sesja faktycznie trwająca, i tylko taka, która
-- NIE MA wcześniejszej historii. Wznowionej kontynuacji tędy skasować się nie
-- da — usunęłoby to godziny gry z poprzednich wieczorów.

create function public.cancel_meeting_play(
  p_play_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  v_status public.play_status;
  v_live_started_at timestamptz;
  v_live_ended_at timestamptz;
  v_duration_minutes integer;
  stakeholders uuid[];
  deleted_play_id uuid;
begin
  select play.status, play.live_started_at, play.live_ended_at, play.duration_minutes
  into v_status, v_live_started_at, v_live_ended_at, v_duration_minutes
  from public.plays as play
  where play.id = p_play_id
  for update;

  -- Drugie kliknięcie „Anuluj partię” trafia już w pustkę — to nie jest błąd.
  if not found then
    return false;
  end if;

  perform private.assert_can_manage_meeting_play(p_play_id, actor_id);

  if v_live_started_at is null
    or v_live_ended_at is not null
    or v_status <> 'in_progress'::public.play_status then
    raise exception 'Only a play running at the table can be cancelled'
      using errcode = '23514';
  end if;

  if coalesce(v_duration_minutes, 0) > 0
    or exists (
      select 1
      from public.meetings as continuation
      where continuation.continued_play_id = p_play_id
    ) then
    raise exception 'A play with earlier sessions cannot be cancelled'
      using errcode = '23514';
  end if;

  -- Zdejmowane przed DELETE — po kaskadzie nie ma już uczestników. Partia nigdy
  -- nie była 'completed', więc nie ma czego cofać; przeliczenie jest tu
  -- gwarancją, że nie zostanie po niej ŻADEN ślad w stanach nagród
  -- (play_reward_states.last_play_id ma on delete set null).
  stakeholders := private.play_reward_stakeholders(p_play_id);

  delete from public.plays
  where id = p_play_id
  returning id into deleted_play_id;

  if deleted_play_id is null then
    return false;
  end if;

  perform private.recompute_play_rewards(
    stakeholders,
    null,
    'Anulowanie rozpoczętej partii'
  );

  return true;
end;
$$;

revoke all on function public.cancel_meeting_play(uuid)
from public, anon, authenticated;
grant execute on function public.cancel_meeting_play(uuid) to authenticated;

-- 9. Zakończenie spotkania: blokuje tylko trwająca partia ---------------------
--
-- Partie czekające na wynik i partie odłożone NIE blokują zamknięcia wieczoru —
-- po to powstały te stany. Blokadą zostaje wyłącznie gra, która nadal biegnie:
-- zamknięcie spotkania zabrałoby jej jedyne miejsce, z którego widać licznik.

create or replace function public.complete_meeting(
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

  -- Zamknięcie wieczoru zostaje decyzją organizatora/admina: to zmiana stanu
  -- samego SPOTKANIA, więc krąg uprawnionych jest ten sam co w polityce
  -- meetings_update_creator_or_admin. Uczestnicy sterują partiami, nie
  -- spotkaniem.
  if not (private.is_admin(actor_id) or v_created_by = actor_id) then
    raise exception 'Only the organizer or an admin can finish this meeting'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.plays as play
    where play.status = 'in_progress'::public.play_status
      and play.live_started_at is not null
      and play.live_ended_at is null
      and (
        play.meeting_id = p_meeting_id
        or exists (
          select 1
          from public.meetings as continuation
          where continuation.id = p_meeting_id
            and continuation.continued_play_id = play.id
        )
      )
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

-- 10. Uzupełnienie wyniku przez uczestnika spotkania --------------------------
--
-- Jedyne zmiany w tej funkcji to blok autoryzacji i zdjęcie result_pending przy
-- rozliczeniu. Reszta — walidacja ładunku, zapis, przepisanie uczestników,
-- przeliczenie nagród — zostaje nietknięta, żeby wynik uzupełniony ze Stołu
-- przechodził DOKŁADNIE tą samą finalizacją co ręczna edycja w Kronice
-- (WIN/LOST, miejsca, punkty, odznaki, side-effecty).
--
-- Rozszerzenie uprawnień jest wąskie i zakotwiczone w spotkaniu:
--   * partia BEZ meeting_id  — bez zmian: autor albo admin,
--   * partia ZE spotkaniem   — dodatkowo uczestnik tego spotkania (lub
--     spotkania, na którym partia jest kontynuowana), ale bez prawa przepięcia
--     jej na inne spotkanie — to zmieniłoby zakres uprawnienia w locie.
--
-- Polityka RLS plays_update_creator_or_admin celowo NIE jest poszerzana:
-- aplikacja pisze do plays wyłącznie przez to RPC, więc bezpośredni UPDATE na
-- tabeli zostaje wąski.

create or replace function public.update_play_with_participants(
  p_play_id uuid,
  p_game_id uuid,
  p_played_at timestamptz,
  p_meeting_id uuid default null,
  p_duration_minutes integer default null,
  p_comment text default null,
  p_participants jsonb default '[]'::jsonb,
  p_status public.play_status default 'completed',
  p_state_note text default null,
  p_mode public.play_mode default 'competitive',
  p_team_result public.play_team_result default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  updated_play_id uuid;
  actor_id uuid := auth.uid();
  stakeholders_before uuid[];
  stakeholders_after uuid[];
  v_created_by uuid;
  v_meeting_id uuid;
  v_is_owner boolean;
begin
  if actor_id is null then
    raise exception 'Authenticated user required'
      using errcode = '42501';
  end if;

  perform private.assert_valid_play_payload(
    p_duration_minutes,
    p_participants,
    p_status,
    p_mode,
    p_team_result
  );

  select play.created_by, play.meeting_id
  into v_created_by, v_meeting_id
  from public.plays as play
  where play.id = p_play_id;

  if not found or not private.current_user_can_write() then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  v_is_owner := private.is_admin() or v_created_by = actor_id;

  if not v_is_owner
    and not private.can_manage_meeting_play(p_play_id, actor_id) then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  if not v_is_owner and p_meeting_id is distinct from v_meeting_id then
    raise exception 'A meeting participant cannot move this play to another meeting'
      using errcode = '42501';
  end if;

  stakeholders_before := private.play_reward_stakeholders(p_play_id);

  -- Zmiana trybu nie wymaga tu żadnego czyszczenia miejsc: zestaw uczestników
  -- jest i tak kasowany oraz wstawiany od nowa, a walidator wymusił już, że
  -- ładunek kooperacyjny nie zawiera miejsc ani niespójnych zwycięzców.
  update public.plays
  set
    game_id = p_game_id,
    meeting_id = p_meeting_id,
    played_at = p_played_at,
    duration_minutes = p_duration_minutes,
    comment = p_comment,
    status = p_status,
    state_note = p_state_note,
    mode = p_mode,
    team_result = p_team_result,
    -- Rozliczona partia przestaje czekać na wynik. Zapisana ponownie jako
    -- „w toku” zostaje tam, gdzie była.
    result_pending = case
      when p_status = 'completed'::public.play_status then false
      else result_pending
    end
  where id = p_play_id
  returning id into updated_play_id;

  if updated_play_id is null then
    raise exception 'Play not found or not accessible'
      using errcode = '42501';
  end if;

  delete from public.play_participants
  where play_id = p_play_id;

  insert into public.play_participants (
    play_id, user_id, placement, score, is_winner
  )
  select
    p_play_id,
    participant.user_id,
    participant.placement,
    participant.score,
    coalesce(participant.is_winner, false)
  from jsonb_to_recordset(coalesce(p_participants, '[]'::jsonb)) as participant(
    user_id uuid,
    placement smallint,
    score numeric(12, 2),
    is_winner boolean
  );

  stakeholders_after := private.play_reward_stakeholders(p_play_id);

  perform private.recompute_play_rewards(
    stakeholders_before || stakeholders_after,
    p_play_id,
    'Edycja partii w Kronice'
  );

  return updated_play_id;
end;
$$;
