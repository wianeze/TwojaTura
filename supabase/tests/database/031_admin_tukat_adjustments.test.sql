begin;

create extension if not exists pgtap with schema extensions;
select plan(37);

-- Ten plik promuje Kubę (…0005) na obserwatora na czas transakcji, tak samo
-- jak robi to 002_role_system_and_admin — rollback na końcu cofa zmianę.
update public.app_members
set role = 'observer'
where user_id = '10000000-0000-0000-0000-000000000005';

create temporary table admin_tukat_test_baseline as
select
  (
    select coalesce(sum(amount), 0)::bigint
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  ) as marta_tukats,
  (
    select coalesce(sum(amount), 0)::bigint
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000003'
  ) as michal_tukats,
  (
    select coalesce(sum(points), 0)::bigint
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  ) as marta_points;

grant select on admin_tukat_test_baseline to authenticated;

-- ---------------------------------------------------------------------------
-- Kształt audytu i dostęp do RPC
-- ---------------------------------------------------------------------------

select has_table(
  'public',
  'admin_tukat_adjustments',
  '1. korekty Tukatów mają własną tabelę audytu'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.admin_tukat_adjustments'::regclass),
  true,
  '2. RLS jest włączone na tabeli audytu korekt Tukatów'
);

select trigger_is(
  'public',
  'admin_tukat_adjustments',
  'admin_tukat_adjustments_append_only',
  'private',
  'prevent_append_only_mutation',
  '3. wiersze audytu korekt Tukatów są append-only'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_adjust_tukats(uuid,integer,text,uuid)',
    'EXECUTE'
  ),
  '4. anon nie może wykonać korekty Tukatów'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.admin_list_tukat_adjustments(integer)',
    'EXECUTE'
  ),
  '5. anon nie może czytać historii korekt Tukatów'
);

select is(
  (
    select count(*)::integer
    from pg_proc
    where oid = 'public.admin_list_tukat_adjustments(integer)'::regprocedure
      and proargnames @> array['adjustment_id', 'delta', 'reason', 'created_at']::text[]
      and not (proargnames @> array['idempotency_key']::text[])
      and not (proargnames @> array['tukat_event_id']::text[])
  ),
  1,
  '6. historia audytu nie wystawia technicznego klucza idempotencji ani id wpisu ledgera'
);

select results_eq(
  $$select marta_tukats, michal_tukats from admin_tukat_test_baseline$$,
  $$values (0::bigint, 0::bigint)$$,
  '7. gracze startują z pustym ledgerem Tukatów'
);

-- ---------------------------------------------------------------------------
-- Kto NIE może korygować
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    20,
    'member attempt',
    'b1000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  'Administrator access is required',
  '8. zwykły członek nie może korygować Tukatów'
);
select throws_ok(
  $$select count(*) from public.admin_list_tukat_adjustments(20)$$,
  '42501',
  'Administrator access is required',
  '9. zwykły członek nie może czytać historii korekt Tukatów'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    20,
    'observer attempt',
    'b1000000-0000-0000-0000-000000000002'
  )$$,
  '42501',
  'Administrator access is required',
  '10. obserwator nie może korygować Tukatów'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    20,
    'inactive attempt',
    'b1000000-0000-0000-0000-000000000003'
  )$$,
  '42501',
  'Administrator access is required',
  '11. konto nieaktywne nie może korygować Tukatów'
);
reset role;

-- ---------------------------------------------------------------------------
-- Nadanie
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    20,
    'Rekompensata za utraconą Misję',
    'b1000000-0000-0000-0000-000000000010'
  )$$,
  '12. administrator może nadać Tukaty'
);
reset role;

