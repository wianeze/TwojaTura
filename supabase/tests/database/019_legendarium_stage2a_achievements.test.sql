begin;

create extension if not exists pgtap with schema extensions;
select plan(42);

-- Gry pokrywają granice roku, dekad i BGG weight bez zewnętrznych danych.
insert into public.games (
  id, title, owner_id, release_year, bgg_weight
)
values
  ('e9200000-0000-4000-8000-000000000001', 'Stary boss', '10000000-0000-0000-0000-000000000002', 1999, 4.00),
  ('e9200000-0000-4000-8000-000000000002', 'Rok 2000', '10000000-0000-0000-0000-000000000002', 2000, 3.50),
  ('e9200000-0000-4000-8000-000000000003', 'Lekki boss', '10000000-0000-0000-0000-000000000002', 2022, 3.49),
  ('e9200000-0000-4000-8000-000000000004', 'Dekada 1980', '10000000-0000-0000-0000-000000000002', 1985, 2.00),
  ('e9200000-0000-4000-8000-000000000005', 'Dekada 2000', '10000000-0000-0000-0000-000000000002', 2005, 2.00),
  ('e9200000-0000-4000-8000-000000000006', 'Dekada 2010', '10000000-0000-0000-0000-000000000002', 2015, 2.00),
  ('e9200000-0000-4000-8000-000000000007', 'Docinek 1', '10000000-0000-0000-0000-000000000002', 2020, 2.00),
  ('e9200000-0000-4000-8000-000000000008', 'Docinek 2', '10000000-0000-0000-0000-000000000002', 2020, 2.00),
  ('e9200000-0000-4000-8000-000000000009', 'Docinek 3', '10000000-0000-0000-0000-000000000002', 2020, 2.00),
  ('e9200000-0000-4000-8000-000000000010', 'Spóźniona deklaracja', '10000000-0000-0000-0000-000000000002', 2020, 2.00),
  ('e9200000-0000-4000-8000-000000000011', 'Ciężki boss 2', '10000000-0000-0000-0000-000000000002', 2021, 4.20),
  ('e9200000-0000-4000-8000-000000000012', 'Ciężki boss 3', '10000000-0000-0000-0000-000000000002', 2022, 4.50);

