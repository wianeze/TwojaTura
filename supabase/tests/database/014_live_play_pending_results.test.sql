begin;

create extension if not exists pgtap with schema extensions;
select plan(34);

-- Pokrywa 20260809150000_live_play_pending_results.sql: uprawnienia uczestnika,
-- rozdzielenie „koniec grania” od „wpisania wyniku”, anulowanie pomyłkowego
-- startu oraz odkładanie i kontynuację rozgrywki.
--
-- Konwencja jak w 010/012/013: MUTACJE jako zalogowany członek (przez realne
-- RPC), ASERCJE jako superuser (RLS nie chowa cudzych wierszy).
--
-- Fixture'y z seed.sql:
--   ...0001 Przemek  admin,  active
--   ...0002 Marta    member, active  -> organizatorka
--   ...0003 Michał   member, active  -> zaproszony uczestnik
--   ...0004 Ania     member, active  -> zaproszona, RSVP „nie”
--   ...0005 Kuba     member, active  -> spoza spotkania
--   gry: ...0002 Frostpunk, ...0003 XCOM, ...0004 Wyspa Skarbów

create temporary table t_ids (name text primary key, id uuid);
grant insert, select, update on t_ids to authenticated;

-- ---------------------------------------------------------------------------
-- Przygotowanie
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_meeting_id uuid;
    begin
      v_meeting_id := public.create_meeting_with_invitations(
        p_title => 'Wieczór przy stole',
        p_starts_at => now() - interval '20 minutes',
        p_ends_at => now() + interval '5 hours',
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
-- 1. Uprawnienia: uczestnik, nie autor
-- ---------------------------------------------------------------------------

-- Michał jest zaproszony i potwierdził — może rozpocząć partię, choć nie jest
-- organizatorem.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
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
  '2. każdy uczestnik spotkania może rozpocząć partię'
);
reset role;

-- Kuba nie jest ani organizatorem, ani zaproszonym, ani nie potwierdził.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$
    select public.start_meeting_play(
      (select id from t_ids where name = 'meeting'),
      '30000000-0000-0000-0000-000000000003'
    )
  $$,
  '42501',
  null,
  '3. osoba spoza spotkania nie rozpocznie na nim partii'
);
select throws_ok(
  $$
    select public.finish_meeting_play(
      (select id from t_ids where name = 'play_1')
    )
  $$,
  '42501',
  null,
  '4. osoba spoza spotkania nie zakończy cudzej partii'
);
reset role;

-- ---------------------------------------------------------------------------
-- 2. Anulowanie pomyłkowego startu
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$
    select public.cancel_meeting_play(
      (select id from t_ids where name = 'play_1')
    )
  $$,
  $$values (true)$$,
  '5. inny uczestnik może anulować pomyłkowo rozpoczętą partię'
);
reset role;

select is_empty(
  $$
    select 1 from public.plays
    where id = (select id from t_ids where name = 'play_1')
  $$,
  '6. anulowana partia nie zostaje w Kronice'
);

select is_empty(
  $$
    select 1 from public.play_participants
    where play_id = (select id from t_ids where name = 'play_1')
  $$,
  '7. anulowana partia nie zostawia uczestników w statystykach'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where related_entity_type = 'play'
      and related_entity_id = (select id from t_ids where name = 'play_1')
  $$,
  $$values (0::bigint)$$,
  '8. anulowana partia nie nalicza żadnych punktów'
);

-- ---------------------------------------------------------------------------
-- 3. „Zakończ partię” — bez wyniku, bez nagród
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
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
          '30000000-0000-0000-0000-000000000002'
        )
      );
    end;
    $body$
  $$,
  '9. po anulowaniu można spokojnie rozpocząć właściwą grę'
);
reset role;

-- Zegar musi zmierzyć realny czas, więc cofamy start o dwie godziny.
update public.plays
set live_started_at = now() - interval '2 hours',
    played_at = now() - interval '2 hours'
where id = (select id from t_ids where name = 'play_2');

-- Michał kończy partię rozpoczętą przez Martę.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    select public.finish_meeting_play(
      (select id from t_ids where name = 'play_2')
    )
  $$,
  '10. uczestnik B kończy partię rozpoczętą przez uczestnika A'
);
reset role;

select results_eq(
  $$
    select status::text, result_pending, live_ended_at is not null
    from public.plays
    where id = (select id from t_ids where name = 'play_2')
  $$,
  $$values ('in_progress', true, true)$$,
  '11. zakończona partia bez wyniku NIE jest completed — czeka na rozliczenie'
);

select results_eq(
  $$
    select duration_minutes from public.plays
    where id = (select id from t_ids where name = 'play_2')
  $$,
  $$values (120)$$,
  '12. zakończenie zapisuje rzeczywisty czas gry'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where related_entity_type = 'play'
      and related_entity_id = (select id from t_ids where name = 'play_2')
  $$,
  $$values (0::bigint)$$,
  '13. przed uzupełnieniem wyniku nie ma żadnych nagród'
);

