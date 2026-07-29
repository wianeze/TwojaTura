-- Wyodrębnienie predykatów kwalifikacji odznak (M4 z planu „tryb kooperacyjny
-- + przeliczanie nagród”).
--
-- Do tej pory każdy warunek istniał w postaci „jeżeli warunek to przyznaj”,
-- wpleciony w trzy różne RPC. Deklaratywne przeliczanie potrzebuje czegoś
-- innego: czystej odpowiedzi na pytanie „czy ten użytkownik kwalifikuje się
-- TERAZ do tej odznaki?”, zadawanej niezależnie od tego, co się właśnie
-- wydarzyło. Ta migracja wprowadza taki predykat i przestawia na niego
-- wszystkie trzy RPC przyznające.
--
-- Warunki są przeniesione 1:1 z 20260706000100_play_in_progress_status.sql.
-- Jedyne celowe odstępstwo dotyczy `dark_urge` i jest opisane przy jego
-- gałęzi. Zachowanie widoczne dla testów pgTAP 185-229 pozostaje bez zmian.

-- ---------------------------------------------------------------------------
-- 1. Predykat kwalifikacji
-- ---------------------------------------------------------------------------

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

    -- === domena: partie =====================================================

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
      -- „Trzy zwycięstwa z rzędu”, wyrażone deklaratywnie: czy w historii
      -- użytkownika istnieje okno trzech kolejnych ukończonych partii, w
      -- których wszystkie były wygrane. Poprzednia wersja sprawdzała to
      -- względem konkretnej partii (okno kończące się na niej); zbiór
      -- kwalifikujących się użytkowników jest identyczny, bo każde okno musi
      -- się gdzieś kończyć, a odznaka i tak jest idempotentna.
      --
      -- CELOWE ODSTĘPSTWO: poprzednia implementacja używała
      -- `bool_and(placement = 1 or is_winner)`, a bool_and IGNORUJE wartości
      -- NULL. Dla uczestnika bez wpisanego miejsca i bez znacznika zwycięzcy
      -- `won` było NULL i po cichu wypadało z okna, sztucznie przedłużając
      -- serię. Tutaj NULL jest jawnie traktowany jako brak wygranej. Reguła
      -- `placement = 1 or is_winner` zostaje na razie bez zmian — usuwa ją
      -- dopiero migracja trybu kooperacyjnego.
      return exists (
        select 1
        from (
          select
            coalesce(participant.placement = 1, false) or participant.is_winner
              as won,
            lag(
              coalesce(participant.placement = 1, false) or participant.is_winner,
              1
            ) over chronology as previous_won,
            lag(
              coalesce(participant.placement = 1, false) or participant.is_winner,
              2
            ) over chronology as second_previous_won
          from public.play_participants as participant
          join public.plays as play on play.id = participant.play_id
          where participant.user_id = p_user_id
            and play.status = 'completed'
          window chronology as (
            order by play.played_at, play.created_at, play.id
          )
        ) as streak
        where streak.won
          and streak.previous_won
          and streak.second_previous_won
      );

    -- === domena: spotkania ==================================================

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
      -- Zależy zarówno od spotkań (autorstwo), jak i od partii (istnienie
      -- ukończonej partii przypiętej do spotkania) — stąd dwie domeny w
      -- achievement_domain_dependencies.
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

    -- === domena: oceny ======================================================

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

    -- === domena: kolekcja ===================================================

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
      -- Odznaki ręczne, sekretne i `planned` nie mają automatycznego warunku.
      -- Zwracamy false, więc recompute nigdy ich nie przyzna ani nie odbierze
      -- (patrz ścieżka A w private.apply_reward_delta).
      return false;
  end case;
end;
$$;