-- Oceny Marty: 5/10 przed partią, trzy docinki oraz wcześniejsze „NIE”.
insert into public.ratings (
  game_id, user_id, overall, replayability, theme,
  wants_to_play_again, comment, created_at, updated_at
)
values
  ('e9200000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000002', 5, 5, 5, false, 'Nie dla mnie', '2019-01-01', '2019-01-01'),
  ('e9200000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000002', 3, 3, 3, true, 'Docinek A', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000002', 2, 2, 2, true, 'Docinek B', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000002', 1, 1, 1, true, 'Docinek C', '2020-01-01', '2020-01-01'),
  -- Michał: brak Tadpole, tylko dwa komentarze; deklaracja NIE jest po partii.
  ('e9200000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000003', 6, 6, 6, true, null, '2019-01-01', '2019-01-01'),
  ('e9200000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000003', 3, 3, 3, true, 'Tylko jeden', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000003', 3, 3, 3, true, 'Tylko dwa', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000003', 3, 3, 3, true, '   ', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000010', '10000000-0000-0000-0000-000000000003', 6, 6, 6, false, null, '2024-02-01', '2024-02-01'),
  -- Observer i nieaktywny spełniają warunek Vicious, ale nie eligibility.
  ('e9200000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000005', 1, 1, 1, true, 'A', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000005', 1, 1, 1, true, 'B', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000005', 1, 1, 1, true, 'C', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000006', 1, 1, 1, true, 'A', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000006', 1, 1, 1, true, 'B', '2020-01-01', '2020-01-01'),
  ('e9200000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000006', 1, 1, 1, true, 'C', '2020-01-01', '2020-01-01');

-- Helper fixture: każda partia ma stabilną chronologię played_at/created_at.
insert into public.plays (
  id, game_id, created_by, played_at, created_at, status, mode, team_result
)
values
  -- Tadpole/Oathbreaker/Legendary/Final Boss oraz admin-gracz.
  ('e9210000-0000-4000-8000-000000000001', 'e9200000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000004', '2020-01-01', '2020-01-01', 'completed', 'competitive', null),
  -- Save Scummer: dokładnie siedem dni między pierwszą i trzecią.
  ('e9210000-0000-4000-8000-000000000002', 'e9200000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000004', '2021-01-01', '2021-01-01', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000003', 'e9200000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000004', '2021-01-04', '2021-01-04', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000004', 'e9200000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000004', '2021-01-08', '2021-01-08', 'completed', 'competitive', null),
  -- Resurrection: dokładnie 365 dni.
  ('e9210000-0000-4000-8000-000000000005', 'e9200000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000004', '2021-02-01', '2021-02-01', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000006', 'e9200000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000004', '2022-02-01', '2022-02-01', 'completed', 'competitive', null),
  -- Skill Issue Marty: trzy kolejne, realnie sklasyfikowane ostatnie miejsca.
  ('e9210000-0000-4000-8000-000000000007', 'e9200000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000004', '2023-01-01', '2023-01-01', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000008', 'e9200000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000004', '2023-01-02', '2023-01-02', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000009', 'e9200000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000004', '2023-01-03', '2023-01-03', 'completed', 'competitive', null),
  -- Friendly Fire: trzy kooperacyjne porażki.
  ('e9210000-0000-4000-8000-000000000010', 'e9200000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000004', '2023-02-01', '2023-02-01', 'completed', 'cooperative', 'loss'),
  ('e9210000-0000-4000-8000-000000000011', 'e9200000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000004', '2023-02-02', '2023-02-02', 'completed', 'cooperative', 'loss'),
  ('e9210000-0000-4000-8000-000000000012', 'e9200000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000004', '2023-02-03', '2023-02-03', 'completed', 'cooperative', 'loss'),
  -- Czwarta dekada dla Marty.
  ('e9210000-0000-4000-8000-000000000013', 'e9200000-0000-4000-8000-000000000004', '10000000-0000-0000-0000-000000000004', '2023-03-01', '2023-03-01', 'completed', 'competitive', null),
  -- Boss Defeated na granicy 3.5.
  ('e9210000-0000-4000-8000-000000000014', 'e9200000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000004', '2023-04-01', '2023-04-01', 'completed', 'cooperative', 'win'),
  -- Michał: Save poza oknem, Resurrection 364 dni i Oathbreaker przed deklaracją.
  ('e9210000-0000-4000-8000-000000000015', 'e9200000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000004', '2024-01-01', '2024-01-01', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000016', 'e9200000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000004', '2024-01-04', '2024-01-04', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000017', 'e9200000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000004', '2024-01-09', '2024-01-09', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000018', 'e9200000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000004', '2021-01-01', '2021-01-01', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000019', 'e9200000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000004', '2021-12-31', '2021-12-31', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000020', 'e9200000-0000-4000-8000-000000000010', '10000000-0000-0000-0000-000000000004', '2024-01-01', '2024-01-01', 'completed', 'competitive', null),
  -- Michał: tylko dwie kooperacyjne porażki i lekki boss.
  ('e9210000-0000-4000-8000-000000000021', 'e9200000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000004', '2024-02-01', '2024-02-01', 'completed', 'cooperative', 'loss'),
  ('e9210000-0000-4000-8000-000000000022', 'e9200000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000004', '2024-02-02', '2024-02-02', 'completed', 'cooperative', 'loss'),
  ('e9210000-0000-4000-8000-000000000023', 'e9200000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000004', '2024-03-01', '2024-03-01', 'completed', 'cooperative', 'win'),
  -- Final Boss: trzy różne ciężkie gry, nie trzy partie jednego tytułu.
  ('e9210000-0000-4000-8000-000000000024', 'e9200000-0000-4000-8000-000000000011', '10000000-0000-0000-0000-000000000004', '2024-04-01', '2024-04-01', 'completed', 'competitive', null),
  ('e9210000-0000-4000-8000-000000000025', 'e9200000-0000-4000-8000-000000000012', '10000000-0000-0000-0000-000000000004', '2024-04-02', '2024-04-02', 'completed', 'competitive', null);

insert into public.play_participants (play_id, user_id, placement, is_winner)
values
  ('e9210000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', 2, false),
  ('e9210000-0000-4000-8000-000000000002', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000003', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000004', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000005', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000006', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000002', 2, false),
  ('e9210000-0000-4000-8000-000000000007', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000002', 2, false),
  ('e9210000-0000-4000-8000-000000000008', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000002', 2, false),
  ('e9210000-0000-4000-8000-000000000009', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000010', '10000000-0000-0000-0000-000000000002', null, false),
  ('e9210000-0000-4000-8000-000000000011', '10000000-0000-0000-0000-000000000002', null, false),
  ('e9210000-0000-4000-8000-000000000012', '10000000-0000-0000-0000-000000000002', null, false),
  ('e9210000-0000-4000-8000-000000000013', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000014', '10000000-0000-0000-0000-000000000002', null, true),
  ('e9210000-0000-4000-8000-000000000015', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000016', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000017', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000018', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000019', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000020', '10000000-0000-0000-0000-000000000003', 1, true),
  ('e9210000-0000-4000-8000-000000000021', '10000000-0000-0000-0000-000000000003', null, false),
  ('e9210000-0000-4000-8000-000000000022', '10000000-0000-0000-0000-000000000003', null, false),
  ('e9210000-0000-4000-8000-000000000023', '10000000-0000-0000-0000-000000000003', null, true),
  ('e9210000-0000-4000-8000-000000000024', '10000000-0000-0000-0000-000000000002', 1, true),
  ('e9210000-0000-4000-8000-000000000025', '10000000-0000-0000-0000-000000000002', 1, true);

-- 1–3. Katalog i skala Renomy pozostają zgodne z Etapem 1.
select is(
  (select count(*) from public.achievement_definitions
   where achievement_key in (
     'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
     'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
     'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
   ) and automation_status in ('automatic', 'secret') and not is_manual),
  11::bigint,
  '1. wszystkie 11 odznak Etapu 2A ma aktywną automatyzację'
);

select results_eq(
  $$
    select achievement_key, points
    from public.achievement_definitions
    where achievement_key in (
      'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
      'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
      'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
    )
    order by achievement_key
  $$,
  $$
    values
      ('boss_defeated', 35), ('final_boss', 35), ('friendly_fire', 20),
      ('legendary_artifact', 20), ('oathbreaker', 20), ('resurrection', 20),
      ('save_scummer', 10), ('skill_issue', 20), ('tadpole_enjoyer', 10),
      ('time_traveler', 35), ('vicious_mockery', 10)
  $$,
  '2. Renoma używa niezmienionej skali rarity'
);

select is(
  (select count(*) from public.achievement_domain_dependencies
   where achievement_key in (
     'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
     'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
     'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
   )),
  13::bigint,
  '3. zależności play/rating są kompletne i bez duplikatów'
);

-- 4–25. Pozytywne oraz graniczne/negatywne przypadki każdego warunku.
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'tadpole_enjoyer'), '4. Tadpole: ocena 5 przed ukończoną partią kwalifikuje');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000001', 'tadpole_enjoyer'), '5. Tadpole: udział bez wcześniejszej oceny nie kwalifikuje');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'save_scummer'), '6. Save Scummer: 3 udziały włącznie z granicą 7 dni kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000001', 'save_scummer'), '7. Save Scummer: pojedynczy udział nie kwalifikuje');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000004', 'save_scummer'), '8. Save Scummer: autor wpisów bez udziału nie kwalifikuje');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'vicious_mockery'), '9. Vicious Mockery: 3 niskie oceny z komentarzem kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'vicious_mockery'), '10. Vicious Mockery: pusty komentarz nie liczy się jako trzeci');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'legendary_artifact'), '11. Legendary Artifact: rok 1999 kwalifikuje');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'legendary_artifact'), '12. Legendary Artifact: rok 2000 nie kwalifikuje');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'resurrection'), '13. Resurrection: dokładnie 365 dni kwalifikuje');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'resurrection'), '14. Resurrection: 364 dni nie kwalifikuje');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'oathbreaker'), '15. Oathbreaker: wcześniejsze NIE i późniejsza partia kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'oathbreaker'), '16. Oathbreaker: deklaracja zmieniona po partii nie kwalifikuje');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'skill_issue'), '17. Skill Issue: 3 kolejne realne ostatnie miejsca kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'skill_issue'), '18. Skill Issue: zwycięstwa i coop nie tworzą serii ostatnich miejsc');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'friendly_fire'), '19. Friendly Fire: 3 kooperacyjne porażki kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'friendly_fire'), '20. Friendly Fire: 2 porażki to za mało');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'time_traveler'), '21. Time Traveler: 4 różne dekady kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'time_traveler'), '22. Time Traveler: mniej niż 4 dekady nie kwalifikuje');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'final_boss'), '23. Final Boss: zwycięstwa w 3 różnych grach o weight >= 4.0 kwalifikują');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'final_boss'), '24. Final Boss: mniej niż 3 różne ciężkie gry nie kwalifikują');
select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000002', 'boss_defeated'), '25. Boss Defeated: kooperacyjna wygrana przy weight 3.5 kwalifikuje');
select ok(not private.qualifies_for_achievement('10000000-0000-0000-0000-000000000003', 'boss_defeated'), '26. Boss Defeated: weight 3.49 nie kwalifikuje');

