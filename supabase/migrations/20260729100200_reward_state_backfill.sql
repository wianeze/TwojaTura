-- Preflight i backfill stanu nagród (M3 z planu „tryb kooperacyjny +
-- przeliczanie nagród”).
--
-- Cel: przed pierwszym uruchomieniem recompute tabela play_reward_states musi
-- odzwierciedlać rzeczywistość. Bez tego pierwszy recompute po edycji partii
-- potraktowałby istniejące nagrody jako „nigdy nieprzyznane” i wygenerowałby
-- fałszywe kompensaty albo podwójne przyznania.
--
-- Zasada: NIE ZGADUJEMY. Migracja najpierw weryfikuje spójność istniejących
-- danych, wypisuje raport liczbowy i przerywa się przy niespójności
-- krytycznej. Nie próbuje niczego naprawiać automatycznie.

-- ---------------------------------------------------------------------------
-- 1. Walidacja preflight
-- ---------------------------------------------------------------------------

create or replace function private.assert_reward_backfill_consistency()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_missing_event_auto integer;
  v_missing_event_manual integer;
  v_orphan_event integer;
  v_duplicate_reward integer;
  v_orphan_play_points integer;
  v_stale_play_points integer;
  v_critical integer;
begin
  -- KRYTYCZNA 1: posiadana odznaka o dodatniej wartości bez odpowiadającego
  -- zdarzenia punktowego. Nie powinna wystąpić: jedyną ścieżką przyznania
  -- jest private.award_achievement_once, które zawsze zapisuje oba wiersze, a
  -- `authenticated` nie ma grantu INSERT na user_achievements. Liczymy
  -- osobno odznaki ręczne, żeby komunikat był rozstrzygalny dla operatora.
  select
    count(*) filter (where not definition.is_manual),
    count(*) filter (where definition.is_manual)
  into v_missing_event_auto, v_missing_event_manual
  from public.user_achievements as earned
  join public.achievement_definitions as definition
    on definition.achievement_key = earned.achievement_key
  where definition.points > 0
    and not exists (
      select 1
      from public.point_events as event
      where event.user_id = earned.user_id
        and event.action_type = 'achievement_unlocked:' || earned.achievement_key
    );

  -- KRYTYCZNA 2: dodatnie saldo zdarzeń odznaki bez aktualnie posiadanej
  -- odznaki. Oznaczałoby punkty przyznane za odznakę, której użytkownik nie
  -- ma — stan nie do odtworzenia deklaratywnie.
  select count(*) into v_orphan_event
  from (
    select
      event.user_id,
      event.action_type,
      sum(event.points) as net_points
    from public.point_events as event
    where event.action_type like 'achievement\_unlocked:%'
    group by event.user_id, event.action_type
    having sum(event.points) > 0
  ) as ledger
  where not exists (
    select 1
    from public.user_achievements as earned
    where earned.user_id = ledger.user_id
      and 'achievement_unlocked:' || earned.achievement_key = ledger.action_type
  );

  -- KRYTYCZNA 3: więcej niż jedno zdarzenie dla nagrody, która ma zostać
  -- zapisana jako revision = 0. Naruszałoby niezmiennik „liczba zdarzeń =
  -- revision + 1”.
  select count(*) into v_duplicate_reward
  from (
    select event.user_id, event.action_type, count(*) as event_count
    from public.point_events as event
    where event.related_entity_type is not null
      and event.related_entity_id is not null
      and event.action_type <> 'admin_adjustment'
      and (
        event.action_type = 'play_logged'
        or event.action_type like 'achievement\_unlocked:%'
      )
    group by event.user_id, event.action_type, event.related_entity_id
    having count(*) > 1
  ) as duplicates;

  -- RAPORTOWANA 4: punkty za partię, która już nie istnieje. Świadomie
  -- zostawiamy — korekta zmieniłaby historyczne salda i ranking, więc wymaga
  -- osobnej, jawnie zatwierdzonej decyzji.
  select count(*) into v_orphan_play_points
  from public.point_events as event
  where event.action_type = 'play_logged'
    and event.related_entity_type = 'play'
    and not exists (
      select 1 from public.plays as play where play.id = event.related_entity_id
    );

  -- RAPORTOWANA 5: punkty za partię, która nie jest już 'completed'.
  -- Naprawi to pierwszy recompute dotyczący tej partii.
  select count(*) into v_stale_play_points
  from public.point_events as event
  join public.plays as play on play.id = event.related_entity_id
  where event.action_type = 'play_logged'
    and event.related_entity_type = 'play'
    and play.status <> 'completed';

  raise notice 'Preflight nagród — odznaka bez zdarzenia: % automatycznych, % ręcznych',
    v_missing_event_auto, v_missing_event_manual;
  raise notice 'Preflight nagród — zdarzenie bez odznaki: %', v_orphan_event;
  raise notice 'Preflight nagród — zduplikowane zdarzenia nagrody: %', v_duplicate_reward;
  raise notice 'Preflight nagród — punkty osieroconych partii (do decyzji): %',
    v_orphan_play_points;
  raise notice 'Preflight nagród — punkty partii bez statusu completed (naprawi recompute): %',
    v_stale_play_points;

  v_critical := v_missing_event_auto + v_missing_event_manual
    + v_orphan_event + v_duplicate_reward;

  if v_critical > 0 then
    raise exception
      'Niespójność danych nagród uniemożliwia backfill: % odznak bez zdarzenia (% ręcznych), % zdarzeń bez odznaki, % zduplikowanych nagród. Rozstrzygnij ręcznie — migracja niczego nie zgaduje.',
      v_missing_event_auto + v_missing_event_manual,
      v_missing_event_manual,
      v_orphan_event,
      v_duplicate_reward
      using errcode = '23514';
  end if;
