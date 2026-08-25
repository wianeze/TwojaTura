-- Pierwszy Rozdział — kwalifikacja wyłącznie dla gier samodzielnych.
--
-- ===========================================================================
-- CO SIĘ ZEPSUŁO
-- ===========================================================================
--
-- Produkcyjny podgląd Misji zaproponował „Planet Unknown: Supermoon” jako
-- Pierwszy Rozdział, a pominął samo „Planet Unknown”. Supermoon jest dodatkiem
-- — nie da się w niego zagrać osobno, więc Misja „rozegraj swoją pierwszą
-- partię tej gry” jest dla niego bez sensu. To samo dotyczyło kilkunastu innych
-- pozycji: Terraforming Mars (Prelude/Venus Next/Colonies), dodatków do Heroes
-- of Might and Magic III, Mansions of Madness, Dead of Winter i Talismana.
--
-- Przyczyna: model danych nie odróżniał pozycji samodzielnej od dodatku.
--   * games.game_type to polska etykieta GATUNKU („Kooperacyjna”, „Karciana”),
--   * games.categories to edytowalny wolny tekst,
--   * games.bgg_url to ręcznie wklejany adres — BGG serwuje dodatki także pod
--     /boardgame/<id>, a audyt produkcyjny znalazł dodatki (Chronicles of
--     Crime: Noir, XCOM: Evolution, Dead of Winter: Warring Colonies) właśnie
--     z takim linkiem,
--   * game_expansions łączy bazę z dodatkiem wyłącznie po NAZWIE, bez relacji
--     między wierszami games.
--
-- Dlatego dostajemy jawne pole, a nie heurystykę.
--
-- ===========================================================================
-- TRÓJSTANOWA SEMANTYKA I FAIL-SAFE
-- ===========================================================================
--
--   true  — dodatek albo inna pozycja niesamodzielna; NIGDY nie kwalifikuje się
--           do Pierwszego Rozdziału,
--   false — gra samodzielna dopuszczona do Pierwszego Rozdziału,
--   null  — jeszcze nierozstrzygnięte.
--
-- Kolumna jest CELOWO nullable i CELOWO bez `default false`. Warunek
-- kwalifikacji brzmi ściśle `is_expansion = false`, a w SQL `null = false` daje
-- `null`, czyli nie-prawdę — więc każdy niesklasyfikowany rekord sam z siebie
-- wypada z puli. Brak wiedzy nie może wypuścić Misji dla dodatku.
--
-- Konsekwencja, świadoma: do czasu backfillu Pierwszy Rozdział nie wygeneruje
-- się nikomu. To zgodne z zasadą „0 Misji jest poprawnym stanem”, a Rewanż,
-- Wskrzeszenie i Dokończ Historię działają bez zmian — opierają się na historii
-- partii, nie na Półce.
--
-- Ta migracja NIE USTAWIA żadnej wartości dla istniejących 114 gier. Backfill
-- jest osobnym, operatorskim krokiem, poprzedzonym podglądem całego katalogu
-- (scripts/backfill-expansion-classification.mts).

-- ---------------------------------------------------------------------------
-- 1. Kolumna
-- ---------------------------------------------------------------------------

alter table public.games
  add column is_expansion boolean;

comment on column public.games.is_expansion is
  'Czy pozycja jest dodatkiem/pozycją niesamodzielną. true = dodatek, false = gra samodzielna, null = nierozstrzygnięte. Wypełniane z atrybutu type elementu <item> w XML-u BGG (boardgameexpansion/boardgame) i zawsze poprawialne ręcznie w formularzu — standalone expansion bywa oznaczony w BGG jako dodatek, mimo że gra się w niego samodzielnie. Kwalifikacja Misji „Pierwszy Rozdział” wymaga dokładnie false; null jest fail-safe i nie generuje Misji.';

