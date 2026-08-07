begin;

create extension if not exists pgtap with schema extensions;
select plan(20);

select has_table(
  'public',
  'game_loans',
  '1. game_loans stores the loan history'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.game_loans'::regclass),
  true,
  '2. RLS is enabled on game_loans'
);

select ok(
  exists (
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'game_loans'
      and indexname = 'game_loans_one_active_per_game_idx'
      and indexdef like '%WHERE (returned_at IS NULL)%'
  ),
  '3. one partial unique index protects the active loan'
);

select ok(
  not has_function_privilege(
    'anon', 'public.loan_game(uuid,uuid,text)', 'EXECUTE'
  ),
  '4. anon cannot execute loan_game'
);

select ok(
  not has_function_privilege(
    'anon', 'public.return_game(uuid)', 'EXECUTE'
  ),
  '5. anon cannot execute return_game'
);

insert into public.games (
  id, title, owner_id, current_holder_id, status
)
values (
  '93000000-0000-0000-0000-000000000001',
  'Test historii wypozyczen',
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'available'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
set local role authenticated;
select is(
  (select count(*) from public.game_loans),
  0::bigint,
  '6. inactive member cannot read loan history'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.loan_game(
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'Do nastepnego spotkania'
  )$$,
  '7. owner loans their game to another active member'
);
reset role;

select results_eq(
  $$
    select lender_user_id, borrower_user_id, note
    from public.game_loans
    where game_id = '93000000-0000-0000-0000-000000000001'
      and returned_at is null
  $$,
  $$values (
    '10000000-0000-0000-0000-000000000002'::uuid,
    '10000000-0000-0000-0000-000000000003'::uuid,
    'Do nastepnego spotkania'::text
  )$$,
  '8. loan record keeps lender, borrower and note'
);

select results_eq(
  $$
    select current_holder_id, status
    from public.games
    where id = '93000000-0000-0000-0000-000000000001'
  $$,
  $$values (
    '10000000-0000-0000-0000-000000000003'::uuid,
    'loaned'::public.game_status
  )$$,
  '9. loan updates holder and game status'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.loan_game(
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004'
  )$$,
  '23505',
  null,
  '10. active loan cannot be duplicated'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.loan_game(
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004'
  )$$,
  '42501',
  null,
  '11. non-owner cannot loan another person game'
);
select throws_ok(
  $$select public.return_game(
    '93000000-0000-0000-0000-000000000001'
  )$$,
  '42501',
  null,
  '12. borrower cannot record the return'
);
reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select lives_ok(
  $$select public.return_game(
    '93000000-0000-0000-0000-000000000001'
  )$$,
  '13. owner records the return'
);
reset role;

select is(
  (
    select count(*)
    from public.game_loans
    where game_id = '93000000-0000-0000-0000-000000000001'
      and returned_at is not null
  ),
  1::bigint,
  '14. returned loan remains in history'
);

select results_eq(
  $$
    select current_holder_id, status
    from public.games
    where id = '93000000-0000-0000-0000-000000000001'
  $$,
  $$values (
    '10000000-0000-0000-0000-000000000002'::uuid,
    'available'::public.game_status
  )$$,
  '15. return restores owner as holder and availability'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;
select throws_ok(
  $$select public.loan_game(
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002'
  )$$,
  '22023',
  null,
  '16. owner cannot loan a game to themselves'
);
select throws_ok(
  $$select public.loan_game(
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000006'
  )$$,
  '22023',
  null,
  '17. inactive member cannot be a borrower'
);
select throws_ok(
  $$insert into public.game_loans (
    game_id, lender_user_id, borrower_user_id
  ) values (
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000004'
  )$$,
  '42501',
  null,
  '18. authenticated user cannot bypass RPC with direct insert'
);
select lives_ok(
  $$select public.loan_game(
    '93000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004'
  )$$,
  '19. a returned game can be loaned again'
);
reset role;

select results_eq(
  $$
    select count(*)::bigint,
           count(*) filter (where returned_at is null)::bigint
    from public.game_loans
    where game_id = '93000000-0000-0000-0000-000000000001'
  $$,
  $$values (2::bigint, 1::bigint)$$,
  '20. history has two loans but only one active loan'
);

select * from finish();
rollback;