-- 27–30. Eligibility: admin jest graczem, observer i inactive nie dostają unlocków.
update public.app_members set role = 'observer', is_active = true
where user_id = '10000000-0000-0000-0000-000000000005';

select ok(private.qualifies_for_achievement('10000000-0000-0000-0000-000000000001', 'legendary_artifact'), '27. aktywny admin-gracz spełnia warunek z własnego udziału');
select ok(private.is_gamification_eligible('10000000-0000-0000-0000-000000000001'), '28. admin-gracz jest objęty grywalizacją');

-- Preview przed APPLY: ma być wyłącznie odczytem.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
set local role authenticated;

select lives_ok(
  $$select * from public.preview_legendarium_stage2a_reconciliation()$$,
  '29. admin może uruchomić read-only preview Etapu 2A'
);

reset role;

select is(
  (select count(*) from public.user_achievements
   where user_id = '10000000-0000-0000-0000-000000000002'
     and achievement_key in (
       'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
       'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
       'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
     )),
  0::bigint,
  '30. preview nie zapisuje żadnego unlocku'
);

select is(
  (select count(*) from public.point_events
   where action_type like 'achievement\_unlocked:%' escape '\'
     and user_id in (
       '10000000-0000-0000-0000-000000000001',
       '10000000-0000-0000-0000-000000000002',
       '10000000-0000-0000-0000-000000000003'
     )
     and substring(action_type from length('achievement_unlocked:') + 1) in (
       'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
       'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
       'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
     )),
  0::bigint,
  '31. preview nie zapisuje point_events ani Renomy'
);