-- ---------------------------------------------------------------------------
-- 2. RPC gier — nowy parametr, bez cichego przeciążenia
-- ---------------------------------------------------------------------------
--
-- Stare sygnatury są DROPOWANE, a nie zostawiane obok nowych. To ten sam
-- zabieg co przy dodawaniu p_status do RPC partii (20260706000100): dwie
-- współistniejące sygnatury oznaczałyby, że wywołanie, które zapomni o nowym
-- parametrze, po cichu trafia w starą wersję i zapisuje grę bez klasyfikacji.
--
-- p_is_expansion jest WYMAGANY (bez DEFAULT) i stoi przed parametrami, które
-- default mają. Dzięki temu pominięcie go kończy się błędem wywołania, a nie
-- cichym wyzerowaniem klasyfikacji przy edycji gry.

drop function if exists public.create_game_with_expansions(
  text, uuid, uuid, text, text, integer, text, smallint, smallint, integer,
  smallint, text[], text[], numeric, smallint, text, text, text,
  public.game_status, timestamptz, jsonb
);

drop function if exists public.update_game_with_expansions(
  uuid, text, uuid, uuid, text, text, integer, text, smallint, smallint,
  integer, smallint, text[], text[], numeric, smallint, text, text, text,
  public.game_status, jsonb
);

