-- Klasyfikacja domenowa odznak (M2 z planu „tryb kooperacyjny + przeliczanie
-- nagród”). Wyłącznie dane — żadnych zmian struktury ani zachowania.
--
-- Dwie osobne rzeczy, celowo rozdzielone:
--
--  * achievement_definitions.reward_domain — domena GŁÓWNA: do czego odznaka
--    należy semantycznie. Służy do grupowania i prezentacji.
--
--  * achievement_domain_dependencies — od jakich danych warunek FAKTYCZNIE
--    zależy. To jedyne źródło prawdy dla zakresu przeliczania.
--
-- Wiersze zależności dostają wyłącznie odznaki, które mają dziś realny kod
-- przyznający. Odznaki `planned`/`secret` bez implementacji zostają z pustym
-- zbiorem zależności, czyli twardo poza zakresem recompute — dopiero migracja
-- implementująca daną odznakę dopisze jej zależność. Dzięki temu recompute nie
-- odpytuje predykatów, których nie ma.
--
-- Uwaga do `party_summoned`: ma automation_status = 'automatic', ale w całym
-- repozytorium NIE ISTNIEJE kod, który by ją przyznawał. Świadomie nie
-- nadajemy jej zależności — do czasu implementacji nie jest przeliczalna.

-- ---------------------------------------------------------------------------
-- 1. Domena główna dla wszystkich 51 odznak
-- ---------------------------------------------------------------------------

update public.achievement_definitions as definition
set reward_domain = source.domain::public.reward_domain
from (
  values
    -- Partie: warunek liczy rozegrane partie, ich wyniki lub cechy gier w nich
    -- użytych.
    ('critical_roll', 'play'),
    ('natural_one', 'play'),
    ('coast_chronicler', 'play'),
    ('short_rest', 'play'),
    ('full_party', 'play'),
    ('lone_wolf', 'play'),
    ('side_quest', 'play'),
    ('dark_urge', 'play'),
    ('candlekeep_sage', 'play'),
    ('bone_breaker', 'play'),
    ('table_rogue', 'play'),
    ('tadpole_enjoyer', 'play'),
    ('save_scummer', 'play'),
    ('multiclass', 'play'),
    ('tavern_brawler', 'play'),
    ('long_rest', 'play'),
    ('legendary_artifact', 'play'),
    ('resurrection', 'play'),
    ('oathbreaker', 'play'),
    ('glass_cannon', 'play'),
    ('skill_issue', 'play'),
    ('git_gud', 'play'),
    ('final_boss', 'play'),
    ('boss_defeated', 'play'),
    ('plot_armor', 'play'),
    ('main_character', 'play'),
    ('time_traveler', 'play'),
    ('dice_speak', 'play'),
    ('friendly_fire', 'play'),
    ('no_save_found', 'play'),
    ('the_absolute', 'play'),
    ('critical_success_question_mark', 'play'),
    ('hot_streak', 'play'),

    -- Spotkania: organizacja, obecność, głosowania.
    ('initiative_master', 'meeting'),
    ('camp_host', 'meeting'),
    ('party_summoned', 'meeting'),
    ('guidance', 'meeting'),
    ('persuasion_master', 'meeting'),
    ('quest_accepted', 'meeting'),

    -- Kolekcja: stan wspólnej Półki.
    ('loot_goblin', 'collection'),
    ('bag_of_holding', 'collection'),
    ('eternal_shelf_curse', 'collection'),

    -- Oceny i komentarze.
    ('party_bard', 'rating'),
    ('vicious_mockery', 'rating'),
    ('fanboy', 'rating'),
    ('hot_take', 'rating'),
    ('one_more_turn', 'rating'),
    ('redemption_arc', 'rating'),

    -- Przyznawane wyłącznie ręcznie przez administratora.
    ('last_turn_hero', 'manual'),
    ('rule_quard', 'manual'),

    -- Ranking punktowy Legendarium — nie jest to żadna z powyższych domen
    -- danych źródłowych, lecz pochodna sumy punktów.
    ('chosen_of_the_table', 'other')
) as source (achievement_key, domain)
where definition.achievement_key = source.achievement_key
  and definition.reward_domain is distinct from source.domain::public.reward_domain;

-- Straż: gdyby ktoś dodał nową odznakę i zapomniał jej sklasyfikować, ta
-- migracja przejdzie, ale przyszła zmiana zakresu przeliczania mogłaby ją
-- po cichu pominąć. Wykrywamy to od razu.
do $$
declare
  unclassified_count integer;
begin
  select count(*) into unclassified_count
  from public.achievement_definitions
  where reward_domain = 'other'
    and achievement_key <> 'chosen_of_the_table';

  if unclassified_count > 0 then
    raise exception
      'Nieprzypisana domena nagrody dla % odznak — uzupełnij klasyfikację.',
      unclassified_count
      using errcode = '22023';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- 2. Zależności — wyłącznie odznaki z realnym kodem przyznającym
-- ---------------------------------------------------------------------------

insert into public.achievement_domain_dependencies (achievement_key, domain)
values
  -- award_current_user_simple_achievements: warunki liczące partie.
  ('critical_roll', 'play'),
  ('coast_chronicler', 'play'),
  ('short_rest', 'play'),
  ('full_party', 'play'),
  ('lone_wolf', 'play'),
  ('side_quest', 'play'),

  -- award_play_result_achievements: warunki oparte na wyniku partii.
  ('natural_one', 'play'),
  ('dark_urge', 'play'),

  -- award_meeting_achievements. Domena główna to 'meeting' (nagroda dotyczy
  -- roli gospodarza), ale warunek liczy spotkania, które mają co najmniej
  -- jedną partię o statusie 'completed'. Skasowanie ostatniej takiej partii
  -- odbiera kwalifikację, więc odznaka zależy RÓWNIEŻ od partii — i dzięki
  -- temu wpada w zakres przeliczania po każdej zmianie partii.
  ('camp_host', 'meeting'),
  ('camp_host', 'play'),

  -- award_current_user_simple_achievements: warunki spoza domeny partii.
  -- Nie wchodzą do przeliczania wywołanego zmianą partii, ale zapisujemy je,
  -- żeby graf zależności był kompletny dla wszystkiego, co jest wdrożone.
  ('initiative_master', 'meeting'),
  ('guidance', 'meeting'),
  ('party_bard', 'rating'),
  ('fanboy', 'rating'),
  ('one_more_turn', 'rating'),
  ('loot_goblin', 'collection'),
  ('bag_of_holding', 'collection')
on conflict (achievement_key, domain) do nothing;
