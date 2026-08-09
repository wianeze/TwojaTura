begin;

create extension if not exists pgtap with schema extensions;
select plan(30);

create temporary table admin_point_test_baseline as
select coalesce(sum(points), 0)::bigint as points
from public.point_events
where user_id = '10000000-0000-0000-0000-000000000002';

grant select on admin_point_test_baseline to authenticated;

select has_table(
  'public',
  'admin_point_adjustments',
  '1. admin point corrections have a dedicated audit table'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.admin_point_adjustments'::regclass),
  true,
  '2. RLS is enabled on the correction audit table'
);

select trigger_is(
  'public',
  'admin_point_adjustments',
  'admin_point_adjustments_append_only',
  'private',
  'prevent_append_only_mutation',
  '3. correction audit rows are append-only'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_award_point_action(uuid,text,text,uuid)',
    'EXECUTE'
  ),
  '4. anon cannot award a point action'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_reverse_point_event(uuid,text,uuid)',
    'EXECUTE'
  ),
  '5. anon cannot reverse a point event'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where oid = 'public.admin_award_point_action(uuid,text,text,uuid)'::regprocedure
      and proargnames @> array['p_target_user_id', 'p_action_type', 'p_reason', 'p_request_id']::text[]
      and not (proargnames @> array['p_points']::text[])
  ),
  1,
  '6. award RPC accepts a target/action but never arbitrary points'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_award_point_action(
    '10000000-0000-0000-0000-000000000002',
    'shelf_first_game',
    'member attempt',
    'a1000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Administrator access is required',
  '7. an ordinary member cannot award points'
);
select throws_ok(
  $$select * from public.admin_reverse_point_event(
    '00000000-0000-0000-0000-000000000001',
    'member attempt',
    'a1000000-0000-0000-0000-000000000002'
  )$$,
  '42501',
  'Administrator access is required',
  '8. an ordinary member cannot reverse points'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.admin_award_point_action(
    '10000000-0000-0000-0000-000000000002',
    'shelf_first_game',
    'Naprawa brakującej nagrody',
    'a1000000-0000-0000-0000-000000000003'
  )$$,
  '9. an admin can award a known point action'
);
reset role;

select results_eq(
  $$
    select operation, action_type, delta, reason
    from public.admin_point_adjustments
    where request_id = 'a1000000-0000-0000-0000-000000000003'
  $$,
  $$values (
    'award'::text,
    'shelf_first_game'::text,
    40::integer,
    'Naprawa brakującej nagrody'::text
  )$$,
  '10. award audit stores the action, delta and private reason'
);

select results_eq(
  $$
    select event.user_id, event.points, event.action_type, event.created_by
    from public.point_events as event
    join public.admin_point_adjustments as adjustment
      on adjustment.point_event_id = event.id
    where adjustment.request_id = 'a1000000-0000-0000-0000-000000000003'
  $$,
  $$values (
    '10000000-0000-0000-0000-000000000002'::uuid,
    40::integer,
    'admin_award:shelf_first_game'::text,
    '10000000-0000-0000-0000-000000000001'::uuid
  )$$,
  '11. award creates a recognizable positive ledger event by the admin'
);

select results_eq(
  $$
    select coalesce(sum(points), 0)::bigint - (select points from admin_point_test_baseline)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (40::bigint)$$,
  '12. the correction increases the user balance by the catalog reward'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select total_points - (select points from admin_point_test_baseline)
    from public.get_leaderboard()
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (40::bigint)$$,
  '13. leaderboard includes the correction'
);
select lives_ok(
  $$select * from public.admin_award_point_action(
    '10000000-0000-0000-0000-000000000002',
    'shelf_first_game',
    'Naprawa brakującej nagrody',
    'a1000000-0000-0000-0000-000000000003'
  )$$,
  '14. retrying the same award request is an idempotent success'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.admin_point_adjustments
    where request_id = 'a1000000-0000-0000-0000-000000000003'
  $$,
  $$values (1::bigint)$$,
  '15. retry does not duplicate the correction audit row'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.point_events as event
    join public.admin_point_adjustments as adjustment
      on adjustment.point_event_id = event.id
    where adjustment.request_id = 'a1000000-0000-0000-0000-000000000003'
  $$,
  $$values (1::bigint)$$,
  '16. retry does not duplicate the ledger event'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$select count(*)::bigint from public.admin_list_point_adjustments(20)$$,
  $$values (1::bigint)$$,
  '17. admin can read recent correction history'
);
select lives_ok(
  $$select * from public.admin_reverse_point_event(
    (
      select point_event_id
      from public.admin_point_adjustments
      where request_id = 'a1000000-0000-0000-0000-000000000003'
    ),
    'Nagroda przyznana omyłkowo',
    'a1000000-0000-0000-0000-000000000004'
  )$$,
  '18. admin can reverse the concrete previous event'
);
reset role;

