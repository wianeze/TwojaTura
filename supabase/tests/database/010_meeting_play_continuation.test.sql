begin;

create extension if not exists pgtap with schema extensions;
select plan(21);

-- Pokrywa 20260808120000_meeting_play_continuation.sql: kontynuacja
-- rozpoczętej partii na kolejnym spotkaniu (meetings.continued_play_id).
--
-- Konwencja jak w 008_meeting_invitations.test.sql: MUTACJE jako zalogowany
-- członek (przez realne RPC), ASERCJE jako superuser (RLS nie chowa cudzych
-- wierszy).
--
-- Fixture'y z seed.sql:
--   ...0001 Przemek     admin,  active
--   ...0002 Marta       member, active  -> organizatorka i autorka partii
--   ...0003 Michał      member, active  -> osoba spoza organizacji spotkania
--   gra ...0002 = Frostpunk

create temporary table t_ids (name text primary key, id uuid);
grant insert, select, update on t_ids to authenticated;

-- ---------------------------------------------------------------------------
-- Przygotowanie: spotkanie startowe + partia w toku zapisana na tym spotkaniu
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_meeting_id uuid;
      v_play_id uuid;
    begin
      v_meeting_id := public.create_meeting_with_invitations(
        p_title => 'Piątkowy start',
        p_starts_at => now() - interval '2 days',
        p_ends_at => now() - interval '2 days' + interval '4 hours',
        p_invited_user_ids => '{}'::uuid[]);
      insert into t_ids (name, id) values ('start', v_meeting_id);

      v_play_id := public.create_play_with_participants(
        p_game_id => '30000000-0000-0000-0000-000000000002',
        p_played_at => now() - interval '2 days',
        p_meeting_id => v_meeting_id,
        p_participants => '[{"user_id":"10000000-0000-0000-0000-000000000002","is_winner":false}]'::jsonb,
        p_status => 'in_progress',
        p_state_note => 'Runda 3 z 5');
      insert into t_ids (name, id) values ('play', v_play_id);
    end;
    $body$
  $$,
  '1. przygotowanie: spotkanie startowe i partia w toku zapisana na nim'
);
reset role;

-- ---------------------------------------------------------------------------
-- Ustawianie kontynuacji
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_meeting_id uuid;
    begin
      v_meeting_id := public.create_meeting_with_invitations(
        p_title => 'Sobotnia kontynuacja',
        p_starts_at => now() - interval '1 day',
        p_ends_at => now() - interval '1 day' + interval '4 hours',
        p_invited_user_ids => '{}'::uuid[],
        p_continued_play_id => (select id from t_ids where name = 'play'));
      insert into t_ids (name, id) values ('cont_1', v_meeting_id);
    end;
    $body$
  $$,
  '2. spotkanie może wskazać partię w toku jako kontynuowaną'
);
reset role;

select results_eq(
  $$
    select continued_play_id from public.meetings
    where id = (select id from t_ids where name = 'cont_1')
  $$,
  $$select id from t_ids where name = 'play'$$,
  '3. wskaźnik kontynuacji zapisał się na właściwej partii'
);

-- Liczymy partie związane ZE SPOTKANIAMI tego testu, a nie wszystkie wpisy dla
-- danej gry: baza deweloperska bywa ręcznie zaśmiecona i globalny licznik
-- mierzyłby wtedy cudze dane zamiast skutku kontynuacji.
select results_eq(
  $$
    select count(*)::bigint from public.plays
    where meeting_id in (select id from t_ids where name in ('start', 'cont_1'))
  $$,
  $$values (1::bigint)$$,
  '4. kontynuacja NIE tworzy drugiego wpisu w Kronice'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where related_entity_type = 'play'
      and related_entity_id = (select id from t_ids where name = 'play')
  $$,
  $$values (0::bigint)$$,
  '5. samo ustawienie kontynuacji nie nalicza żadnych punktów za partię'
);

-- Ta sama partia na kolejnym wieczorze — kontynuacji może być wiele.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_meeting_id uuid;
    begin
      v_meeting_id := public.create_meeting_with_invitations(
        p_title => 'Niedzielna dogrywka',
        p_starts_at => now() - interval '12 hours',
        p_ends_at => now() - interval '8 hours',
        p_invited_user_ids => '{}'::uuid[],
        p_continued_play_id => (select id from t_ids where name = 'play'));
      insert into t_ids (name, id) values ('cont_2', v_meeting_id);
    end;
    $body$
  $$,
  '6. jedna partia może być kontynuowana na wielu kolejnych spotkaniach'
);
reset role;

select results_eq(
  $$
    select meeting_id from public.plays
    where id = (select id from t_ids where name = 'play')
  $$,
  $$select id from t_ids where name = 'start'$$,
  '7. plays.meeting_id pozostaje kotwicą startu — kontynuacje go nie przepinają'
);

-- ---------------------------------------------------------------------------
-- Walidacja wskaźnika
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.create_meeting_with_invitations(
      p_title => 'Kontynuacja widma',
      p_starts_at => now() + interval '1 day',
      p_ends_at => now() + interval '1 day 3 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)
  $$,
  '23503',
  null,
  '8. nieistniejąca partia nie może zostać wskazana jako kontynuowana'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_ids where name = 'start'),
      p_title => 'Piątkowy start',
      p_starts_at => now() - interval '2 days',
      p_ends_at => now() - interval '2 days' + interval '4 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => (select id from t_ids where name = 'play'))
  $$,
  '23514',
  null,
  '9. spotkanie startowe nie może być własną kontynuacją'
);
reset role;