create or replace function public.create_game_with_expansions(
  p_title text,
  p_owner_id uuid,
  p_current_holder_id uuid,
  p_cover_url text,
  p_bgg_url text,
  p_bgg_rank integer,
  p_game_type text,
  p_min_players smallint,
  p_max_players smallint,
  p_play_time_minutes integer,
  p_release_year smallint,
  p_mechanics text[],
  p_categories text[],
  p_bgg_weight numeric(3, 2),
  p_min_age smallint,
  p_designer text,
  p_publisher text,
  p_description text,
  p_status public.game_status,
  p_is_expansion boolean,
  p_archived_at timestamptz default null,
  p_expansions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  created_game_id uuid;
begin
  if jsonb_typeof(coalesce(p_expansions, '[]'::jsonb)) <> 'array' then
    raise exception 'Expansion payload must be a JSON array'
      using errcode = '22023';
  end if;

  insert into public.games (
    title,
    owner_id,
    current_holder_id,
    cover_url,
    bgg_url,
    bgg_rank,
    game_type,
    min_players,
    max_players,
    play_time_minutes,
    release_year,
    mechanics,
    categories,
    bgg_weight,
    min_age,
    designer,
    publisher,
    description,
    status,
    is_expansion,
    archived_at
  )
  values (
    p_title,
    p_owner_id,
    p_current_holder_id,
    p_cover_url,
    p_bgg_url,
    p_bgg_rank,
    p_game_type,
    p_min_players,
    p_max_players,
    p_play_time_minutes,
    p_release_year,
    coalesce(p_mechanics, '{}'::text[]),
    coalesce(p_categories, '{}'::text[]),
    p_bgg_weight,
    p_min_age,
    p_designer,
    p_publisher,
    p_description,
    p_status,
    p_is_expansion,
    p_archived_at
  )
  returning id into created_game_id;

  insert into public.game_expansions (game_id, name, is_owned)
  select
    created_game_id,
    btrim(expansion.name),
    coalesce(expansion.is_owned, false)
  from jsonb_to_recordset(coalesce(p_expansions, '[]'::jsonb)) as expansion(
    name text,
    is_owned boolean
  )
  where btrim(coalesce(expansion.name, '')) <> '';

  return created_game_id;
end;
$$;

create or replace function public.update_game_with_expansions(
  p_game_id uuid,
  p_title text,
  p_owner_id uuid,
  p_current_holder_id uuid,
  p_cover_url text,
  p_bgg_url text,
  p_bgg_rank integer,
  p_game_type text,
  p_min_players smallint,
  p_max_players smallint,
  p_play_time_minutes integer,
  p_release_year smallint,
  p_mechanics text[],
  p_categories text[],
  p_bgg_weight numeric(3, 2),
  p_min_age smallint,
  p_designer text,
  p_publisher text,
  p_description text,
  p_status public.game_status,
  p_is_expansion boolean,
  p_expansions jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_game_id uuid;
begin
  if jsonb_typeof(coalesce(p_expansions, '[]'::jsonb)) <> 'array' then
    raise exception 'Expansion payload must be a JSON array'
      using errcode = '22023';
  end if;

  update public.games
  set
    title = p_title,
    owner_id = p_owner_id,
    current_holder_id = p_current_holder_id,
    cover_url = p_cover_url,
    bgg_url = p_bgg_url,
    bgg_rank = p_bgg_rank,
    game_type = p_game_type,
    min_players = p_min_players,
    max_players = p_max_players,
    play_time_minutes = p_play_time_minutes,
    release_year = p_release_year,
    mechanics = coalesce(p_mechanics, '{}'::text[]),
    categories = coalesce(p_categories, '{}'::text[]),
    bgg_weight = p_bgg_weight,
    min_age = p_min_age,
    designer = p_designer,
    publisher = p_publisher,
    description = p_description,
    status = p_status,
    is_expansion = p_is_expansion
  where id = p_game_id
  returning id into updated_game_id;

  if updated_game_id is null then
    return null;
  end if;

  delete from public.game_expansions
  where game_id = p_game_id;

  insert into public.game_expansions (game_id, name, is_owned)
  select
    p_game_id,
    btrim(expansion.name),
    coalesce(expansion.is_owned, false)
  from jsonb_to_recordset(coalesce(p_expansions, '[]'::jsonb)) as expansion(
    name text,
    is_owned boolean
  )
  where btrim(coalesce(expansion.name, '')) <> '';

  return updated_game_id;
end;
$$;

revoke all on function public.create_game_with_expansions(
  text, uuid, uuid, text, text, integer, text, smallint, smallint, integer,
  smallint, text[], text[], numeric, smallint, text, text, text,
  public.game_status, boolean, timestamptz, jsonb
) from public, anon, authenticated;

revoke all on function public.update_game_with_expansions(
  uuid, text, uuid, uuid, text, text, integer, text, smallint, smallint,
  integer, smallint, text[], text[], numeric, smallint, text, text, text,
  public.game_status, boolean, jsonb
) from public, anon, authenticated;

grant execute on function public.create_game_with_expansions(
  text, uuid, uuid, text, text, integer, text, smallint, smallint, integer,
  smallint, text[], text[], numeric, smallint, text, text, text,
  public.game_status, boolean, timestamptz, jsonb
) to authenticated;

grant execute on function public.update_game_with_expansions(
  uuid, text, uuid, uuid, text, text, integer, text, smallint, smallint,
  integer, smallint, text[], text[], numeric, smallint, text, text, text,
  public.game_status, boolean, jsonb
) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Kwalifikacja Pierwszego Rozdziału
-- ---------------------------------------------------------------------------
--
-- Ciało przepisane z 20260824120000. Zmienia się DOKŁADNIE JEDNA rzecz: gałąź
-- first_chapter dostaje warunek `game.is_expansion = false`. Gałęzie revenge,
-- resurrection i continue_story są nietknięte — one wynikają z historii partii,
-- a nie z zawartości Półki, i dodatek rozegrany jako część wieczoru jest tam
-- legalnym kandydatem.

create or replace function private.mission_candidates(p_user_id uuid)
returns table (
  mission_type public.mission_type,
  game_id uuid,
  source_play_id uuid,
  priority integer,
  rank_in_type integer,
  idle_days integer,
  reason text,
  context jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  with last_play as (
    -- Ostatnia UKOŃCZONA partia gracza dla każdej gry.
    select distinct on (play.game_id)
      play.game_id,
      play.id as play_id,
      play.played_at,
      play.mode,
      participant.is_winner,
      floor(
        extract(epoch from (now() - play.played_at)) / 86400
      )::integer as idle_days
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = p_user_id
      and play.status = 'completed'::public.play_status
    order by
      play.game_id,
      play.played_at desc,
      play.created_at desc,
      play.id desc
  ),
  revenge as (
    select
      'revenge'::public.mission_type as mission_type,
      last_play.game_id,
      last_play.play_id as source_play_id,
      1 as priority,
      -- Najświeższa porażka pierwsza — „świeży Rewanż” z listy priorytetów.
      row_number() over (
        order by last_play.played_at desc, last_play.game_id
      )::integer as rank_in_type,
      last_play.idle_days,
      'Ostatnia ukończona partia rywalizacyjna gry „' || game.title
        || '” zakończyła się porażką gracza.' as reason,
      jsonb_build_object(
        'game_title', game.title,
        'source_played_at', last_play.played_at,
        'idle_days', last_play.idle_days
      ) as context
    from last_play
    join public.games as game
      on game.id = last_play.game_id
     and game.archived_at is null
    where private.play_is_decisive_competitive_loss(last_play.play_id, p_user_id)
  ),
  resurrection as (
    select
      'resurrection'::public.mission_type,
      last_play.game_id,
      last_play.play_id,
      2,
      -- Najdłużej porzucona gra pierwsza.
      row_number() over (
        order by last_play.played_at asc, last_play.game_id
      )::integer,
      last_play.idle_days,
      'Gracz nie zagrał w „' || game.title || '” od ' || last_play.idle_days
        || ' dni (próg Wskrzeszenia: 180).',
      jsonb_build_object(
        'game_title', game.title,
        'source_played_at', last_play.played_at,
        'idle_days', last_play.idle_days
      )
    from last_play
    join public.games as game
      on game.id = last_play.game_id
     and game.archived_at is null
    cross join lateral private.mission_policy(
      'resurrection'::public.mission_type
    ) as policy
    where last_play.idle_days >= policy.min_idle_days
  ),
  first_chapter as (
    select
      'first_chapter'::public.mission_type,
      game.id,
      null::uuid,
      3,
      -- Najnowszy nabytek Półki pierwszy: to gra, po którą realnie chce się
      -- sięgnąć, a nie przypadkowy tytuł sprzed lat.
      row_number() over (
        order by game.created_at desc, game.id
      )::integer,
      null::integer,
      'Gra „' || game.title
        || '” stoi na Półce gracza i nie ma ani jednej jego ukończonej partii.',
      jsonb_build_object(
        'game_title', game.title,
        'shelf_added_at', game.created_at
      )
    from public.games as game
    where game.owner_id = p_user_id
      and game.archived_at is null
      -- JEDYNA zmiana względem 20260824120000. Zapis wprost `= false`, a nie
      -- `is not true` ani `coalesce(..., false) = false` — te dwa
      -- przepuściłyby null i zniweczyły cały fail-safe.
      and game.is_expansion = false
      and not exists (
        select 1
        from public.play_participants as participant
        join public.plays as play on play.id = participant.play_id
        where participant.user_id = p_user_id
          and play.game_id = game.id
          and play.status = 'completed'::public.play_status
      )
  ),
  continue_story as (
    select
      'continue_story'::public.mission_type,
      last_play.game_id,
      last_play.play_id,
      4,
      row_number() over (
        order by last_play.played_at asc, last_play.game_id
      )::integer,
      last_play.idle_days,
      'Gra „' || game.title || '” leży odłożona od ' || last_play.idle_days
        || ' dni (poniżej progu Wskrzeszenia).',
      jsonb_build_object(
        'game_title', game.title,
        'source_played_at', last_play.played_at,
        'idle_days', last_play.idle_days
      )
    from last_play
    join public.games as game
      on game.id = last_play.game_id
     and game.archived_at is null
    cross join lateral private.mission_policy(
      'continue_story'::public.mission_type
    ) as policy
    -- Przedział DOMKNIĘTY z dołu i OTWARTY z góry. Rozłączność z progiem
    -- Wskrzeszenia (>= 180) jest tu jedynym mechanizmem pierwszeństwa — przy
    -- 180 dniach kandydatem jest wyłącznie Wskrzeszenie.
    where last_play.idle_days >= policy.min_idle_days
      and last_play.idle_days < policy.max_idle_days
  )
  select * from revenge
  union all select * from resurrection
  union all select * from first_chapter
  union all select * from continue_story;
$$;

comment on function private.mission_candidates(uuid) is
  'Kandydaci na Misje dla gracza — krok 1 pipeline''u. Czysto odczytowa i deterministyczna (bez random()): ta sama funkcja zasila generator i operatorski podgląd, więc oba nie mogą użyć różnych reguł. Pierwszy Rozdział wymaga games.is_expansion = false — pozycja nierozstrzygnięta (null) i dodatek (true) nigdy nie są kandydatami.';

revoke all on function private.mission_candidates(uuid)
  from public, anon, authenticated;