select results_eq(
  $$
    select operation, delta, reason, admin_user_id, target_user_id
    from public.admin_tukat_adjustments
    where request_id = 'b1000000-0000-0000-0000-000000000010'
  $$,
  $$values (
    'grant'::text,
    20::integer,
    'Rekompensata za utraconą Misję'::text,
    '10000000-0000-0000-0000-000000000001'::uuid,
    '10000000-0000-0000-0000-000000000002'::uuid
  )$$,
  '13. audyt zapisuje operację, deltę, powód oraz administratora i gracza'
);

select results_eq(
  $$
    select event.user_id, event.amount, event.source_type, event.reason,
           event.source_id = adjustment.id
    from public.tukat_events as event
    join public.admin_tukat_adjustments as adjustment
      on adjustment.tukat_event_id = event.id
    where adjustment.request_id = 'b1000000-0000-0000-0000-000000000010'
  $$,
  $$values (
    '10000000-0000-0000-0000-000000000002'::uuid,
    20::integer,
    'admin_adjustment'::text,
    'Rekompensata za utraconą Misję'::text,
    true
  )$$,
  '14. korekta dopisuje rozpoznawalny wiersz do ledgera Tukatów'
);

select results_eq(
  $$
    select coalesce(sum(amount), 0)::bigint - (select marta_tukats from admin_tukat_test_baseline)
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (20::bigint)$$,
  '15. saldo liczone z ledgera rośnie o 20'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select results_eq(
  $$
    select total_tukats - (select marta_tukats from admin_tukat_test_baseline)
    from public.tukat_balances
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (20::bigint)$$,
  '16. widok tukat_balances pokazuje to samo saldo co ledger'
);
reset role;

select results_eq(
  $$
    select coalesce(sum(points), 0)::bigint - (select marta_points from admin_tukat_test_baseline)
    from public.point_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (0::bigint)$$,
  '17. korekta Tukatów nie rusza Renomy'
);

-- ---------------------------------------------------------------------------
-- Odebranie
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    -5,
    'Korekta omyłkowej wypłaty',
    'b1000000-0000-0000-0000-000000000011'
  )$$,
  '18. administrator może odebrać Tukaty'
);
reset role;

select results_eq(
  $$
    select coalesce(sum(amount), 0)::bigint - (select marta_tukats from admin_tukat_test_baseline)
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (15::bigint)$$,
  '19. odebranie 5 Tukatów zbija saldo do 15'
);

select results_eq(
  $$
    select operation, delta
    from public.admin_tukat_adjustments
    where request_id = 'b1000000-0000-0000-0000-000000000011'
  $$,
  $$values ('revoke'::text, (-5)::integer)$$,
  '20. odebranie zapisuje się jako ujemna korekta, a nie kasowanie wpisu'
);

-- ---------------------------------------------------------------------------
-- Odrzucane korekty
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    0,
    'zero',
    'b1000000-0000-0000-0000-000000000012'
  )$$,
  '22023',
  'Tukat adjustment must not be zero',
  '21. korekta o zero jest odrzucana jako bezsensowna'
);
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    -1000000,
    'za dużo',
    'b1000000-0000-0000-0000-000000000013'
  )$$,
  '23514',
  'Tukat balance cannot fall below zero (balance 15, requested -1000000)',
  '22. odebranie więcej niż saldo jest odrzucane, bez clampowania do zera'
);
reset role;

select results_eq(
  $$
    select coalesce(sum(amount), 0)::bigint - (select marta_tukats from admin_tukat_test_baseline)
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (15::bigint)$$,
  '23. odrzucona próba nie zostawia śladu w saldzie'
);

-- ---------------------------------------------------------------------------
-- Idempotencja
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    20,
    'Rekompensata za utraconą Misję',
    'b1000000-0000-0000-0000-000000000010'
  )$$,
  '24. powtórzenie tego samego request id kończy się idempotentnym sukcesem'
);
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000002',
    50,
    'inna kwota, ten sam klucz',
    'b1000000-0000-0000-0000-000000000010'
  )$$,
  '23505',
  'Request id has already been used for another correction',
  '25. ten sam klucz nie może posłużyć do innej korekty'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint
    from public.admin_tukat_adjustments
    where request_id = 'b1000000-0000-0000-0000-000000000010'
  $$,
  $$values (1::bigint)$$,
  '26. powtórzenie nie duplikuje wiersza audytu'
);