-- 32–42. Automatyzacja, backfill, idempotencja, Renoma i klasy.
select private.recompute_play_rewards(
  array['10000000-0000-0000-0000-000000000001'::uuid],
  'e9210000-0000-4000-8000-000000000001',
  'test_stage2a_live_play'
);

select ok(
  exists (
    select 1
    from public.user_achievements
    where user_id = '10000000-0000-0000-0000-000000000001'
      and achievement_key = 'legendary_artifact'
  ),
  '32. wspólny recompute Kroniki automatycznie uruchamia achievementy Etapu 2A'
);

select ok(
  private.recompute_legendarium_stage2a_achievements(null, null, 'test_stage2a_backfill') > 0,
  '33. pierwszy historyczny recompute tworzy zmiany'
);

select is(
  (select count(*) from public.user_achievements
   where user_id = '10000000-0000-0000-0000-000000000002'
     and achievement_key in (
       'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
       'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
       'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
     )),
  11::bigint,
  '34. backfill przyznaje Marcie wszystkie 11 jednoznacznie spełnionych odznak'
);

select is(
  private.recompute_legendarium_stage2a_achievements(null, null, 'test_stage2a_repeat'),
  0,
  '35. drugi recompute jest idempotentny'
);

select results_eq(
  $$
    select
      count(*)::bigint,
      sum(private.reward_ledger_net(
        '10000000-0000-0000-0000-000000000002',
        'achievement',
        earned.achievement_key
      ))::bigint
    from public.user_achievements as earned
    where earned.user_id = '10000000-0000-0000-0000-000000000002'
      and earned.achievement_key in (
        'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
        'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
        'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
      )
  $$,
  $$values (11::bigint, 235::bigint)$$,
  '36. każdy unlock ma dokładnie jedną docelową wartość Renomy'
);

