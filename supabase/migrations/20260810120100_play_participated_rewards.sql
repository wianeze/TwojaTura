-- Economy V2 — `play_logged` → `play_participated` (krok 2/3).
--
-- PROBLEM, KTÓRY TO NAPRAWIA. Do tej pory 40 Renomy za partię dostawała
-- wyłącznie osoba, która wpisała ją do Kroniki (plays.created_by). Ranking
-- mierzył więc obsługę aplikacji, a nie granie: czterech graczy przy jednym
-- stole dostawało 40 / 0 / 0 / 0.
--
-- Po tej migracji nagrodę dostaje KAŻDY rzeczywisty uczestnik ukończonej
-- partii, po 5 Renomy, jako osobna nagroda per (user_id, play_id). Osoba
-- wpisująca wynik nie dostaje nic dodatkowego za samą operację w UI.
--
-- DLACZEGO NIE NOWY MECHANIZM. Silnik z 20260729100400 ma już wszystko, czego
-- to wymaga: stan nagrody per (user, typ, klucz), rewizje, kompensaty i
-- blokady doradcze. Nagroda „udział w partii” jest po prostu tym samym
-- reward_type = 'play_points' policzonym po innym zbiorze użytkowników:
-- zamiast {autor} bierzemy {uczestnicy}. Klucz nagrody (plays.id) i tabela
-- stanu zostają bez zmian, więc nie powstaje drugi konkurencyjny mechanizm.
--
-- JEDNA ISTOTNA ZMIANA W SILNIKU. Dotąd apply_reward_delta reagował wyłącznie
-- na zmianę PRZYNALEŻNOŚCI nagrody (active <-> inactive) i nie umiał obsłużyć
-- zmiany jej WARTOŚCI: przy stanie „aktywna i nadal aktywna” wychodził bez
-- zapisu (ścieżka C). Przy zmianie cennika to za mało — nagroda warta dziś 40
-- zostałaby warta 40 na zawsze. Ścieżka C dostaje więc uzgadnianie wartości:
-- jeśli saldo księgi dla nagrody różni się od jej aktualnej ceny, powstaje
-- zdarzenie różnicowe na kolejnej rewizji. To ta sama filozofia co kompensata,
-- tylko o krok ogólniejsza — i to ona wykona rebase partii w kroku 3/3,
-- bez ani jednego UPDATE/DELETE na księdze.

-- ---------------------------------------------------------------------------
-- 0. Kanoniczny stan historyczny partii
-- ---------------------------------------------------------------------------
--
-- plays.rewards_managed NIE jest orzeczeniem o tym, czy partia była prawdziwą
-- rozgrywką. To księgowość SILNIKA NAGRÓD: backfill z 20260729100400 ustawił
-- ten znacznik dokładnie tym partiom, dla których istniało już dodatnie saldo
-- 'play_logged', czyli takim, gdzie AUTOR dostał swoje 40 Renomy. Flaga
-- odpowiada więc na pytanie „czy nagroda autora podlega przeliczaniu”.
--
-- Economy V2 nagradza coś zupełnie innego: UDZIAŁ. Pytanie „czy autor dostał
-- kiedyś 40 punktów” nie ma żadnego związku z pytaniem „czy ci ludzie naprawdę
-- w to zagrali”. Użycie rewards_managed jako filtru uczestnictwa odbierałoby
-- Renomę graczom tylko dlatego, że wieczór został zapisany zanim istniał
-- silnik nagród — a to wprost łamie zasadę, że saldo po V2 ma wyglądać tak,
-- jakby cała prawidłowa historia była od początku liczona według V2.
--
-- Dlatego rozdzielamy oba pojęcia:
--   * plays.rewards_managed  — legacy reward-engine state, zostaje nietknięty
--     jako ślad historyczny, ale przestaje bramkować cokolwiek,
--   * poniższy predykat     — canonical historical play state.
--
-- Predykat jest celowo wąski i zawiera WYŁĄCZNIE warunki, które da się
-- obronić z danych, bez zgadywania:
--
--   status = 'completed'
--     Partia rozliczona. Wyklucza 'in_progress' — wieczór przy stole trwa albo
--     czeka na wynik, więc nagroda jeszcze się nie należy. To ten sam warunek,
--     którego silnik używał dotąd.
--
--   Uczestnictwo wynika z public.play_participants (JOIN po stronie wołającego)
--     Tabela jest kompletna i wiarygodna od pierwszej migracji: klucz główny
--     (play_id, user_id), FK on delete restrict na profiles, kaskada z plays.
--     Partia bez uczestników nie nagradza nikogo automatycznie — nie ma kogo.
--
-- Świadomie NIE wykluczamy niczego innego. Nie ma w tej domenie partii
-- „testowych”, „importowanych” ani „szkicowych”: jedynym niepełnym stanem jest
-- 'in_progress', a usunięcie partii kasuje wiersz razem z uczestnikami.
-- Jedyne pozostałe wykluczenia są PER OSOBA, nie per partia, i egzekwuje je
-- private.apply_reward_delta: konta nieaktywne, admina i obserwatora nie
-- gromadzą nagród.
create or replace function private.play_is_historically_rewardable(
  p_play_id uuid
)
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
      and play.status = 'completed'
  );