revoke all on function private.qualifies_for_achievement(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. RPC przyznające przestawione na predykat
-- ---------------------------------------------------------------------------

-- Sygnatury, kształt wyniku, kontrola uprawnień i wartości source_event_type
-- pozostają identyczne — zmienia się wyłącznie to, skąd pochodzi warunek.

create or replace function public.award_current_user_simple_achievements()
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_keys text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  candidate_key text;
  result record;
  total_awarded integer := 0;
  total_points integer := 0;
  keys text[] := array[]::text[];
begin
  if current_user_id is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required' using errcode = '42501';
  end if;

  -- Ta sama lista trzynastu odznak i ta sama kolejność co poprzednio —
  -- kolejność wpływa na zawartość awarded_keys, którą pinuje pgTAP.
  foreach candidate_key in array array[
    'critical_roll',
    'initiative_master',
    'party_bard',
    'coast_chronicler',
    'short_rest',
    'full_party',
    'lone_wolf',
    'side_quest',
    'guidance',
    'loot_goblin',
    'bag_of_holding',
    'fanboy',
    'one_more_turn'
  ]
  loop
    if private.qualifies_for_achievement(current_user_id, candidate_key) then
      select * into result
      from private.award_achievement_once(
        current_user_id, candidate_key, 'simple_achievement_check', current_user_id
      );

      if result.awarded then
        total_awarded := total_awarded + 1;
        total_points := total_points + result.points_awarded;
        keys := array_append(keys, result.achievement_key);
      end if;
    end if;
  end loop;

  return query select total_awarded, total_points, keys;
end;
$$;

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
    select 1
    from public.plays as play
    where play.id = p_play_id
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

  -- Partia nieukończona nie może wnieść osiągnięcia wynikowego.
  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and play.status = 'completed'
  ) then
    return query select total_awarded, total_points, recipients;
    return;
  end if;

  -- natural_one: zawężenie do uczestników, którzy zajęli w TEJ partii realne
  -- ostatnie miejsce, zostaje celowo — próg (trzy takie wyniki) pochodzi z
  -- predykatu, ale krąg rozpatrywanych osób pozostaje dokładnie taki jak
  -- dotąd, żeby ta migracja nie zmieniła zachowania.
  for participant in
    select current_participant.user_id
    from public.play_participants as current_participant
    where current_participant.play_id = p_play_id
      and private.is_active_member(current_participant.user_id)
      and private.is_real_last_place(
        current_participant.play_id,
        current_participant.user_id
      )
  loop
    if private.qualifies_for_achievement(participant.user_id, 'natural_one') then
      select * into result
      from private.award_achievement_once(
        participant.user_id,
        'natural_one',
        'play_result',
        p_play_id,
        null,
        current_user_id
      );

      if result.awarded then
        total_awarded := total_awarded + 1;
        total_points := total_points + result.points_awarded;
        recipients := array_append(recipients, participant.user_id);
      end if;
    end if;
  end loop;

  -- dark_urge: ta ścieżka celowo NIE korzysta z predykatu użytkownikowego.
  -- Predykat odpowiada na pytanie deklaratywne („czy w historii istnieje seria
  -- trzech zwycięstw?”) i taki jest potrzebny przeliczaniu. Tutaj natomiast
  -- obowiązuje węższy warunek historyczny: seria musi KOŃCZYĆ SIĘ na właśnie
  -- zapisywanej partii. Zachowujemy go bez zmian, żeby ta migracja pozostała
  -- czystym refaktorem — szersza semantyka wchodzi dopiero wraz z silnikiem
  -- recompute, który zastępuje tę ścieżkę w całości.
  for participant in
    select current_participant.user_id
    from public.play_participants as current_participant
    join public.plays as current_play
      on current_play.id = current_participant.play_id
    where current_participant.play_id = p_play_id
      and current_play.status = 'completed'
      and private.is_active_member(current_participant.user_id)
      and (
        select count(*) = 3 and bool_and(recent_result.won)
        from (
          select
            history_participant.placement = 1
              or history_participant.is_winner as won
          from public.play_participants as history_participant
          join public.plays as history_play
            on history_play.id = history_participant.play_id
          where history_participant.user_id = current_participant.user_id
            and history_play.status = 'completed'
            and (
              history_play.played_at,
              history_play.created_at,
              history_play.id
            ) <= (
              current_play.played_at,
              current_play.created_at,
              current_play.id
            )
          order by
            history_play.played_at desc,
            history_play.created_at desc,
            history_play.id desc
          limit 3
        ) as recent_result
      )
  loop
    select * into result
    from private.award_achievement_once(
      participant.user_id,
      'dark_urge',
      'play_result_streak',
      p_play_id,
      null,
      current_user_id
    );

    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      recipients := array_append(recipients, participant.user_id);
    end if;
  end loop;

  return query select total_awarded, total_points, recipients;
end;
$$;

create or replace function public.award_meeting_achievements(
  p_play_id uuid
)
returns table (
  awarded_count integer,
  points_awarded integer,
  awarded_keys text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  meeting_host_id uuid;
  result record;
  total_awarded integer := 0;
  total_points integer := 0;
  keys text[] := array[]::text[];
begin
  if current_user_id is null or not private.is_active_member(current_user_id) then
    raise exception 'Active membership is required'
      using errcode = '42501';
  end if;

  if p_play_id is null then
    raise exception 'Play is required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.plays as play
    where play.id = p_play_id
      and (play.created_by = current_user_id or private.is_admin(current_user_id))
  ) then
    raise exception 'Only the play author or an administrator can award meeting achievements'
      using errcode = '42501';
  end if;

  select meeting.created_by
  into meeting_host_id
  from public.plays as play
  join public.meetings as meeting on meeting.id = play.meeting_id
  where play.id = p_play_id;

  if meeting_host_id is null then
    return query select total_awarded, total_points, keys;
    return;
  end if;

  if private.qualifies_for_achievement(meeting_host_id, 'camp_host') then
    select * into result
    from private.award_achievement_once(
      meeting_host_id,
      'camp_host',
      'meeting_completion',
      meeting_host_id,
      null,
      current_user_id
    );

    if result.awarded then
      total_awarded := total_awarded + 1;
      total_points := total_points + result.points_awarded;
      keys := array_append(keys, result.achievement_key);
    end if;
  end if;

  return query select total_awarded, total_points, keys;
end;
$$;