-- ---------------------------------------------------------------------------
-- 4. Wynik do uzupełnienia nie blokuje kolejnej gry
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    begin
      insert into t_ids (name, id)
      values (
        'play_3',
        public.start_meeting_play(
          (select id from t_ids where name = 'meeting'),
          '30000000-0000-0000-0000-000000000003'
        )
      );
    end;
    $body$
  $$,
  '14. kolejną grę można zacząć mimo poprzedniego wyniku do uzupełnienia'
);
reset role;

select isnt(
  (select id from t_ids where name = 'play_3'),
  (select id from t_ids where name = 'play_2'),
  '15. to osobna partia, nie wznowienie poprzedniej'
);

select results_eq(
  $$
    select count(*)::bigint from public.plays
    where meeting_id = (select id from t_ids where name = 'meeting')
      and status = 'in_progress'
      and live_started_at is not null
      and live_ended_at is null
  $$,
  $$values (1::bigint)$$,
  '16. mimo dwóch niedokończonych partii tylko JEDNA jest faktycznie aktywna'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
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
      now(), 'in_progress', now()
    )
  $$,
  '23505',
  null,
  '17. druga faktycznie aktywna partia jest niemożliwa także z pominięciem RPC'
);
reset role;

-- ---------------------------------------------------------------------------
-- 5. Zakończenie spotkania z wynikami do uzupełnienia
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select throws_ok(
  $$select public.complete_meeting((select id from t_ids where name = 'meeting'))$$,
  '23514',
  null,
  '18. spotkania nie da się zamknąć podczas faktycznie trwającej partii'
);
reset role;

-- „Odłóż partię”: rozgrywka zostaje niedokończona i czeka na kolejną sesję.
update public.plays
set live_started_at = now() - interval '3 hours'
where id = (select id from t_ids where name = 'play_3');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    select public.finish_meeting_play(
      (select id from t_ids where name = 'play_3'),
      p_result_pending => false,
      p_state_note => 'Runda 3 z 5'
    )
  $$,
  '19. „Odłóż partię” zamyka sesję bez wymagania wyniku'
);
reset role;

select results_eq(
  $$
    select status::text, result_pending, duration_minutes, state_note
    from public.plays
    where id = (select id from t_ids where name = 'play_3')
  $$,
  $$values ('in_progress', false, 180, 'Runda 3 z 5')$$,
  '20. odłożona partia zostaje w toku, z zapisanym czasem pierwszej sesji'
);

select results_eq(
  $$
    select count(*)::bigint from public.point_events
    where related_entity_type = 'play'
      and related_entity_id = (select id from t_ids where name = 'play_3')
  $$,
  $$values (0::bigint)$$,
  '21. odłożenie partii nie nalicza żadnych nagród'
);

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$select public.complete_meeting((select id from t_ids where name = 'meeting'))$$,
  $$values (true)$$,
  '22. spotkanie da się zamknąć mimo partii czekających na wynik i odłożonych'
);
reset role;

-- ---------------------------------------------------------------------------
-- 6. Kontynuacja na kolejnym spotkaniu
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_meeting_id uuid;
    begin
      v_meeting_id := public.create_meeting_with_invitations(
        p_title => 'Kolejny wieczór',
        p_starts_at => now() - interval '10 minutes',
        p_ends_at => now() + interval '5 hours',
        p_invited_user_ids => array['10000000-0000-0000-0000-000000000003'::uuid]);
      insert into t_ids (name, id) values ('meeting_2', v_meeting_id);
    end;
    $body$
  $$,
  '23. przygotowanie: kolejne spotkanie kilka dni później'
);
reset role;

-- result_pending oznacza brak wyniku, a nie blokadę kontynuacji. Wpis można
-- wznowić i ponownie odłożyć bez tworzenia nowej partii.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    begin
      perform public.resume_meeting_play(
        (select id from t_ids where name = 'meeting_2'),
        (select id from t_ids where name = 'play_2')
      );
      perform public.pause_meeting_play(
        (select id from t_ids where name = 'meeting_2'),
        (select id from t_ids where name = 'play_2'),
        'Wynik uzupełnimy później'
      );
    end;
    $body$
  $$,
  '24. partię czekającą na wynik można wznowić i ponownie odłożyć'
);
reset role;

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    select public.resume_meeting_play(
      (select id from t_ids where name = 'meeting_2'),
      (select id from t_ids where name = 'play_3')
    )
  $$,
  '25. odłożoną partię wznawia dowolny uczestnik nowego spotkania'
);
reset role;

select results_eq(
  $$
    select continued_play_id from public.meetings
    where id = (select id from t_ids where name = 'meeting_2')
  $$,
  $$select id from t_ids where name = 'play_3'$$,
  '26. wznowienie korzysta z istniejącego mechanizmu kontynuacji'
);