end;
$$;

revoke all on function private.assert_reward_backfill_consistency()
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Backfill
-- ---------------------------------------------------------------------------

do $$
declare
  v_play_points_rows integer;
  v_achievement_rows integer;
begin
  perform private.assert_reward_backfill_consistency();

  -- Punkty za zapisanie partii: każde istniejące zdarzenie 'play_logged' o
  -- dodatnim saldzie odpowiada aktywnej nagrodzie w rewizji 0.
  insert into public.play_reward_states (
    user_id, reward_type, reward_key, is_active, revision, last_play_id
  )
  select
    ledger.user_id,
    'play_points'::public.reward_type,
    ledger.related_entity_id::text,
    true,
    0,
    ledger.related_entity_id
  from (
    select
      event.user_id,
      event.related_entity_id,
      sum(event.points) as net_points
    from public.point_events as event
    where event.action_type = 'play_logged'
      and event.related_entity_type = 'play'
      and event.related_entity_id is not null
    group by event.user_id, event.related_entity_id
    having sum(event.points) > 0
  ) as ledger
  -- last_play_id ma FK do plays: dla osieroconych zdarzeń (kategoria 4
  -- preflightu) zapisujemy stan, ale bez wskazania na nieistniejącą partię.
  where exists (select 1 from public.plays as play where play.id = ledger.related_entity_id)
  on conflict (user_id, reward_type, reward_key) do nothing;

  get diagnostics v_play_points_rows = row_count;

  -- Odznaki objęte przeliczaniem po zmianie partii, czyli te z zależnością
  -- 'play'. Odznaki innych domen nie mają dziś ścieżki recompute, więc
  -- świadomie nie tworzymy dla nich stanu — rozszerzenie recompute na kolejną
  -- domenę będzie wymagało analogicznego backfillu w tej samej migracji.
  insert into public.play_reward_states (
    user_id, reward_type, reward_key, is_active, revision, last_play_id
  )
  select
    earned.user_id,
    'achievement'::public.reward_type,
    earned.achievement_key,
    true,
    0,
    null
  from public.user_achievements as earned
  where exists (
    select 1
    from public.achievement_domain_dependencies as dependency
    where dependency.achievement_key = earned.achievement_key
      and dependency.domain = 'play'
  )
  on conflict (user_id, reward_type, reward_key) do nothing;

  get diagnostics v_achievement_rows = row_count;

  raise notice 'Backfill nagród — stany punktów za partie: %, stany odznak: %',
    v_play_points_rows, v_achievement_rows;
end;
$$;
