begin;

create extension if not exists pgtap with schema extensions;
select plan(12);

create temporary table t_continuation_ids (name text primary key, id uuid);
grant insert, select, update on t_continuation_ids to authenticated;

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
        p_title => 'QA start automatycznej partii',
        p_starts_at => now() - interval '30 minutes',
        p_ends_at => now() + interval '4 hours',
        p_invited_user_ids => '{}'::uuid[]
      );
      v_play_id := public.start_meeting_play(
        v_meeting_id,
        '30000000-0000-0000-0000-000000000002'
      );

      insert into t_continuation_ids (name, id)
      values ('start_meeting', v_meeting_id), ('play', v_play_id);
    end;
    $body$
  $$,
  '1. Stół tworzy pojedynczy wpis in_progress powiązany z meeting_id'
);
reset role;

select results_eq(
  $$
    select status::text, meeting_id is not null,
           live_started_at is not null, live_ended_at is null,
           result_pending
    from public.plays
    where id = (select id from t_continuation_ids where name = 'play')
  $$,
  $$values ('in_progress', true, true, true, false)$$,
  '2. automatyczny wpis Stołu różni się od ręcznego wyłącznie kontekstem live i meeting_id'
);

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
        p_title => 'QA przyszła kontynuacja',
        p_starts_at => now() + interval '7 days',
        p_ends_at => now() + interval '7 days 4 hours',
        p_invited_user_ids => '{}'::uuid[],
        p_continued_play_id => (
          select id from t_continuation_ids where name = 'play'
        )
      );
      insert into t_continuation_ids (name, id)
      values ('continuation_meeting', v_meeting_id);
    end;
    $body$
  $$,
  '3. trwający wpis utworzony przez Stół można przypisać przyszłemu spotkaniu'
);
reset role;

select results_eq(
  $$
    select continued_play_id
    from public.meetings
    where id = (
      select id from t_continuation_ids where name = 'continuation_meeting'
    )
  $$,
  $$select id from t_continuation_ids where name = 'play'$$,
  '4. continued_play_id wskazuje istniejący wpis Kroniki'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.plays
    where id = (select id from t_continuation_ids where name = 'play')
  $$,
  $$values (1::bigint)$$,
  '5. przypisanie kontynuacji nie tworzy duplikatu wpisu Kroniki'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.update_meeting_with_invitations(
      p_meeting_id => (
        select id from t_continuation_ids where name = 'continuation_meeting'
      ),
      p_title => 'QA przyszła kontynuacja',
      p_starts_at => now() + interval '7 days',
      p_ends_at => now() + interval '7 days 4 hours',
      p_invited_user_ids => '{}'::uuid[],
      p_continued_play_id => null
    )
  $$,
  '6. edycja spotkania pozwala wyczyścić kontynuację'
);
reset role;

select is_empty(
  $$
    select 1
    from public.meetings
    where id = (
      select id from t_continuation_ids where name = 'continuation_meeting'
    )
      and continued_play_id is not null
  $$,
  '7. odznaczenie zapisuje continued_play_id jako null'
);

update public.plays
set live_ended_at = now(), result_pending = true
where id = (select id from t_continuation_ids where name = 'play');

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
        p_title => 'QA kontynuacja wyniku do uzupełnienia',
        p_starts_at => now() - interval '10 minutes',
        p_ends_at => now() + interval '4 hours',
        p_invited_user_ids => '{}'::uuid[],
        p_continued_play_id => (
          select id from t_continuation_ids where name = 'play'
        )
      );
      insert into t_continuation_ids (name, id)
      values ('pending_continuation_meeting', v_meeting_id);
    end;
    $body$
  $$,
  '8. wpis z wynikiem do uzupełnienia można przypisać spotkaniu jako kontynuację'
);
reset role;

select results_eq(
  $$
    select continued_play_id
    from public.meetings
    where id = (
      select id from t_continuation_ids
      where name = 'pending_continuation_meeting'
    )
  $$,
  $$select id from t_continuation_ids where name = 'play'$$,
  '9. kontynuacja wyniku nadal wskazuje ten sam play_id'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.resume_meeting_play(
      (select id from t_continuation_ids where name = 'pending_continuation_meeting'),
      (select id from t_continuation_ids where name = 'play')
    )
  $$,
  '10. wpis z wynikiem do uzupełnienia można faktycznie wznowić przy Stole'
);
reset role;

select results_eq(
  $$
    select status::text, live_started_at is not null,
           live_ended_at is null, result_pending
    from public.plays
    where id = (select id from t_continuation_ids where name = 'play')
  $$,
  $$values ('in_progress', true, true, false)$$,
  '11. wznowienie zachowuje status in_progress i zdejmuje znacznik oczekującego wyniku'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.plays
    where id = (select id from t_continuation_ids where name = 'play')
  $$,
  $$values (1::bigint)$$,
  '12. wznowienie wyniku do uzupełnienia nie tworzy drugiego wpisu Kroniki'
);

select * from finish();
rollback;