select results_eq(
  $$
    select operation, action_type, delta, reason
    from public.admin_point_adjustments
    where request_id = 'a1000000-0000-0000-0000-000000000004'
  $$,
  $$values (
    'reversal'::text,
    'shelf_first_game'::text,
    (-40)::integer,
    'Nagroda przyznana omyłkowo'::text
  )$$,
  '19. reversal audit keeps its negative delta and reason'
);

select results_eq(
  $$
    select reversal.points, reversal.action_type, adjustment.reversed_point_event_id = original.id
    from public.admin_point_adjustments as adjustment
    join public.point_events as reversal on reversal.id = adjustment.point_event_id
    join public.point_events as original on original.id = adjustment.reversed_point_event_id
    where adjustment.request_id = 'a1000000-0000-0000-0000-000000000004'
  $$,
  $$values ((-40)::integer, 'admin_reversal:shelf_first_game'::text, true)$$,
  '20. reversal is a negative ledger event linked to the original event'
);

select results_eq(
  $$
    select coalesce(sum(points), 0)::bigint - (select points from admin_point_test_baseline)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (0::bigint)$$,
  '21. reversal restores the previous balance'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select total_points - (select points from admin_point_test_baseline)
    from public.get_leaderboard()
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (0::bigint)$$,
  '22. leaderboard also reflects the reversal'
);
select lives_ok(
  $$select * from public.admin_reverse_point_event(
    (
      select point_event_id
      from public.admin_point_adjustments
      where request_id = 'a1000000-0000-0000-0000-000000000003'
    ),
    'Nagroda przyznana omyłkowo',
    'a1000000-0000-0000-0000-000000000004'
  )$$,
  '23. retrying the same reversal request is idempotent'
);
select throws_ok(
  $$select * from public.admin_reverse_point_event(
    (
      select point_event_id
      from public.admin_point_adjustments
      where request_id = 'a1000000-0000-0000-0000-000000000003'
    ),
    'Druga próba cofnięcia',
    'a1000000-0000-0000-0000-000000000005'
  )$$,
  '23505',
  'Point event has already been reversed',
  '24. a second distinct reversal of the same event is blocked'
);
select throws_ok(
  $$select * from public.admin_award_point_action(
    '10000000-0000-0000-0000-000000000002',
    'made_up_reward',
    null,
    'a1000000-0000-0000-0000-000000000006'
  )$$,
  '22023',
  'Unsupported point action type: made_up_reward',
  '25. admin cannot award an action outside the reward catalog'
);
select throws_ok(
  $$select * from public.admin_award_point_action(
    '10000000-0000-0000-0000-000000000006',
    'meeting_rsvp',
    null,
    'a1000000-0000-0000-0000-000000000007'
  )$$,
  '42501',
  'Point recipient must be an active member',
  '26. inactive users cannot receive a correction'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select count(*) from public.admin_list_point_adjustments(20)$$,
  '42501',
  'Administrator access is required',
  '27. ordinary members cannot read correction reasons or audit history'
);
select throws_ok(
  $$insert into public.admin_point_adjustments (
    request_id, admin_user_id, target_user_id, action_type, operation,
    delta, point_event_id
  ) values (
    'a1000000-0000-0000-0000-000000000008',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    'meeting_vote',
    'award',
    10,
    '00000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  null,
  '28. ordinary members cannot insert audit rows directly'
);
reset role;

select throws_ok(
  $$update public.admin_point_adjustments set reason = 'tampered' where request_id = 'a1000000-0000-0000-0000-000000000003'$$,
  '42501',
  'admin_point_adjustments is append-only',
  '29. correction audit rows cannot be mutated'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.admin_point_adjustments
    where reversed_point_event_id is not null
      and request_id in (
        'a1000000-0000-0000-0000-000000000004',
        'a1000000-0000-0000-0000-000000000005'
      )
  $$,
  $$values (1::bigint)$$,
  '30. exactly one reversal audit exists for the original event'
);

select * from finish();
rollback;