select results_eq(
  $$
    select count(*)::bigint
    from public.tukat_events
    where idempotency_key = 'admin_tukat_adjustment:b1000000-0000-0000-0000-000000000010'
  $$,
  $$values (1::bigint)$$,
  '27. powtórzenie nie duplikuje wpisu w ledgerze'
);

-- ---------------------------------------------------------------------------
-- Odbiorca musi być graczem
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000005',
    20,
    'obserwator',
    'b1000000-0000-0000-0000-000000000014'
  )$$,
  '42501',
  'Tukat recipient must be an active player',
  '28. obserwator nie może dostać Tukatów'
);
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000006',
    20,
    'nieaktywny',
    'b1000000-0000-0000-0000-000000000015'
  )$$,
  '42501',
  'Tukat recipient must be an active player',
  '29. konto nieaktywne nie może dostać Tukatów'
);

-- Granica jest przy zerze, a nie przed nim: zejście dokładnie do zera jest
-- poprawną operacją.
select lives_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000003',
    7,
    'test granicy',
    'b1000000-0000-0000-0000-000000000016'
  )$$,
  '30. administrator nadaje 7 Tukatów drugiemu graczowi'
);
select lives_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000003',
    -7,
    'test granicy',
    'b1000000-0000-0000-0000-000000000017'
  )$$,
  '31. zejście dokładnie do zera jest dozwolone'
);
select throws_ok(
  $$select * from public.admin_adjust_tukats(
    '10000000-0000-0000-0000-000000000003',
    -1,
    'jeden za daleko',
    'b1000000-0000-0000-0000-000000000018'
  )$$,
  '23514',
  'Tukat balance cannot fall below zero (balance 0, requested -1)',
  '32. jeden Tukat poniżej zera jest już odrzucany'
);
select results_eq(
  $$select count(*)::bigint from public.admin_list_tukat_adjustments(50)$$,
  $$values (4::bigint)$$,
  '33. administrator widzi historię wyłącznie udanych korekt'
);
reset role;

-- ---------------------------------------------------------------------------
-- Niezmienność ledgera i audytu
-- ---------------------------------------------------------------------------

select throws_ok(
  $$update public.tukat_events set amount = 999
    where idempotency_key = 'admin_tukat_adjustment:b1000000-0000-0000-0000-000000000010'$$,
  '0A000',
  'tukat_events is append-only',
  '34. korekta nie może zostać podmieniona w ledgerze'
);

select throws_ok(
  $$delete from public.tukat_events
    where idempotency_key = 'admin_tukat_adjustment:b1000000-0000-0000-0000-000000000011'$$,
  '0A000',
  'tukat_events is append-only',
  '35. korekty nie da się usunąć z ledgera'
);

select throws_ok(
  $$update public.admin_tukat_adjustments set reason = 'tampered'
    where request_id = 'b1000000-0000-0000-0000-000000000010'$$,
  '42501',
  'admin_tukat_adjustments is append-only',
  '36. wiersza audytu nie da się zmienić'
);

-- ---------------------------------------------------------------------------
-- Rozłączność walut w drugą stronę
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;
select * from public.admin_award_point_action(
  '10000000-0000-0000-0000-000000000002',
  'shelf_first_game',
  'korekta Renomy',
  'b1000000-0000-0000-0000-000000000020'
);
reset role;

select results_eq(
  $$
    select coalesce(sum(amount), 0)::bigint - (select marta_tukats from admin_tukat_test_baseline)
    from public.tukat_events
    where user_id = '10000000-0000-0000-0000-000000000002'
  $$,
  $$values (15::bigint)$$,
  '37. korekta Renomy nie rusza Tukatów'
);

select * from finish();
rollback;
