begin;

create extension if not exists pgtap with schema extensions;
select plan(29);

select has_table('public', 'audit_events', '1. audit_events exists');
select has_table('public', 'usage_events', '2. usage_events exists');

select is(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  true,
  '3. audit_events has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.usage_events'::regclass),
  true,
  '4. usage_events has RLS enabled'
);

select trigger_is(
  'public', 'audit_events', 'audit_events_append_only',
  'private', 'prevent_analytics_event_mutation',
  '5. audit events are append-only'
);
select trigger_is(
  'public', 'usage_events', 'usage_events_append_only',
  'private', 'prevent_analytics_event_mutation',
  '6. usage events are append-only'
);

select ok(
  not has_table_privilege('anon', 'public.audit_events', 'SELECT'),
  '7. anon cannot read audit events'
);
select ok(
  not has_table_privilege('anon', 'public.usage_events', 'SELECT'),
  '8. anon cannot read usage events'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'INSERT'),
  '9. authenticated cannot insert audit events directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.usage_events', 'INSERT'),
  '10. authenticated cannot insert usage events directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.audit_events', 'UPDATE, DELETE'),
  '11. authenticated cannot mutate audit events'
);
select ok(
  not has_table_privilege('authenticated', 'public.usage_events', 'UPDATE, DELETE'),
  '12. authenticated cannot mutate usage events'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.record_usage_event(uuid,text,text,text,text,text,uuid,text,text,text,text,text,jsonb)',
    'EXECUTE'
  ),
  '13. anon cannot record usage events'
);
select ok(
  not has_function_privilege(
    'anon',
    'public.record_audit_event(uuid,text,text,text,text,text,uuid,text,jsonb)',
    'EXECUTE'
  ),
  '14. anon cannot record audit events'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select lives_ok(
  $$select public.record_usage_event(
    '27000000-0000-4000-8000-000000000001',
    'route.viewed', 'table', 'app.route', 'viewed',
    null, null, null, 'client', null, 'mobile', 'Chrome', '{}'::jsonb
  )$$,
  '15. active member can use the narrow usage RPC'
);

select results_eq(
  $$select public.record_usage_event(
    '27000000-0000-4000-8000-000000000001',
    'route.viewed', 'table', 'app.route', 'viewed',
    null, null, null, 'client', null, 'mobile', 'Chrome', '{}'::jsonb
  )$$,
  $$values (false)$$,
  '16. repeated event id is idempotent'
);

select throws_ok(
  $$select public.record_usage_event(
    '27000000-0000-4000-8000-000000000002',
    'route.viewed', 'table', 'app.route', 'viewed',
    null, null, null, 'client', null, null, null,
    '{"note":"secret"}'::jsonb
  )$$,
  '22023',
  'Unsupported analytics metadata',
  '17. unknown usage metadata is rejected'
);

select throws_ok(
  $$select public.record_usage_event(
    '27000000-0000-4000-8000-000000000003',
    'unknown.event', 'table', 'app.route', 'viewed',
    null, null, null, 'client', null, null, null, '{}'::jsonb
  )$$,
  '23514',
  null,
  '18. unknown event name is rejected by the catalog'
);

select lives_ok(
  $$select public.record_audit_event(
    '27000000-0000-4000-8000-000000000011',
    'auth.login.success', 'success', 'login', 'mobile', 'Safari',
    '27000000-0000-4000-8000-000000000012',
    'login:27000000-0000-4000-8000-000000000012', '{}'::jsonb
  )$$,
  '19. authenticated audit event can be recorded'
);

select throws_ok(
  $$select public.record_audit_event(
    '27000000-0000-4000-8000-000000000013',
    'auth.logout', 'success', 'profile', null, null, null, null,
    '{"comment":"private"}'::jsonb
  )$$,
  '22023',
  'Unsupported audit metadata',
  '20. unknown audit metadata is rejected'
);

select throws_ok(
  $$select public.record_audit_event(
    '27000000-0000-4000-8000-000000000014',
    'server_action.error', 'error', 'table', null, null, null, null,
    '{"error_action":{"raw":"payload"}}'::jsonb
  )$$,
  '22023',
  'Unsupported audit metadata',
  '21. audit metadata values must be safe catalog tokens'
);

select is(
  (select count(*) from public.usage_events),
  0::bigint,
  '22. ordinary member cannot read usage rows through RLS'
);
select is(
  (select count(*) from public.audit_events),
  0::bigint,
  '23. ordinary member cannot read audit rows through RLS'
);

select throws_ok(
  $$select public.admin_analytics_snapshot(30)$$,
  '42501',
  'Administrator access is required',
  '24. ordinary member cannot read admin statistics RPC'
);

reset role;

select is(
  (select user_id from public.usage_events where id = '27000000-0000-4000-8000-000000000001'),
  '10000000-0000-0000-0000-000000000002'::uuid,
  '25. usage RPC derives user_id from auth.uid'
);
select is(
  (select actor_user_id from public.audit_events where id = '27000000-0000-4000-8000-000000000011'),
  '10000000-0000-0000-0000-000000000002'::uuid,
  '26. audit RPC derives actor from auth.uid'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.usage_events),
  1::bigint,
  '27. admin can read usage events'
);
select is(
  (select count(*) from public.audit_events),
  1::bigint,
  '28. admin can read audit events'
);
select lives_ok(
  $$select public.admin_analytics_snapshot(30)$$,
  '29. admin can read the statistics snapshot'
);

rollback;