-- Bezpośredni zapis do kolumny z pominięciem RPC: brak grantu kolumnowego.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    update public.meetings
    set continued_play_id = (select id from t_ids where name = 'play')
    where id = (select id from t_ids where name = 'cont_1')
  $$,
  '42501',
  null,
  '10. kolumny continued_play_id nie da się zapisać bezpośrednio, z pominięciem walidacji'
);
reset role;

-- Michał nie jest ani organizatorem, ani adminem.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_ids where name = 'cont_2'),
      p_title => 'Niedzielna dogrywka',
      p_starts_at => now() - interval '12 hours',
      p_ends_at => now() - interval '8 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => null)
  $$,
  '42501',
  null,
  '11. osoba spoza organizatora/adminów nie ustawi ani nie zdejmie kontynuacji'
);
reset role;

-- ---------------------------------------------------------------------------
-- Usuwanie spotkania będącego częścią historii partii
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_meeting((select id from t_ids where name = 'start'))$$,
  'P0001',
  'To spotkanie jest częścią historii partii w Kronice. Najpierw usuń zapisaną na nim partię.',
  '12. spotkania startowego nie da się usunąć — komunikat wskazuje wpis Kroniki'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.delete_meeting((select id from t_ids where name = 'cont_2'))$$,
  'P0001',
  'To spotkanie jest częścią historii partii w Kronice. Najpierw usuń powiązanie z kontynuowaną partią w edycji spotkania.',
  '13. spotkania-kontynuacji też nie da się usunąć — komunikat wskazuje edycję spotkania'
);
reset role;

-- ---------------------------------------------------------------------------
-- Zamknięcie partii na kolejnej sesji
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_play_with_participants(
      p_play_id => (select id from t_ids where name = 'play'),
      p_game_id => '30000000-0000-0000-0000-000000000002',
      p_played_at => now() - interval '2 days',
      p_meeting_id => (select id from t_ids where name = 'start'),
      p_participants => '[{"user_id":"10000000-0000-0000-0000-000000000002","is_winner":true,"placement":1}]'::jsonb,
      p_status => 'completed')
  $$,
  '14. partię da się domknąć na kolejnej sesji, na tym samym wpisie Kroniki'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where action_type = 'play_participated'
      and related_entity_id = (select id from t_ids where name = 'play')
      and points > 0
  $$,
  $$values (1::bigint)$$,
  '15. punkty za zapis partii naliczają się dokładnie raz, mimo dwóch kontynuacji'
);

-- Wskaźnik zostaje przy zakończonej partii i NIE MOŻE blokować dalszej edycji
-- spotkania — walidacja obowiązuje wyłącznie przy zmianie wartości.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_ids where name = 'cont_1'),
      p_title => 'Sobotnia kontynuacja (poprawiony tytuł)',
      p_starts_at => now() - interval '1 day',
      p_ends_at => now() - interval '1 day' + interval '5 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => (select id from t_ids where name = 'play'))
  $$,
  '16. spotkanie z już zakończoną kontynuowaną partią nadal daje się edytować'
);
reset role;

-- Regresja pełnego scenariusza z życia: A rozpoczyna partię, B ją kontynuuje,
-- na B partia zostaje zamknięta, a potem ktoś poprawia w B WYŁĄCZNIE godzinę.
-- Wskaźnik musi to przeżyć — zarówno walidację (partia nie jest już
-- 'in_progress'), jak i sam zapis (żadnego cichego wyzerowania).
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_ids where name = 'cont_1'),
      p_title => 'Sobotnia kontynuacja (poprawiony tytuł)',
      p_starts_at => now() - interval '1 day' + interval '1 hour',
      p_ends_at => now() - interval '1 day' + interval '6 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => (select id from t_ids where name = 'play'))
  $$,
  '17. poprawka samej godziny na spotkaniu-kontynuacji przechodzi bez błędu'
);
reset role;

select results_eq(
  $$
    select continued_play_id from public.meetings
    where id = (select id from t_ids where name = 'cont_1')
  $$,
  $$select id from t_ids where name = 'play'$$,
  '18. po edycji godziny wskaźnik kontynuacji nadal wskazuje tę samą partię'
);

-- Ale ustawienie NOWEJ kontynuacji na zakończoną partię jest odrzucane.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.create_meeting_with_invitations(
      p_title => 'Kontynuacja zakończonej partii',
      p_starts_at => now() + interval '2 days',
      p_ends_at => now() + interval '2 days 3 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => (select id from t_ids where name = 'play'))
  $$,
  '23514',
  null,
  '19. zakończonej partii nie można wskazać jako kontynuowanej'
);
reset role;

-- ---------------------------------------------------------------------------
-- Wyjście awaryjne: zdjęcie powiązania odblokowuje usunięcie spotkania
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (select id from t_ids where name = 'cont_2'),
      p_title => 'Niedzielna dogrywka',
      p_starts_at => now() - interval '12 hours',
      p_ends_at => now() - interval '8 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => null)
  $$,
  '20. organizator może zdjąć powiązanie kontynuacji w edycji spotkania'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select public.delete_meeting((select id from t_ids where name = 'cont_2'))$$,
  $$values (true)$$,
  '21. po zdjęciu powiązania spotkanie da się usunąć'
);
reset role;

select * from finish();
rollback;
