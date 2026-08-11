begin;

create extension if not exists pgtap with schema extensions;
select plan(22);

-- Pokrywa 20260809120000_live_meeting_plays.sql: stan „GRAMY!” — partia grana
-- na żywo przy stole, prowadzona na istniejącym wpisie Kroniki (public.plays).
--
-- Konwencja jak w 010/012: MUTACJE jako zalogowany członek (przez realne RPC),
-- ASERCJE jako superuser (RLS nie chowa cudzych wierszy).
--
-- Fixture'y z seed.sql:
--   ...0001 Przemek     admin,  active
--   ...0002 Marta       member, active  -> organizatorka wieczoru
--   ...0003 Michał      member, active  -> RSVP „będę”
--   ...0004 Ania        member, active  -> RSVP „nie będę”
--   gry: ...0002 Frostpunk, ...0003 XCOM, ...0004 Wyspa Skarbów

create temporary table t_ids (name text primary key, id uuid);
grant insert, select, update on t_ids to authenticated;

-- ---------------------------------------------------------------------------
-- Przygotowanie: trwające spotkanie z jednym RSVP na tak i jednym na nie
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
        p_title => 'Wieczór przy stole',
        p_starts_at => now() - interval '15 minutes',
        p_ends_at => now() + interval '4 hours',
        p_invited_user_ids => array[
          '10000000-0000-0000-0000-000000000003'::uuid,
          '10000000-0000-0000-0000-000000000004'::uuid
        ]);
      insert into t_ids (name, id) values ('meeting', v_meeting_id);
    end;
    $body$
  $$,
  '1. przygotowanie: trwające spotkanie z dwoma zaproszonymi'
);
reset role;

-- RSVP to fixture, nie przedmiot testu — zapisujemy je jako superuser.
insert into public.meeting_availability (meeting_id, user_id, is_available)
values
  (
    (select id from t_ids where name = 'meeting'),
    '10000000-0000-0000-0000-000000000003',
    true
  ),
  (
    (select id from t_ids where name = 'meeting'),
    '10000000-0000-0000-0000-000000000004',
    false
  )
on conflict (meeting_id, user_id) do update
set is_available = excluded.is_available;

-- ---------------------------------------------------------------------------
-- Start partii przy stole
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
    begin
      insert into t_ids (name, id)
      values (
        'play_1',
        public.start_meeting_play(
          (select id from t_ids where name = 'meeting'),
          '30000000-0000-0000-0000-000000000002'
        )
      );
    end;
    $body$
  $$,
  '2. „Zaczynamy grać” tworzy partię na istniejącym wpisie Kroniki'
);
reset role;

select results_eq(
  $$
    select status::text, live_started_at is not null, duration_minutes
    from public.plays
    where id = (select id from t_ids where name = 'play_1')
  $$,
  $$values ('in_progress', true, null::integer)$$,
  '3. partia jest aktywna: in_progress ze znacznikiem startu, bez czasu trwania'
);

-- Notatki stanu partia grana na żywo nie ma i mieć nie musi — ograniczenie
-- plays_in_progress_requires_state_note zostało zawężone do partii odłożonych.
select results_eq(
  $$
    select state_note from public.plays
    where id = (select id from t_ids where name = 'play_1')
  $$,
  $$values (null::text)$$,
  '4. aktywna partia nie wymaga notatki „na czym skończyliśmy”'
);

select results_eq(
  $$
    select participant.user_id
    from public.play_participants as participant
    where participant.play_id = (select id from t_ids where name = 'play_1')
    order by participant.user_id
  $$,
  $$values
    ('10000000-0000-0000-0000-000000000002'::uuid),
    ('10000000-0000-0000-0000-000000000003'::uuid)$$,
  '5. skład to organizator i RSVP „będę” — osoba, która odmówiła, nie gra'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where related_entity_type = 'play'
      and related_entity_id = (select id from t_ids where name = 'play_1')
  $$,
  $$values (0::bigint)$$,
  '6. partia w toku nie nalicza żadnych punktów'
);

-- ---------------------------------------------------------------------------
-- Odporność na podwójne kliknięcie i na drogi omijające RPC
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select public.start_meeting_play(
      (select id from t_ids where name = 'meeting'),
      '30000000-0000-0000-0000-000000000002'
    )
  $$,
  $$select id from t_ids where name = 'play_1'$$,
  '7. ponowione „Zaczynamy grać” zwraca tę samą partię, nie zakłada drugiej'
);
reset role;

-- Inny gracz, inna gra, ten sam wieczór: nadal jedna aktywna partia.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select public.start_meeting_play(
      (select id from t_ids where name = 'meeting'),
      '30000000-0000-0000-0000-000000000004'
    )
  $$,
  $$select id from t_ids where name = 'play_1'$$,
  '8. drugi gracz przy tym samym stole dostaje trwającą partię, nie nową'
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
    insert into public.plays (
      game_id, meeting_id, created_by, played_at, status, live_started_at
    )
    values (
      '30000000-0000-0000-0000-000000000004',
      (select id from t_ids where name = 'meeting'),
      '10000000-0000-0000-0000-000000000002',
      now(),
      'in_progress',
      now()
    )
  $$,
  '23505',
  null,
  '9. druga aktywna partia tego samego spotkania jest niemożliwa także z pominięciem RPC'
);
reset role;

