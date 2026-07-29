-- Reguły osiągnięć w świecie z trybem kooperacyjnym (M8 z planu).
--
-- Dwie zmiany:
--   * dark_urge — seria zwycięstw liczona spójnie dla obu trybów,
--   * natural_one — jawne wykluczenie partii kooperacyjnych.

-- ---------------------------------------------------------------------------
-- 1. natural_one: „ostatnie miejsce” nie istnieje w kooperacji
-- ---------------------------------------------------------------------------

-- Warunek był już odporny na kooperację pośrednio: wymaga niepustego placement
-- u KAŻDEGO uczestnika oraz co najmniej dwóch różnych wartości, a partia
-- kooperacyjna ma wyłącznie NULL-e. Dodajemy jednak filtr wprost — czytelność
-- reguły nie powinna zależeć od tego, że ktoś prześledzi konsekwencje NULL-i.
create or replace function private.is_real_last_place(p_play_id uuid, p_user_id uuid)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1
    from public.play_participants as target
    join public.plays as target_play on target_play.id = target.play_id
    where target.play_id = p_play_id
      and target.user_id = p_user_id
      and target_play.mode = 'competitive'
      and target.placement is not null
      and (
        select
          count(*) >= 2
          and count(*) filter (where participant.placement is not null) = count(*)
          and count(distinct participant.placement) >= 2
          and max(participant.placement) = target.placement
        from public.play_participants as participant
        where participant.play_id = target.play_id
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. dark_urge: jedna definicja zwycięstwa dla obu trybów
-- ---------------------------------------------------------------------------

-- Nowa reguła (decyzja właściciela):
--   * liczymy kolejne UKOŃCZONE partie użytkownika chronologicznie,
--   * zwycięstwo to wyłącznie is_winner — człon `placement = 1` znika,
--     bo w kooperacji miejsc nie ma, a w rywalizacji is_winner i tak jest
--     polem nośnym,
--   * kooperacyjna wygrana PODTRZYMUJE serię (is_winner = true u wszystkich),
--   * kooperacyjna porażka JĄ PRZERYWA (is_winner = false u wszystkich),
--   * rywalizacyjna porażka ją przerywa,
--   * partia BEZ WYNIKU nie jest liczona — ani nie przedłuża, ani nie przerywa.
--
-- Usunięcie członu `placement = 1` likwiduje przy okazji realny błąd: stara
-- wersja liczyła `bool_and(placement = 1 or is_winner)`, a bool_and IGNORUJE
-- NULL-e. Uczestnik bez wpisanego miejsca i bez znacznika zwycięzcy dawał
-- `won = NULL` i po cichu wypadał z okna, sztucznie przedłużając serię.
-- Po zmianie `won` to zwykły boolean NOT NULL i taka sytuacja nie istnieje.
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

  case p_achievement_key

    when 'critical_roll' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and participant.is_winner = true
          and play.status = 'completed'
      );

    when 'coast_chronicler' then
      return (
        select count(*)
        from public.plays
        where created_by = p_user_id
          and status = 'completed'
      ) >= 25;

    when 'short_rest' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.status = 'completed'
        group by (play.played_at at time zone 'Europe/Warsaw')::date
        having count(*) >= 2
      );

    when 'full_party' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.status = 'completed'
          and (
            select count(*)
            from public.play_participants as party
            where party.play_id = participant.play_id
          ) >= 5
      );

    when 'lone_wolf' then
      return exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.status = 'completed'
          and (
            select count(*)
            from public.play_participants as party
            where party.play_id = participant.play_id
          ) = 1
      );

    when 'side_quest' then
      -- Warunek autorski (created_by), świadomie nieuczestnikowy.
      return exists (
        select 1
        from public.plays
        where created_by = p_user_id
          and meeting_id is null
          and status = 'completed'
      );

    when 'natural_one' then
      return private.count_real_last_places(p_user_id) >= 3;

    when 'dark_urge' then
      return exists (
        select 1
        from (
          select
            participant.is_winner as won,
            lag(participant.is_winner, 1) over chronology as previous_won,
            lag(participant.is_winner, 2) over chronology as second_previous_won
          from public.play_participants as participant
          join public.plays as play on play.id = participant.play_id
          where participant.user_id = p_user_id
            and play.status = 'completed'
            -- Partia bez rozstrzygnięcia nie wchodzi do okna. Dotyczy to
            -- kooperacji bez zapisanego wyniku drużyny; partia rywalizacyjna
            -- zawsze niesie wynik przez is_winner.
            and (play.mode = 'competitive' or play.team_result is not null)
          window chronology as (
            order by play.played_at, play.created_at, play.id
          )
        ) as streak
        where streak.won
          and streak.previous_won
          and streak.second_previous_won
      );

    when 'initiative_master' then
      return (
        select count(*)
        from public.meetings
        where created_by = p_user_id
      ) >= 5;

    when 'guidance' then
      return (
        select count(*)
        from public.meeting_availability
        where user_id = p_user_id
          and is_available is not null
      ) >= 10;

    when 'camp_host' then
      return (
        select count(*)
        from public.meetings as meeting
        where meeting.created_by = p_user_id
          and exists (
            select 1
            from public.plays as play
            where play.meeting_id = meeting.id
              and play.status = 'completed'
          )
      ) >= 5;

    when 'party_bard' then
      return (
        select count(*)
        from public.ratings
        where user_id = p_user_id
          and nullif(btrim(comment), '') is not null
      ) >= 10;

    when 'fanboy' then
      return (
        select count(distinct game_id)
        from public.ratings
        where user_id = p_user_id
          and overall = 10
      ) >= 5;

    when 'one_more_turn' then
      return (
        select count(distinct game_id)
        from public.ratings
        where user_id = p_user_id
          and wants_to_play_again = true
      ) >= 20;

    when 'loot_goblin' then
      return (
        select count(*)
        from public.games
        where owner_id = p_user_id
          and archived_at is null
      ) >= 25;

    when 'bag_of_holding' then
      return (
        select count(*)
        from public.games
        where owner_id = p_user_id
          and archived_at is null
      ) >= 50;

    else
      return false;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ścieżka wynikowa przestaje dublować regułę serii
