-- Silnik deklaratywnego przeliczania nagród (M5 z planu „tryb kooperacyjny +
-- przeliczanie nagród”).
--
-- Księga public.point_events pozostaje bezwarunkowo append-only. Cofnięcie
-- nagrody to NIE usunięcie wiersza, tylko dopisanie zdarzenia kompensującego o
-- wartości dokładnie przeciwnej, w kolejnej rewizji. Dzięki temu cykl
-- „przyznane -> cofnięte -> przyznane ponownie” daje rewizje 0/1/2, trzy
-- wiersze w księdze i saldo równe wartości wyjściowej.
--
-- ===========================================================================
-- MODEL LEGACY vs MANAGED
-- ===========================================================================
--
-- Przeliczanie jest deklaratywne: „ukończona partia powinna mieć punkty za
-- zapis”. Zastosowane wprost do danych historycznych oznaczałoby dopisanie
-- +40 za każdą dawną partię, która takich punktów nigdy nie dostała — czyli
-- naprawianie historii przez zgadywanie i zmianę sald wstecz. Tego nie robimy.
--
-- Dlatego każda partia ma jawny znacznik plays.rewards_managed:
--
--   * DEFAULT FALSE — „legacy-untracked”. Domyślnie żadna partia nie jest
--     zarządzana przez silnik nagród. Wartość domyślna jest celowo
--     zachowawcza: partia wstawiona z pominięciem RPC (dane historyczne, seed,
--     fixture QA) nigdy nie dostanie punktów z mocą wsteczną i nigdy ich nie
--     straci.
--
--   * TRUE — „managed”. Nadawane wyłącznie w dwóch jednoznacznych sytuacjach:
--       1. backfill poniżej — partia, która JUŻ MA dodatnie saldo zdarzeń
--          'play_logged', czyli została rozpoznana bez zgadywania,
--       2. utworzenie partii przez public.create_play_with_participants po
--          wdrożeniu (ustawiane w M6) — partia „urodzona” w nowym systemie.
--
-- Przejście legacy -> managed NIE następuje przez zwykłą edycję. Edycja
-- dawnej partii przelicza wszystko poza jej punktami za zapis: uczestnicy,
-- wynik i osiągnięcia są aktualizowane normalnie, ale punkty 'play_logged'
-- tej partii pozostają poza zakresem. Promocja wymaga świadomej decyzji
-- operatora (zmiana flagi) — celowo nie udostępniamy na to ścieżki z UI, bo
-- każda taka promocja zmienia historyczne saldo i ranking.
--
-- Zakres legacy obejmuje WYŁĄCZNIE punkty za zapisanie partii. Osiągnięcia są
-- z natury użytkownikowe (liczniki, serie) i przeliczają się normalnie —
-- inaczej edycja partii mogłaby zostawić użytkownika z odznaką, do której
-- przestał się kwalifikować.

-- ---------------------------------------------------------------------------
-- 1. Znacznik zarządzania nagrodami partii
-- ---------------------------------------------------------------------------

alter table public.plays
  add column rewards_managed boolean not null default false;

comment on column public.plays.rewards_managed is
  'Czy punkty za zapis tej partii podlegają przeliczaniu. FALSE = dane sprzed wdrożenia silnika nagród (legacy-untracked): nigdy nie dostaną punktów wstecz. Ustawiane na TRUE tylko przez backfill rozpoznanych partii oraz przez RPC tworzące nową partię.';

-- Backfill bez zgadywania: zarządzane są dokładnie te partie, dla których
-- istnieje już dodatnie saldo zdarzeń 'play_logged'. To ten sam zbiór, dla
-- którego M3 utworzyła wiersze play_reward_states.
update public.plays as play
set rewards_managed = true
where exists (
  select 1
  from public.point_events as event
  where event.action_type = 'play_logged'
    and event.related_entity_type = 'play'
    and event.related_entity_id = play.id
  group by event.user_id, event.related_entity_id
  having sum(event.points) > 0
);

create index plays_rewards_managed_idx
  on public.plays (created_by)
  where rewards_managed;

-- ---------------------------------------------------------------------------
-- 2. Serwerowe źródło wartości punktowej
-- ---------------------------------------------------------------------------

