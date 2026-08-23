begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_table(
  'public',
  'meeting_continuation_proposals',
  '1. istnieje osobna tabela propozycji konkretnych kontynuacji'
);
select has_table(
  'public',
  'meeting_continuation_responses',
  '2. istnieje osobna tabela odpowiedzi na kontynuacje'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.propose_meeting_continuation(uuid,uuid)',
    'EXECUTE'
  ),
  '3. anon nie może proponować kontynuacji'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.set_meeting_continuation_response(uuid,uuid,boolean)',
    'EXECUTE'
  ),
  '4. anon nie może głosować na kontynuację'
);

create temporary table t_continuation_proposal_ids (
  name text primary key,
  id uuid not null
);
grant select, insert on t_continuation_proposal_ids to authenticated;

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
      v_target_meeting_id uuid;
      v_deleted_meeting_id uuid;
      v_play_id uuid;
    begin
      v_source_meeting_id := public.create_meeting_with_invitations(
        p_title => 'QA źródło kontynuacji do głosowania',
        p_starts_at => now() - interval '2 hours',
        p_ends_at => now() + interval '2 hours',
        p_invited_user_ids => '{}'::uuid[]
      );
      v_play_id := public.start_meeting_play(
        v_source_meeting_id,
        '30000000-0000-0000-0000-000000000002'
      );
      v_target_meeting_id := public.create_meeting_with_invitations(
        p_title => 'QA wieczór z propozycją kontynuacji',
        p_starts_at => now() - interval '15 minutes',
        p_ends_at => now() + interval '4 hours',
        p_invited_user_ids => array[
          '10000000-0000-0000-0000-000000000003'::uuid
        ]
      );
      v_deleted_meeting_id := public.create_meeting_with_invitations(
        p_title => 'QA usunięte spotkanie dla propozycji',
        p_starts_at => now() + interval '2 days',
        p_ends_at => now() + interval '2 days 4 hours',
        p_invited_user_ids => '{}'::uuid[]
      );

      insert into t_continuation_proposal_ids (name, id)
      values
        ('source_meeting', v_source_meeting_id),
        ('target_meeting', v_target_meeting_id),
        ('deleted_meeting', v_deleted_meeting_id),
        ('play', v_play_id);
    end;
    $body$
  $$,
  '5. fixture tworzy jeden istniejący wpis Kroniki i docelowe spotkanie'
);
reset role;

-- Odłożenie partii: pozostaje tym samym wpisem in_progress, ale nie biegnie.
update public.plays
set live_ended_at = now(), result_pending = true
where id = (select id from t_continuation_proposal_ids where name = 'play');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select *
    from public.propose_meeting_continuation(
      (select id from t_continuation_proposal_ids where name = 'target_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play')
    )
  $$,
  '6. kliknięcie zapisuje propozycję kontynuacji'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.meeting_continuation_proposals
    where meeting_id = (
      select id from t_continuation_proposal_ids where name = 'target_meeting'
    )
      and continued_play_id = (
        select id from t_continuation_proposal_ids where name = 'play'
      )
  $$,
  $$values (1::bigint)$$,
  '7. propozycja wskazuje dokładny continued_play_id'
);

select results_eq(
  $$
    select wants_to_play
    from public.meeting_continuation_responses
    where meeting_id = (
      select id from t_continuation_proposal_ids where name = 'target_meeting'
    )
      and continued_play_id = (
        select id from t_continuation_proposal_ids where name = 'play'
      )
      and user_id = '10000000-0000-0000-0000-000000000002'::uuid
  $$,
  $$values (true)$$,
  '8. autor propozycji od razu głosuje Chcę grać'
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
    from public.propose_meeting_continuation(
      (select id from t_continuation_proposal_ids where name = 'target_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play')
    )
  $$,
  '9. ponowne zgłoszenie tej samej partii jest idempotentne'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.meeting_continuation_proposals
    where meeting_id = (
      select id from t_continuation_proposal_ids where name = 'target_meeting'
    )
  $$,
  $$values (1::bigint)$$,
  '10. ta sama kontynuacja nie tworzy duplikatu propozycji'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select *
    from public.set_meeting_continuation_response(
      (select id from t_continuation_proposal_ids where name = 'target_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play'),
      false
    )
  $$,
  '11. inny gracz może odpowiedzieć Nie chcę grać'
);
reset role;

select results_eq(
  $$
    select yes_count, no_count
    from public.meeting_continuation_rankings
    where meeting_id = (
      select id from t_continuation_proposal_ids where name = 'target_meeting'
    )
      and continued_play_id = (
        select id from t_continuation_proposal_ids where name = 'play'
      )
  $$,
  $$values (1::bigint, 1::bigint)$$,
  '12. ranking kontynuacji liczy głosy TAK i NIE'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select *
    from public.set_meeting_continuation_response(
      (select id from t_continuation_proposal_ids where name = 'target_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play'),
      true
    )
  $$,
  '13. odpowiedź na kontynuację można zmienić na Chcę grać'
);
reset role;

select results_eq(
  $$
    select yes_count, no_count
    from public.meeting_continuation_rankings
    where meeting_id = (
      select id from t_continuation_proposal_ids where name = 'target_meeting'
    )
  $$,
  $$values (2::bigint, 0::bigint)$$,
  '14. zmiana odpowiedzi aktualizuje liczniki bez nowego wiersza'
);

update public.meetings
set deleted_at = now(),
    deleted_by = '10000000-0000-0000-0000-000000000002'::uuid
where id = (
  select id from t_continuation_proposal_ids where name = 'deleted_meeting'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.propose_meeting_continuation(
      (select id from t_continuation_proposal_ids where name = 'deleted_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play')
    )
  $$,
  '23503',
  'Meeting does not exist',
  '15. soft-deleted meeting nie przyjmuje propozycji kontynuacji'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$
    select public.resume_meeting_play(
      (select id from t_continuation_proposal_ids where name = 'target_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play')
    )
  $$,
  '16. wybrana przy Stole propozycja wznawia istniejący wpis'
);
reset role;

select results_eq(
  $$
    select continued_play_id
    from public.meetings
    where id = (
      select id from t_continuation_proposal_ids where name = 'target_meeting'
    )
  $$,
  $$select id from t_continuation_proposal_ids where name = 'play'$$,
  '17. wybór zapisuje continued_play_id na spotkaniu'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.plays
    where id = (select id from t_continuation_proposal_ids where name = 'play')
  $$,
  $$values (1::bigint)$$,
  '18. propozycja i wznowienie nie tworzą nowego wpisu Kroniki'
);

update public.plays
set status = 'completed',
    live_ended_at = now(),
    result_pending = false
where id = (select id from t_continuation_proposal_ids where name = 'play');

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$
    select *
    from public.propose_meeting_continuation(
      (select id from t_continuation_proposal_ids where name = 'source_meeting'),
      (select id from t_continuation_proposal_ids where name = 'play')
    )
  $$,
  '23514',
  'Play cannot be proposed as a continuation',
  '19. zakończonej kompletnej partii nie można ponownie zaproponować'
);
reset role;

select * from finish();
rollback;