select results_eq(
  $$
    select count(*)::bigint from public.plays
    where game_id = '30000000-0000-0000-0000-000000000003'
      and (
        meeting_id in (select id from t_ids where name in ('meeting', 'meeting_2'))
        or id = (select id from t_ids where name = 'play_3')
      )
  $$,
  $$values (1::bigint)$$,
  '27. kontynuacja NIE tworzy duplikatu — to nadal jeden wpis Kroniki'
);

-- Druga sesja dokłada się do łącznego czasu, nie kasuje pierwszej.
update public.plays
set live_started_at = now() - interval '2 hours'
where id = (select id from t_ids where name = 'play_3');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    select public.finish_meeting_play(
      (select id from t_ids where name = 'play_3')
    )
  $$,
  '28. kontynuowaną partię kończy się tak samo jak każdą inną'
);
reset role;

select results_eq(
  $$
    select duration_minutes from public.plays
    where id = (select id from t_ids where name = 'play_3')
  $$,
  $$values (300)$$,
  '29. łączny czas to suma sesji (3h + 2h), historia nie znika'
);

-- Rozliczona partia jest historią i nie wraca do gry.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    begin
      perform public.update_play_with_participants(
        p_play_id => (select id from t_ids where name = 'play_3'),
        p_game_id => '30000000-0000-0000-0000-000000000003',
        p_played_at => now() - interval '5 hours',
        p_meeting_id => (select id from t_ids where name = 'meeting'),
        p_duration_minutes => 300,
        p_participants => '[
          {"user_id":"10000000-0000-0000-0000-000000000003","is_winner":true,"placement":1}
        ]'::jsonb,
        p_status => 'completed');

      begin
        perform public.resume_meeting_play(
          (select id from t_ids where name = 'meeting_2'),
          (select id from t_ids where name = 'play_3'));
        raise exception 'completed play was resumed' using errcode = 'P0001';
      exception
        when sqlstate '23514' then
          null;
      end;
    end;
    $body$
  $$,
  '30. rozliczona partia nie może zostać przypadkowo wznowiona'
);
reset role;

-- ---------------------------------------------------------------------------
-- 7. Równoległe wieczory dwóch różnych grup
-- ---------------------------------------------------------------------------
--
-- Reguła „jedna aktywna partia” dotyczy POJEDYNCZEGO spotkania i tylko jego.
-- Dwie różne grupy grające jednocześnie to normalny wieczór, nie błąd — gdyby
-- ktoś kiedyś podniósł ten indeks do poziomu globalnego, ten test to złapie.

select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    declare
      v_meeting_id uuid;
    begin
      v_meeting_id := public.create_meeting_with_invitations(
        p_title => 'Równoległy wieczór drugiej grupy',
        p_starts_at => now() - interval '20 minutes',
        p_ends_at => now() + interval '5 hours',
        p_invited_user_ids => array['10000000-0000-0000-0000-000000000005'::uuid]);
      insert into t_ids (name, id) values ('meeting_parallel', v_meeting_id);

      insert into t_ids (name, id)
      values (
        'play_parallel',
        public.start_meeting_play(
          v_meeting_id,
          '30000000-0000-0000-0000-000000000001'
        )
      );
    end;
    $body$
  $$,
  '31. druga grupa zaczyna własną partię, choć pierwsza nadal ma swoje wpisy'
);
reset role;

-- Pierwsza grupa wznawia swój odłożony wieczór (meeting_2 kontynuuje play_3 —
-- tu już rozliczony, więc bierzemy świeży start na meeting_2), żeby DWIE
-- partie biegły naraz na DWÓCH różnych spotkaniach.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
set local role authenticated;
select lives_ok(
  $$
    do $body$
    begin
      insert into t_ids (name, id)
      values (
        'play_first_group',
        public.start_meeting_play(
          (select id from t_ids where name = 'meeting_2'),
          '30000000-0000-0000-0000-000000000002'
        )
      );
    end;
    $body$
  $$,
  '32. pierwsza grupa gra u siebie w tym samym czasie — bez kolizji'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.plays
    where status = 'in_progress'
      and live_started_at is not null
      and live_ended_at is null
      and meeting_id in (
        select id from t_ids where name in ('meeting_2', 'meeting_parallel')
      )
  $$,
  $$values (2::bigint)$$,
  '33. dwa różne spotkania mają jednocześnie po jednej aktywnej partii'
);

-- Ale w obrębie JEDNEGO spotkania nadal tylko jedna.
select set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}', true);
set local role authenticated;
select results_eq(
  $$
    select public.start_meeting_play(
      (select id from t_ids where name = 'meeting_parallel'),
      '30000000-0000-0000-0000-000000000003'
    )
  $$,
  $$select id from t_ids where name = 'play_parallel'$$,
  '34. na pojedynczym spotkaniu nadal obowiązuje jedna aktywna partia'
);
reset role;

select * from finish();
rollback;