select results_eq(
  $$
    select
      definition.achievement_key,
      count(event.id)::bigint
    from public.achievement_definitions as definition
    left join public.point_events as event
      on event.user_id = '10000000-0000-0000-0000-000000000002'
     and event.action_type = 'achievement_unlocked:' || definition.achievement_key
     and event.related_entity_type = 'profile'
     and event.related_entity_id = event.user_id
    where definition.achievement_key in (
        'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
        'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
        'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
    )
    group by definition.achievement_key
    order by definition.achievement_key
  $$,
  $$
    select definition.achievement_key, 1::bigint
    from public.achievement_definitions as definition
    where definition.achievement_key in (
      'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
      'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
      'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
    )
    order by definition.achievement_key
  $$,
  '37. idempotencja pozostawia po jednym zdarzeniu Renomy na unlock'
);

select ok(
  exists (select 1 from public.user_achievements
          where user_id = '10000000-0000-0000-0000-000000000001'
            and achievement_key = 'legendary_artifact'),
  '38. backfill obejmuje aktywnego admina-gracza'
);

select ok(
  not exists (select 1 from public.user_achievements
              where user_id in (
                '10000000-0000-0000-0000-000000000005',
                '10000000-0000-0000-0000-000000000006'
              )
                and achievement_key in (
                  'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
                  'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
                  'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
                )),
  '39. observer i inactive nie zdobywają odznak Etapu 2A'
);

select results_eq(
  $$
    select
      (select count(*) from public.class_definitions where is_active)::bigint,
      count(*)::bigint
    from public.class_requirements as requirement
    join public.user_achievements as earned
      on earned.achievement_key = requirement.achievement_key
     and earned.user_id = '10000000-0000-0000-0000-000000000002'
    where requirement.achievement_key in (
      'tadpole_enjoyer', 'save_scummer', 'vicious_mockery',
      'legendary_artifact', 'resurrection', 'oathbreaker', 'skill_issue',
      'friendly_fire', 'time_traveler', 'final_boss', 'boss_defeated'
    )
  $$,
  $$values (14::bigint, 18::bigint)$$,
  '40. 14 klas pozostaje bez redesignu, a 18 wymagań klas dostaje realny progres'
);

select is(
  (select count(*) from public.preview_legendarium_stage2a_reconciliation()),
  0::bigint,
  '41. po recompute preview nie proponuje unlocków, revoke ani korekt Renomy'
);

select is(
  private.recompute_legendarium_stage2a_achievements(null, null, 'test_stage2a_third_pass'),
  0,
  '42. kolejny historyczny recompute nadal nie tworzy zmian'
);

select * from finish();
rollback;
