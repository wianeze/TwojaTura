-- Misje v1 — AUDYT DODATKÓW, WYŁĄCZNIE DO ODCZYTU.
--
-- Cel: ustalić zakres backfillu przed dodaniem games.is_expansion i zamknięciem
-- eligibility Pierwszego Rozdziału. Nic tu nie zapisuje.
--
-- UWAGA CO DO SYGNAŁU Z URL. Kolumna `sygnal_z_url` to WYŁĄCZNIE przesłanka do
-- oszacowania pracy, nie reguła produktowa. bgg_url jest wklejany ręcznie i
-- walidowany tylko jako poprawny adres http(s) — BGG serwuje dodatki także pod
-- /boardgame/<id>, więc:
--
--   * '/boardgameexpansion/' to MOCNA przesłanka, że to dodatek
--     (tej ścieżki BGG nie generuje dla gier bazowych),
--   * '/boardgame/' to SŁABA przesłanka, że to gra bazowa — wymaga oczu,
--   * brak linku nie mówi nic.
--
-- Docelowym źródłem prawdy jest atrybut `type` z `<item>` w XML-u BGG (dla
-- nowych i odświeżanych rekordów) oraz ręczna korekta w formularzu.

begin read only;

-- ---------------------------------------------------------------------------
-- Sesja administratora — potrzebna wyłącznie sekcji 3
-- ---------------------------------------------------------------------------
--
-- Podstaw UUID swojego konta z public.app_members (role = 'admin'). Ustawienia
-- są transakcyjne i znikają razem z ROLLBACK. Sekcje 1, 2, 4 i 5 działają też
-- bez tego.

select set_config(
  'request.jwt.claims',
  '{"sub":"<UUID-ADMINA>","role":"authenticated"}',
  true
);
set local role authenticated;

-- Kontrola, czy sesja faktycznie się przestawiła. Jeśli `sesja_uzytkownika`
-- pokazuje `<UUID-ADMINA>`, to znaczy, że placeholder nie został podmieniony i
-- sekcja 3 zwróci 42501.
select
  coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'sub',
    '(brak)'
  ) as sesja_uzytkownika,
  current_user as rola_bazodanowa;

-- ---------------------------------------------------------------------------
-- 1. Skala problemu — cała Półka
-- ---------------------------------------------------------------------------

select
  count(*) as gry_wszystkie,
  count(*) filter (where game.archived_at is null) as gry_aktywne,
  count(*) filter (where game.bgg_url is not null) as z_linkiem_bgg,
  count(*) filter (where game.bgg_url is null) as bez_linku_bgg,
  count(*) filter (
    where game.bgg_url ~* '/boardgameexpansion/'
  ) as url_wskazuje_dodatek,
  count(*) filter (
    where game.bgg_url ~* '/boardgame/'
      and game.bgg_url !~* '/boardgameexpansion/'
  ) as url_wskazuje_gre_bazowa,
  count(*) filter (
    where game.bgg_url is not null
      and game.bgg_url !~* '/boardgame/'
      and game.bgg_url !~* '/boardgameexpansion/'
  ) as url_niejednoznaczny
from public.games as game;

-- ---------------------------------------------------------------------------
-- 2. Ile z tego jest PILNE
-- ---------------------------------------------------------------------------
--
-- Pierwszy Rozdział dotyczy wyłącznie gier aktywnych, stojących na czyjejś
-- Półce, w które właściciel nie rozegrał ani jednej ukończonej partii. Reszta
-- Półki może zostać sklasyfikowana spokojnie, przy okazji edycji.

with kandydujace as (
  select
    game.id,
    game.bgg_url
  from public.games as game
  where game.archived_at is null
    and not exists (
      select 1
      from public.play_participants as participant
      join public.plays as play on play.id = participant.play_id
      where participant.user_id = game.owner_id
        and play.game_id = game.id
        and play.status = 'completed'
    )
)
select
  count(*) as pozycje_istotne_dla_first_chapter,
  count(*) filter (
    where kandydujace.bgg_url ~* '/boardgameexpansion/'
  ) as z_mocna_przeslanka_dodatku,
  count(*) filter (
    where kandydujace.bgg_url ~* '/boardgame/'
      and kandydujace.bgg_url !~* '/boardgameexpansion/'
  ) as z_slaba_przeslanka_gry_bazowej,
  count(*) filter (
    where kandydujace.bgg_url is null
       or (
         kandydujace.bgg_url !~* '/boardgame/'
         and kandydujace.bgg_url !~* '/boardgameexpansion/'
       )
  ) as do_recznej_decyzji