$$;

revoke all on function private.play_is_historically_rewardable(uuid)
  from public, anon, authenticated;

comment on column public.plays.rewards_managed is
  'LEGACY reward-engine state. Historyczny ślad po nagrodzie za ZAPIS partii (play_logged, 40 Renomy dla autora): TRUE oznacza, że autor dostał ją przez silnik. Od Economy V2 nie bramkuje niczego — kwalifikację do nagrody za UDZIAŁ rozstrzyga private.play_is_historically_rewardable.';

-- ---------------------------------------------------------------------------
-- 1. Saldo księgi dla nagrody (rodzina action_type)
-- ---------------------------------------------------------------------------

-- Dotąd kompensata liczyła saldo z JEDNEGO action_type. Po przemianowaniu
-- nagrody za partię saldo jednej i tej samej nagrody rozkłada się na dwa typy:
-- historyczne 'play_logged' i bieżące 'play_participated'. Gdyby kompensata
-- widziała tylko nowy typ, cofnięcie starej nagrody zapisałoby -0 i zostawiło
-- w saldzie użytkownika 40 punktów-widmo.
--
-- Dlatego saldo liczymy dla RODZINY typów należących do tej samej nagrody.
-- Dla odznak rodzina jest jednoelementowa — nic się dla nich nie zmienia.
create or replace function private.reward_ledger_net(
  p_user_id uuid,
  p_reward_type public.reward_type,
  p_reward_key text
)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_net integer;
begin
  if p_reward_type = 'play_points' then
    select coalesce(sum(event.points), 0)
    into v_net
    from public.point_events as event
    where event.user_id = p_user_id
      and event.action_type in ('play_participated', 'play_logged')
      and event.related_entity_type = 'play'
      and event.related_entity_id = p_reward_key::uuid;
  else
    select coalesce(sum(event.points), 0)
    into v_net
    from public.point_events as event
    where event.user_id = p_user_id
      and event.action_type = 'achievement_unlocked:' || p_reward_key
      and event.related_entity_type = 'profile'
      and event.related_entity_id = p_user_id;
  end if;

  return v_net;
end;
$$;

