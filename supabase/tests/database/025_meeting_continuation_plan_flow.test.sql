begin;

create extension if not exists pgtap with schema extensions;
select plan(14);

select has_function(
  'public',
  'create_meeting_plan_with_invitations',
  array['text', 'timestamptz', 'timestamptz', 'uuid[]', 'text', 'text', 'uuid'],
  '1. istnieje atomowy zapis nowego planu z propozycją kontynuacji'
);
select has_function(
  'public',
  'update_meeting_plan_with_invitations',
  array['uuid', 'text', 'timestamptz', 'timestamptz', 'uuid[]', 'text', 'text', 'uuid'],
  '2. istnieje atomowa edycja planu z propozycją kontynuacji'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.create_meeting_plan_with_invitations(text,timestamptz,timestamptz,uuid[],text,text,uuid)',
    'EXECUTE'
  ),
  '3. anon nie może tworzyć planu spotkania'
);

create temporary table t_meeting_plan_ids (
  name text primary key,
  id uuid not null
);
grant select, insert on t_meeting_plan_ids to authenticated;

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
      v_source_meeting_id uuid;
      v_play_id uuid;
    begin
      v_source_meeting_id := public.create_meeting_with_invitations(
        p_title => 'QA źródło planowanej kontynuacji',
        p_starts_at => now() - interval '3 hours',
        p_ends_at => now() + interval '1 hour',
        p_invited_user_ids => '{}'::uuid[]
      );
      v_play_id := public.start_meeting_play(
        v_source_meeting_id,
        '30000000-0000-0000-0000-000000000002'
      );

      insert into t_meeting_plan_ids (name, id)
      values ('source_meeting', v_source_meeting_id), ('play', v_play_id);
    end;
    $body$
  $$,
  '4. fixture tworzy jedną istniejącą partię'
);
reset role;

update public.plays
set live_ended_at = now(), result_pending = true
where id = (select id from t_meeting_plan_ids where name = 'play');

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
      v_meeting_id := public.create_meeting_plan_with_invitations(
        p_title => 'QA plan z propozycją dokończenia',
        p_starts_at => now() - interval '10 minutes',
        p_ends_at => now() + interval '4 hours',
        p_invited_user_ids => array[
          '10000000-0000-0000-0000-000000000003'::uuid
        ],
        p_proposed_continued_play_id => (
          select id from t_meeting_plan_ids where name = 'play'
        )
      );

      insert into t_meeting_plan_ids (name, id)
      values ('target_meeting', v_meeting_id);
    end;
    $body$
  $$,
  '5. formularz tworzy spotkanie razem z propozycją'
);
reset role;

select results_eq(
  $$
    select continued_play_id
    from public.meetings
    where id = (select id from t_meeting_plan_ids where name = 'target_meeting')
  $$,
  $$values (null::uuid)$$,
  '6. propozycja z formularza nie ustawia continued_play_id'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.meeting_continuation_proposals
    where meeting_id = (
      select id from t_meeting_plan_ids where name = 'target_meeting'
    )
      and continued_play_id = (
        select id from t_meeting_plan_ids where name = 'play'
      )
  $$,
  $$values (1::bigint)$$,
  '7. wybrana partia trafia jako jedna propozycja'
);

select results_eq(
  $$
    select wants_to_play
    from public.meeting_continuation_responses
    where meeting_id = (
      select id from t_meeting_plan_ids where name = 'target_meeting'
    )
      and continued_play_id = (
        select id from t_meeting_plan_ids where name = 'play'
      )
      and user_id = '10000000-0000-0000-0000-000000000002'::uuid
  $$,
  $$values (true)$$,
  '8. organizator od razu głosuje Chcę grać'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select *
    from public.propose_meeting_game(
      (select id from t_meeting_plan_ids where name = 'target_meeting'),
      '30000000-0000-0000-0000-000000000003'::uuid
    )
  $$,
  '9. po propozycji kontynuacji nadal można proponować zwykłą grę'
);
select lives_ok(
  $$
    select public.resume_meeting_play(
      (select id from t_meeting_plan_ids where name = 'target_meeting'),
      (select id from t_meeting_plan_ids where name = 'play')
    )
  $$,
  '10. dopiero Stół wznawia wybraną partię'
);
reset role;

select results_eq(
  $$
    select continued_play_id
    from public.meetings
    where id = (select id from t_meeting_plan_ids where name = 'target_meeting')
  $$,
  $$select id from t_meeting_plan_ids where name = 'play'$$,
  '11. wznowienie przy Stole ustawia continued_play_id'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.plays
    where id = (select id from t_meeting_plan_ids where name = 'play')
  $$,
  $$values (1::bigint)$$,
  '12. wznowienie nie tworzy nowego wpisu Kroniki'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.pause_meeting_play(
      (select id from t_meeting_plan_ids where name = 'target_meeting'),
      (select id from t_meeting_plan_ids where name = 'play')
    )
  $$,
  '13. odłożenie zatrzymuje tę samą partię'
);
reset role;

select results_eq(
  $$
    select continued_play_id
    from public.meetings
    where id = (select id from t_meeting_plan_ids where name = 'target_meeting')
  $$,
  $$select id from t_meeting_plan_ids where name = 'play'$$,
  '14. odłożenie zachowuje wybraną kontynuację i historię spotkania'
);

select * from finish();
rollback;