from kandydujace;

-- ---------------------------------------------------------------------------
-- 3. Aktualni kandydaci first_chapter — pozycja po pozycji
-- ---------------------------------------------------------------------------
--
-- To jest lista, którą trzeba przejrzeć w pierwszej kolejności: dokładnie te
-- pozycje generator zaproponowałby dziś jako Pierwszy Rozdział.
--
-- `mozliwa_gra_bazowa` / `pasujacy_dodatek` pochodzą z dopasowania po NAZWIE
-- (tytuł pozycji zaczyna się od tytułu innej gry, która ma ten dodatek na
-- swojej liście). Służą WYŁĄCZNIE do oszacowania, ile pozycji da się rozstrzygnąć
-- bez ręcznego sprawdzania w BGG. Do reguły produktowej to nie wejdzie.

select
  preview.display_name as wlasciciel,
  game.title as tytul,
  game.bgg_url,
  case
    when game.bgg_url is null then 'brak linku'
    when game.bgg_url ~* '/boardgameexpansion/' then 'dodatek (mocna przesłanka)'
    when game.bgg_url ~* '/boardgame/' then 'gra bazowa (słaba przesłanka)'
    else 'inny kształt linku'
  end as sygnal_z_url,
  game.bgg_rank,
  game.game_type,
  game.categories,
  powiazanie.possible_base_title as mozliwa_gra_bazowa,
  powiazanie.matching_expansion_name as pasujacy_dodatek
from public.preview_mission_generation() as preview
join public.games as game on game.id = preview.game_id
left join lateral (
  select
    base.title as possible_base_title,
    listed.name as matching_expansion_name
  from public.games as base
  join public.game_expansions as listed on listed.game_id = base.id
  where base.id <> game.id
    and game.title ilike base.title || '%'
    and game.title ilike '%' || listed.name || '%'
  order by length(base.title) desc
  limit 1
) as powiazanie on true
where preview.mission_type = 'first_chapter'
order by preview.display_name, game.title;

-- ---------------------------------------------------------------------------
-- 4. Arkusz roboczy backfillu — cała aktywna Półka
-- ---------------------------------------------------------------------------
--
-- Posortowany wg pilności: najpierw pozycje, które mogą stać się Pierwszym
-- Rozdziałem, potem reszta. `proponowana_wartosc` to PROPOZYCJA do przejrzenia,
-- nie automat — kolumna `wymaga_decyzji` mówi wprost, gdzie nie ma podstaw, by
-- cokolwiek zakładać.

select
  profile.display_name as wlasciciel,
  game.title as tytul,
  not exists (
    select 1
    from public.play_participants as participant
    join public.plays as play on play.id = participant.play_id
    where participant.user_id = game.owner_id
      and play.game_id = game.id
      and play.status = 'completed'
  ) as pilne_dla_first_chapter,
  game.bgg_url,
  case
    when game.bgg_url ~* '/boardgameexpansion/' then true
    else null::boolean
  end as proponowana_wartosc,
  case
    when game.bgg_url ~* '/boardgameexpansion/' then false
    else true
  end as wymaga_decyzji
from public.games as game
join public.profiles as profile on profile.id = game.owner_id
where game.archived_at is null
order by
  pilne_dla_first_chapter desc,
  profile.display_name,
  game.title;

-- ---------------------------------------------------------------------------
-- 5. Ile da się zamknąć hurtem
-- ---------------------------------------------------------------------------
--
-- Pozycje z '/boardgameexpansion/' w linku można oznaczyć jako dodatki jednym
-- ruchem po przejrzeniu listy z sekcji 4. Cała reszta wymaga decyzji człowieka:
-- ani '/boardgame/', ani brak linku nie dowodzą, że to gra bazowa.

select
  count(*) filter (
    where game.bgg_url ~* '/boardgameexpansion/'
  ) as do_oznaczenia_jako_dodatek,
  count(*) filter (
    where game.bgg_url is null
       or game.bgg_url !~* '/boardgameexpansion/'
  ) as do_recznego_przejrzenia
from public.games as game
where game.archived_at is null;

reset role;

rollback;