revoke all on function private.reward_ledger_net(uuid, public.reward_type, text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Cena nagrody
-- ---------------------------------------------------------------------------

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
    return private.point_reward_for('play_participated');
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
-- 3. Atomowa zmiana stanu nagrody — z uzgadnianiem wartości
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
    -- Nowy typ zdarzenia. Historyczne 'play_logged' zostaje w księdze
    -- nietknięte i jest doliczane przez private.reward_ledger_net.
    v_action_type := 'play_participated';
    v_entity_type := 'play';
    v_entity_id := p_reward_key::uuid;
    v_description := 'Udział w partii';
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
  if not found then
    if not p_should_be_active then
      return false;
    end if;

    -- ==== ŚCIEŻKA B: pierwsze przyznanie ==================================
    v_points := private.reward_points_for(p_reward_type, p_reward_key);
    v_net := private.reward_ledger_net(p_user_id, p_reward_type, p_reward_key);
    -- Saldo już istniejące w księdze (np. historyczne 'play_logged' albo
    -- nagroda przyznana starą ścieżką award_points_once) traktujemy jako
    -- zaliczkę: dopisujemy wyłącznie różnicę do aktualnej ceny.
    v_delta := v_points - v_net;

    insert into public.play_reward_states (
      user_id, reward_type, reward_key, is_active, revision, last_play_id
    )
    values (p_user_id, p_reward_type, p_reward_key, true, 0, p_play_id);

    if v_delta <> 0 then
      insert into public.point_events (
        user_id, points, action_type, description,
        related_entity_type, related_entity_id, created_by, reward_revision
      )
      values (
        p_user_id, v_delta, v_action_type, v_description,
        v_entity_type, v_entity_id, v_actor, 0
      )
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

  -- ==== ŚCIEŻKA C: przynależność bez zmian ================================
  -- Nie znaczy to już „nic do zrobienia”. Nagroda mogła zmienić cenę (zmiana
  -- cennika, przemianowanie action_type, zmiana wartości odznaki), a saldo
  -- księgi musi odpowiadać cenie aktualnej.
  if v_state.is_active = p_should_be_active then
    v_net := private.reward_ledger_net(p_user_id, p_reward_type, p_reward_key);
    v_points := case
      when p_should_be_active
        then private.reward_points_for(p_reward_type, p_reward_key)
      else 0
    end;
    v_delta := v_points - v_net;

    if v_delta = 0 then
      return false;
    end if;

    v_next_revision := v_state.revision + 1;

    insert into public.point_events (
      user_id, points, action_type, description,
      related_entity_type, related_entity_id, created_by, reward_revision
    )
    values (
      p_user_id, v_delta, v_action_type, p_reason,
      v_entity_type, v_entity_id, v_actor, v_next_revision
    );

    update public.play_reward_states as state
    set revision = v_next_revision,
        last_play_id = coalesce(p_play_id, state.last_play_id)
    where state.user_id = p_user_id
      and state.reward_type = p_reward_type
      and state.reward_key = p_reward_key;

    return true;
  end if;

  -- ==== ŚCIEŻKA D: zmiana przynależności ==================================
  v_next_revision := v_state.revision + 1;
  -- Saldo liczone z KSIĘGI (całej rodziny typów), nie z bieżącej definicji:
  -- gdyby wartość nagrody zmieniła się między przyznaniem a cofnięciem, użycie
  -- aktualnej ceny zostawiłoby resztkę w saldzie.
  v_net := private.reward_ledger_net(p_user_id, p_reward_type, p_reward_key);

  if p_should_be_active then
    v_delta := private.reward_points_for(p_reward_type, p_reward_key) - v_net;
    v_history_action := 'regranted';
  else
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
-- 4. Przeliczanie — nagroda należy się UCZESTNIKOM
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

  -- Blokady doradcze w ROSNĄCEJ kolejności user_id — bez zmian względem
  -- 20260729100400. Kolejność chroni przed zakleszczeniem dwóch równoległych
  -- mutacji o krzyżujących się zbiorach uczestników.
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
    -- 5a. Renoma za UDZIAŁ w partii.
    --
    -- Stan docelowy: partie kwalifikujące się historycznie (patrz sekcja 0), w
    -- których użytkownik figuruje jako uczestnik. Suma ze stanami aktywnymi
    -- gwarantuje, że cofniemy nagrodę za partię usuniętą, cofniętą do
    -- 'in_progress' albo taką, z której uczestnik został wypisany.
    --
    -- Świadomie BEZ warunku na liczbę uczestników: partia solo jest w tej
    -- domenie pełnoprawną partią (patrz odznaka `lone_wolf`), więc solista
    -- też dostaje swoje 5.
    --
    -- Świadomie BEZ warunku na plays.created_by: autor wpisu nie dostaje nic
    -- za samą operację w UI. Jeśli grał — dostaje jako uczestnik.
    --
    -- Świadomie BEZ warunku na plays.rewards_managed: to stan księgowy silnika
    -- sprzed V2, nie orzeczenie o prawdziwości rozgrywki.
    for v_reward_key in
      select participant.play_id::text
      from public.play_participants as participant
      where participant.user_id = v_user_id
        and private.play_is_historically_rewardable(participant.play_id)
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
          from public.play_participants as participant
          where participant.play_id = v_reward_key::uuid
            and participant.user_id = v_user_id
            and private.play_is_historically_rewardable(participant.play_id)
        ),
        p_play_id,
        p_reason
      ) then
        v_changes := v_changes + 1;
      end if;
    end loop;

    -- 5b. Odznaki, których warunek zależy od danych o partiach. Bez zmian.
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

-- ---------------------------------------------------------------------------
-- 5. Wycofanie starej ścieżki naliczania
-- ---------------------------------------------------------------------------

-- public.award_play_logged_points przyznawało 40 Renomy autorowi wpisu. Od tej
-- migracji `play_logged` nie istnieje w cenniku, więc funkcja i tak rzucałaby
-- wyjątkiem. Usuwamy ją, żeby nie została przypadkiem zawołana z nowego kodu;
-- warstwa TS przestała jej używać już przy wdrożeniu silnika recompute.
drop function if exists public.award_play_logged_points(uuid);