-- Wartość nagrody NIGDY nie pochodzi od klienta ani od wrappera TS. Publiczne
-- RPC nie mają parametru punktowego, a ta funkcja jest jedynym źródłem.
create or replace function private.reward_points_for(
  p_reward_type public.reward_type,
  p_reward_key text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_reward_type = 'play_points' then
    return private.point_reward_for('play_logged');
  end if;

  return coalesce(
    (
      select definition.points
      from public.achievement_definitions as definition
      where definition.achievement_key = p_reward_key
        and definition.is_active = true
    ),
    0
  );
end;
$$;

revoke all on function private.reward_points_for(public.reward_type, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Jedyna ścieżka usunięcia odznaki
-- ---------------------------------------------------------------------------

-- public.user_achievements nie ma polityki ani grantu DELETE dla roli
-- authenticated. Ta funkcja jest jedynym miejscem w całym systemie, które
-- kasuje z niej wiersz — i sama nie jest wywoływalna spoza schematu private.
create or replace function private.revoke_achievement(
  p_user_id uuid,
  p_achievement_key text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.user_achievements
  where user_id = p_user_id
    and achievement_key = p_achievement_key;

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;

revoke all on function private.revoke_achievement(uuid, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Atomowa zmiana stanu nagrody
-- ---------------------------------------------------------------------------

create or replace function private.apply_reward_delta(
  p_user_id uuid,
  p_reward_type public.reward_type,
  p_reward_key text,
  p_should_be_active boolean,
  p_play_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_state record;
  v_points integer;
  v_net integer;
  v_delta integer;
  v_next_revision integer;
  v_action_type text;
  v_entity_type text;
  v_entity_id uuid;
  v_description text;
  v_history_action public.achievement_history_action;
  v_actor uuid := coalesce(auth.uid(), p_user_id);
begin
  -- Konta ukryte (admin/obserwator) nie gromadzą nagród — ta sama zasada i to
  -- samo miejsce w łańcuchu co w private.award_points_once.
  if not private.is_active_member(p_user_id)
     or private.is_admin(p_user_id)
     or private.is_observer(p_user_id) then
    return false;
  end if;

  if p_reward_type = 'play_points' then
    v_action_type := 'play_logged';
    v_entity_type := 'play';
    v_entity_id := p_reward_key::uuid;
    v_description := 'Zapis partii w Kronice';
  else
    v_action_type := 'achievement_unlocked:' || p_reward_key;
    v_entity_type := 'profile';
    v_entity_id := p_user_id;
    v_description := coalesce(
      (
        select 'Odznaka: ' || definition.name
        from public.achievement_definitions as definition
        where definition.achievement_key = p_reward_key
      ),
      'Odznaka'
    );
  end if;

  select state.is_active, state.revision
  into v_state
  from public.play_reward_states as state
  where state.user_id = p_user_id
    and state.reward_type = p_reward_type
    and state.reward_key = p_reward_key
  for update;

  -- ==== ŚCIEŻKA A: brak stanu i nagroda nie powinna być aktywna ============
  -- Nie zapisujemy niczego. Niezmiennik „brak wiersza = nagroda nigdy nie
  -- była aktywna” wymaga, żeby nie powstawały stany is_active = false dla
  -- nagród nigdy niezdobytych.
  if not found then
    if not p_should_be_active then
      return false;
    end if;

    -- ==== ŚCIEŻKA B: pierwsze przyznanie ==================================
    v_points := private.reward_points_for(p_reward_type, p_reward_key);

    -- Wywołujący trzyma blokadę doradczą na p_user_id, więc kolizja jest
    -- niemożliwa. Ewentualne unique_violation celowo NIE jest połykane —
    -- oznaczałoby naruszenie protokołu blokad i musi być głośne.
    insert into public.play_reward_states (
      user_id, reward_type, reward_key, is_active, revision, last_play_id
    )
    values (p_user_id, p_reward_type, p_reward_key, true, 0, p_play_id);

    if v_points > 0 then
      insert into public.point_events (
        user_id, points, action_type, description,
        related_entity_type, related_entity_id, created_by, reward_revision
      )
      values (
        p_user_id, v_points, v_action_type, v_description,
        v_entity_type, v_entity_id, v_actor, 0
      )
      -- Uzgodnienie z nagrodą przyznaną starą ścieżką: zdarzenie rewizji 0
      -- mogło już powstać przez private.award_points_once /
      -- private.award_achievement_once, zanim istniał stan. Wtedy stan, który
      -- właśnie utworzyliśmy, poprawnie opisuje rzeczywistość (aktywna,
      -- rewizja 0, jedno zdarzenie) i nie wolno dopisywać duplikatu.
      on conflict do nothing;
    end if;

    if p_reward_type = 'achievement' then
      insert into public.user_achievements (
        user_id, achievement_key, awarded_by, source_event_type, source_entity_id
      )
      values (
        p_user_id, p_reward_key, v_actor, 'reward_recompute', p_play_id
      )
      on conflict on constraint user_achievements_pkey do nothing;

      insert into public.achievement_history (
        user_id, achievement_key, action, revision, reason,
        triggered_by_play_id, created_by
      )
      values (
        p_user_id, p_reward_key, 'granted', 0, p_reason, p_play_id, v_actor
      );
    end if;

    return true;
  end if;

  -- ==== ŚCIEŻKA C: stan istnieje i nic się nie zmienia =====================
  if v_state.is_active = p_should_be_active then
    return false;
  end if;

  -- ==== ŚCIEŻKA D: zmiana stanu ===========================================
  v_next_revision := v_state.revision + 1;

  if p_should_be_active then
    v_delta := private.reward_points_for(p_reward_type, p_reward_key);
    v_history_action := 'regranted';
  else
    -- Kompensata liczona z KSIĘGI, nie z aktualnej definicji: gdyby wartość
    -- odznaki zmieniła się między przyznaniem a cofnięciem, użycie bieżącej
    -- definicji zostawiłoby resztkę w saldzie.
    select coalesce(sum(event.points), 0)
    into v_net
    from public.point_events as event
    where event.user_id = p_user_id
      and event.action_type = v_action_type
      and event.related_entity_type = v_entity_type
      and event.related_entity_id = v_entity_id;

    if v_net < 0 then
      raise exception
        'Niespójność księgi nagród dla %/%: saldo % jest ujemne.',
        p_reward_type, p_reward_key, v_net
        using errcode = '23514';
    end if;

    v_delta := -v_net;
    v_history_action := 'revoked';
  end if;

  if v_delta <> 0 then
    insert into public.point_events (
      user_id, points, action_type, description,
      related_entity_type, related_entity_id, created_by, reward_revision
    )
    values (
      p_user_id, v_delta, v_action_type,
      case when p_should_be_active then v_description else p_reason end,
      v_entity_type, v_entity_id, v_actor, v_next_revision
    );
  end if;

  if p_reward_type = 'achievement' then
    if p_should_be_active then
      insert into public.user_achievements (
        user_id, achievement_key, awarded_by, source_event_type, source_entity_id
      )
      values (
        p_user_id, p_reward_key, v_actor, 'reward_recompute', p_play_id
      )
      on conflict on constraint user_achievements_pkey do nothing;
    else
      perform private.revoke_achievement(p_user_id, p_reward_key);
    end if;

    insert into public.achievement_history (
      user_id, achievement_key, action, revision, reason,
      triggered_by_play_id, created_by
    )
    values (
      p_user_id, p_reward_key, v_history_action, v_next_revision,
      p_reason, p_play_id, v_actor
    );
  end if;

  update public.play_reward_states as state
  set is_active = p_should_be_active,
      revision = v_next_revision,
      last_play_id = p_play_id
  where state.user_id = p_user_id
    and state.reward_type = p_reward_type
    and state.reward_key = p_reward_key;

  return true;
end;
$$;

revoke all on function private.apply_reward_delta(
  uuid, public.reward_type, text, boolean, uuid, text
) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Przeliczanie
-- ---------------------------------------------------------------------------

create or replace function private.recompute_play_rewards(
  p_user_ids uuid[],
  p_play_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_reward_key text;
  v_achievement_key text;
  v_changes integer := 0;
begin
  if p_user_ids is null or array_length(p_user_ids, 1) is null then
    return 0;
  end if;

  -- Blokady doradcze w ROSNĄCEJ kolejności user_id. Kolejność jest istotna:
  -- dwie równoległe mutacje o krzyżujących się zbiorach uczestników braną
  -- blokady w tym samym porządku, więc nie mogą się zakleszczyć. Blokada
  -- doradcza, a nie wierszowa, bo wiersz stanu może jeszcze nie istnieć
  -- (ścieżka B) — SELECT ... FOR UPDATE nie miałby czego zablokować.
  for v_user_id in
    select distinct unnested.user_id
    from unnest(p_user_ids) as unnested(user_id)
    where unnested.user_id is not null
    order by unnested.user_id
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  end loop;

  for v_user_id in
    select distinct unnested.user_id
    from unnest(p_user_ids) as unnested(user_id)
    where unnested.user_id is not null
    order by unnested.user_id
  loop
    -- 5a. Punkty za zapisanie partii.
    -- Stan docelowy to partie ukończone, autorstwa użytkownika i objęte
    -- zarządzaniem (rewards_managed). Suma ze stanami aktywnymi gwarantuje,
    -- że cofniemy punkty za partię usuniętą lub cofniętą do 'in_progress',
    -- a partie legacy w ogóle nie trafiają do rozpatrywania.
    for v_reward_key in
      select play.id::text
      from public.plays as play
      where play.created_by = v_user_id
        and play.status = 'completed'
        and play.rewards_managed
      union
      select state.reward_key
      from public.play_reward_states as state
      where state.user_id = v_user_id
        and state.reward_type = 'play_points'
        and state.is_active
    loop
      if private.apply_reward_delta(
        v_user_id,
        'play_points',
        v_reward_key,
        exists (
          select 1
          from public.plays as play
          where play.id = v_reward_key::uuid
            and play.created_by = v_user_id
            and play.status = 'completed'
            and play.rewards_managed
        ),
        p_play_id,
        p_reason
      ) then
        v_changes := v_changes + 1;
      end if;
    end loop;

    -- 5b. Odznaki, których warunek zależy od danych o partiach.
    for v_achievement_key in
      select dependency.achievement_key
      from public.achievement_domain_dependencies as dependency
      join public.achievement_definitions as definition
        on definition.achievement_key = dependency.achievement_key
      where dependency.domain = 'play'
        and definition.is_active = true
        and definition.is_manual = false
      order by dependency.achievement_key
    loop
      if private.apply_reward_delta(
        v_user_id,
        'achievement',
        v_achievement_key,
        private.qualifies_for_achievement(v_user_id, v_achievement_key),
        p_play_id,
        p_reason
      ) then
        v_changes := v_changes + 1;
      end if;
    end loop;
  end loop;

  return v_changes;
end;
$$;

revoke all on function private.recompute_play_rewards(uuid[], uuid, text)
  from public, anon, authenticated;