-- ---------------------------------------------------------------------------
-- Aktywna partia nie jest partią „do kontynuacji” ani nie pozwala zamknąć wieczoru
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
      p_title => 'Kontynuacja biegnącej partii',
      p_starts_at => now() + interval '7 days',
      p_ends_at => now() + interval '7 days 3 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => (select id from t_ids where name = 'play_1'))
  $$,
  '23514',
  null,
  '10. partii granej właśnie przy stole nie da się wskazać jako kontynuowanej'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.complete_meeting((select id from t_ids where name = 'meeting'))$$,
  '23514',
  null,
  '11. spotkania nie da się zakończyć, dopóki biegnie partia bez wyniku'
);
reset role;

-- ---------------------------------------------------------------------------
-- Zakończenie partii — tą samą drogą co ręczny zapis wyniku w Kronice
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
      p_play_id => (select id from t_ids where name = 'play_1'),
      p_game_id => '30000000-0000-0000-0000-000000000002',
      p_played_at => now() - interval '2 hours',
      p_meeting_id => (select id from t_ids where name = 'meeting'),
      p_duration_minutes => 120,
      p_participants => '[
        {"user_id":"10000000-0000-0000-0000-000000000002","is_winner":true,"placement":1},
        {"user_id":"10000000-0000-0000-0000-000000000003","is_winner":false,"placement":2}
      ]'::jsonb,
      p_status => 'completed')
  $$,
  '12. „Zakończ partię” zapisuje wynik istniejącym RPC Kroniki'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where action_type = 'play_participated'
      and related_entity_id = (select id from t_ids where name = 'play_1')
      and user_id = '10000000-0000-0000-0000-000000000002'
      and points > 0
  $$,
  $$values (1::bigint)$$,
  '13. Renoma za udział nalicza się każdemu uczestnikowi dokładnie raz'
);

-- Znacznik zostaje jako ślad „to była partia grana przy stole”; o tym, że nie
-- jest już aktywna, decyduje wyłącznie status.
select results_eq(
  $$
    select status::text, live_started_at is not null
    from public.plays
    where id = (select id from t_ids where name = 'play_1')
  $$,
  $$values ('completed', true)$$,
  '14. po zapisaniu wyniku partia jest zakończona, znacznik startu zostaje'
);

-- ---------------------------------------------------------------------------
-- Kolejna partia tego samego wieczoru
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
    begin
      insert into t_ids (name, id)
      values (
        'play_2',
        public.start_meeting_play(
          (select id from t_ids where name = 'meeting'),
          '30000000-0000-0000-0000-000000000003'
        )
      );
    end;
    $body$
  $$,
  '15. po zamknięciu poprzedniej partii zaczyna się kolejna, w innej grze'
);
reset role;

select isnt(
  (select id from t_ids where name = 'play_2'),
  (select id from t_ids where name = 'play_1'),
  '16. kolejna partia to osobny wpis Kroniki, nie nadpisanie poprzedniego'
);

select results_eq(
  $$
    select count(*)::bigint from public.plays
    where meeting_id = (select id from t_ids where name = 'meeting')
  $$,
  $$values (2::bigint)$$,
  '17. obie partie pozostają powiązane z jednym spotkaniem'
);

-- Autoryzacja wyprzedza sprawdzenie biegnącej partii: Michał nie jest ani
-- organizatorem, ani adminem, więc nie zamknie cudzego wieczoru.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.complete_meeting((select id from t_ids where name = 'meeting'))$$,
  '42501',
  null,
  '18. spotkanie zamyka wyłącznie organizator albo admin'
);
reset role;

-- ---------------------------------------------------------------------------
-- Koniec wieczoru
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
    begin
      perform public.update_play_with_participants(
        p_play_id => (select id from t_ids where name = 'play_2'),
        p_game_id => '30000000-0000-0000-0000-000000000003',
        p_played_at => now() - interval '30 minutes',
        p_meeting_id => (select id from t_ids where name = 'meeting'),
        p_duration_minutes => 30,
        p_participants => '[
          {"user_id":"10000000-0000-0000-0000-000000000002","is_winner":true,"placement":1}
        ]'::jsonb,
        p_status => 'completed');

      perform public.complete_meeting(
        (select id from t_ids where name = 'meeting'));
    end;
    $body$
  $$,
  '19. po zamknięciu ostatniej partii organizator kończy spotkanie'
);
reset role;

select results_eq(
  $$
    select status::text from public.meetings
    where id = (select id from t_ids where name = 'meeting')
  $$,
  $$values ('completed')$$,
  '20. zakończone spotkanie przestaje być spotkaniem w toku'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.start_meeting_play(
      (select id from t_ids where name = 'meeting'),
      '30000000-0000-0000-0000-000000000004'
    )
  $$,
  '23514',
  null,
  '21. na zakończonym spotkaniu nie da się już rozpocząć partii'
);
reset role;

-- Regresja: rozluźnienie ograniczenia dotyczy WYŁĄCZNIE partii granej na żywo.
-- Partia odkładana na później (ręczny wpis w Kronice) nadal musi powiedzieć,
-- na czym grupa skończyła.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select public.create_play_with_participants(
      p_game_id => '30000000-0000-0000-0000-000000000004',
      p_played_at => now(),
      p_participants => '[{"user_id":"10000000-0000-0000-0000-000000000002","is_winner":false}]'::jsonb,
      p_status => 'in_progress')
  $$,
  '23514',
  null,
  '22. partia odłożona na później nadal wymaga notatki „na czym skończyliśmy”'
);
reset role;

select * from finish();
rollback;