-- ---------------------------------------------------------------------------

-- W M4 ta funkcja zachowała własne, węższe zapytanie („seria kończąca się na
-- tej partii”), żeby refaktor nie zmienił zachowania. Teraz źródłem prawdy dla
-- obu trybów jest predykat, a przeliczanie i tak przyznaje odznaki w tej samej
-- transakcji co mutacja. Zostawiamy funkcję jako idempotentny no-op zgodny z
-- predykatem — jej wywołanie po recompute nie ma już nic do zrobienia.
create or replace function public.award_play_result_achievements(
  p_play_id uuid
)
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_user_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  result record;
  participant record;
  total_awarded integer := 0;
  total_points integer := 0;
  recipients uuid[] := array[]::uuid[];
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_play_id is null or not exists (
    select 1 from public.plays as play where play.id = p_play_id
  ) then
    raise exception 'Play does not exist'
      using errcode = '23503';
  end if;

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and (play.created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can award play result achievements'
      using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and play.status = 'completed'
  ) then
    return query select total_awarded, total_points, recipients;
    return;
  end if;

  for participant in
    select current_participant.user_id
    from public.play_participants as current_participant
    where current_participant.play_id = p_play_id
      and private.is_active_member(current_participant.user_id)
    order by current_participant.user_id
  loop
    if private.qualifies_for_achievement(participant.user_id, 'natural_one') then
      select * into result
      from private.award_achievement_once(
        participant.user_id, 'natural_one', 'play_result', p_play_id, null, current_user_id
      );
      if result.awarded then
        total_awarded := total_awarded + 1;
        total_points := total_points + result.points_awarded;
        recipients := array_append(recipients, participant.user_id);
      end if;
    end if;

    if private.qualifies_for_achievement(participant.user_id, 'dark_urge') then
      select * into result
      from private.award_achievement_once(
        participant.user_id, 'dark_urge', 'play_result_streak', p_play_id, null, current_user_id
      );
      if result.awarded then
        total_awarded := total_awarded + 1;
        total_points := total_points + result.points_awarded;
        recipients := array_append(recipients, participant.user_id);
      end if;
    end if;
  end loop;

  return query select total_awarded, total_points, recipients;
end;
$$;
